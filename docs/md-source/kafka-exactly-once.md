---
title: 'Kafka 如何保证数据不丢不重'
description: '拆解 Kafka 端到端「不丢不重」需要拧紧的每一环：三条投递语义的区别、acks=all 与 min.insync.replicas 的真实关系、幂等生产者的 PID 与序列号去重、事务如何实现跨分区原子与 read_committed 隔离，以及生产端/Broker/消费端各自的配置清单。'
pubDate: 2026-09-19
tags: ['Kafka', '消息队列', '分布式']
categories: ['中间件', '分布式系统']
author: 'eilvy'
---

「Kafka 怎么保证消息不丢不重」是面试高频题，但很多回答停在「设 acks=all 就行」——这既不够，也不准确。

真实情况是：**「不丢」和「不重」是两个独立问题**，需要分别用不同机制解决；而所谓的「精确一次」也有明确的边界，超出边界就得自己兜底。

这篇按「先分清问题 → 再逐个解决 → 最后给出清单」的顺序讲清楚。

---

## 一、先分清：三条投递语义

Kafka 的消息投递有三种语义，区别在于**「处理消息」和「提交 offset」这两件事的先后顺序**。

> **图：三条投递语义对比**
> （原文此处为交互式画板，本文件为纯 Markdown 版本，不含该图）

### 1.1 最多一次（at-most-once）

**先提交 offset，再处理消息。**

如果处理到一半崩溃，offset 已经提交了 —— 重启后从下一条开始读，这条消息**永久丢失**。

只有在「丢一两条无所谓」的场景才用（比如某些日志采集）。

### 1.2 至少一次（at-least-once）

**先处理消息，再提交 offset。**

如果提交前崩溃，重启后会**重新消费**这条消息 —— 不丢，但可能重复。

**这是 Kafka 的默认行为**，也是绝大多数场景的起点。

### 1.3 精确一次（exactly-once）

把**「处理消息」和「提交 offset」放进同一个事务**里，要么都生效，要么都不生效。

听起来完美，但要注意它的边界：

> Kafka 的 exactly-once 是**Kafka 内部端到端**的语义 —— 指「从 Kafka 读、处理后写回 Kafka」这条链路。一旦你要写外部数据库、调外部 API，那部分**不在事务保护范围内**，仍然需要自己保证幂等。

这一点后面第六节还会展开。

---

## 二、不丢（一）：acks=all 到底在等谁

要理解「不丢」，先要理解 Kafka 的副本机制。

### 2.1 一条消息什么时候算「写成功」

Kafka 每个分区有多个副本，其中一个是 **Leader**，其余是 **Follower**。生产者的写请求只发给 Leader，Follower 主动来拉取同步。

关键概念：

| 概念 | 含义 |
|---|---|
| **LEO**（Log End Offset） | 该副本日志的下一条待写位置 |
| **HW**（High Watermark） | 所有 ISR 副本都已同步到的位置 |
| **ISR**（In-Sync Replicas） | 与 Leader 保持同步的副本集合 |

**消费者只能读到 HW 之前的消息** —— 因为 HW 之后的还没有被完整复制，读到就有丢失风险。

> **图：生产端不丢**
> （原文此处为交互式画板，本文件为纯 Markdown 版本，不含该图）

### 2.2 一个常见的误解

很多人以为 `acks=all` 是「等所有副本确认」。**不是。**

它等的是「**当前 ISR 里**的所有副本」。而 ISR 是个动态集合 —— Follower 落后太多会被踢出去。

于是就有这个危险场景：

```
3 个副本，其中 2 个 Follower 网络卡顿掉出 ISR
→ ISR 只剩 Leader 一个
→ acks=all 此时等价于 acks=1
→ Leader 一挂，数据就没了
```

**这就是为什么必须配 `min.insync.replicas`。**

### 2.3 min.insync.replicas 的作用

它给 ISR 设了一个**下限**：

> 当 ISR 中的副本数 **少于** `min.insync.replicas` 时，`acks=all` 的写入**直接失败**（抛 `NotEnoughReplicasException`）。

也就是**宁可不可用，也不丢数据** —— 这是一个明确的一致性优先取舍。

**推荐配置**：

```properties
# Topic / Broker 级
replication.factor=3
min.insync.replicas=2

# Producer 级
acks=all
```

含义：3 副本中至少 2 个确认才算成功 —— 可以容忍 1 个副本故障，且不会因为 ISR 缩水而失去保护。

> `min.insync.replicas=2` 配合 `replication.factor=3`，能容忍 1 台 Broker 宕机；如果设成 3，则任意一台挂了都无法写入，可用性太低。

### 2.4 另一个会丢数据的开关

```properties
unclean.leader.election.enable=false   # 默认已是 false
```

当分区的**所有 ISR 副本都挂了**时：

- `false`：分区保持不可用，等 ISR 副本恢复 —— **保数据**
- `true`：从非 ISR 副本（落后的那些）里选一个当 Leader —— **保可用，但必然丢数据**

生产环境保持 `false`。这个开关是「可用性换数据」的典型，选 `true` 就等于承认可能丢。

---

## 三、不丢（二）：消费端别丢

生产端保证了消息写进 Kafka 不丢，但如果消费端用错，消息照样会丢。

### 3.1 关闭自动提交

```properties
enable.auto.commit=false
```

自动提交的问题在于：它按**时间间隔**（默认 5 秒）在后台提交，而不是按「消息是否处理完」提交。

后果是：消费者拉了一批消息，自动提交已经把这些 offset 提交了，但业务逻辑还没处理完 —— 此时崩溃，重启后**这批消息就被跳过了**。

### 3.2 处理完再手动提交

```java
while (true) {
    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(100));
    for (ConsumerRecord<String, String> record : records) {
        process(record);          // 先处理
    }
    consumer.commitSync();        // 再提交
}
```

**顺序不能反。** 先提交再处理，就是「最多一次」；先处理再提交，是「至少一次」。

### 3.3 重复消费的根源：rebalance

即使顺序对了，「至少一次」仍然会重复 —— 因为 **rebalance**。

当消费者组里有人加入/离开，分区会重新分配。此时：

1. 旧消费者已经把消息处理完了（比如写进了数据库）
2. 但它**还没来得及提交 offset**
3. 分区被转交给新消费者，新消费者从**上次已提交的 offset** 开始读
4. 于是第 1 步处理过的消息**又被处理一遍**

**这不是 bug，是「至少一次」的必然结果。** 要消除重复，要么靠 Kafka 事务（第四节），要么在业务侧做幂等。

---

## 四、不重（一）：幂等生产者

先解决**生产端**的重复。

生产端重复的来源是**重试**：生产者发出消息 → Broker 写入成功 → 但响应在回程丢了 → 生产者以为失败，重试 → 消息被写了两遍。

### 4.1 PID + 序列号

幂等生产者的机制很简洁：

- 每个生产者实例分配一个 **PID**（Producer ID）
- 每条消息带上该 PID 下、**该分区**的**序列号**（从 0 单调递增）
- Broker 为每个 `(PID, 分区)` 记住最近接收的序列号
- 收到序列号**小于等于**已记录的 → 判定为重复，直接丢弃并返回成功

> **图：幂等生产者的去重机制**
> （原文此处为交互式画板，本文件为纯 Markdown 版本，不含该图）

### 4.2 开启方式

```properties
enable.idempotence=true
```

**Kafka 3.0 起这个默认就是 `true`**（KIP-679），同时会强制：

| 配置 | 被自动设置为 | 原因 |
|---|---|---|
| `acks` | `all` | 幂等必须确保写入成功 |
| `retries` | `Integer.MAX_VALUE` | 重试是幂等的前提，要允许重试 |
| `max.in.flight.requests.per.connection` | `5` | 保留一定并发，同时不乱序 |

### 4.3 幂等的边界

**幂等只保证「单生产者、单分区、单会话内」不重复。** 它管不了：

- **跨分区**：往分区 A 和分区 B 各写一条，其中一条失败了，幂等无法回滚另一条
- **生产者重启**：PID 会变，新会话的序列号重新开始，Broker 无法关联到旧会话
- **消费端重复**：那是上面 3.3 的问题

跨分区和跨会话的原子性，要靠**事务**。

---

## 五、不重（二）：事务与 read_committed

事务是 Kafka 实现「精确一次」的核心，它解决两件事：

1. **跨分区写入的原子性**
2. **「处理消息」与「提交 offset」的原子性**（这正是消费端重复的根治方案）

### 5.1 事务协调者与两阶段提交

Kafka 有一个 **Transaction Coordinator**，它自己的状态也存在一个内部 topic（`__transaction_state`）里。

一次事务的流程大致是：

```
① InitProducerId          → 拿到 PID 和 epoch
② AddPartitionsToTxn      → 登记本次事务会写哪些分区
③ 写业务数据              → 此时数据已落盘，但对 read_committed 消费者不可见
④ AddOffsetsToTxn         → 把消费位移也纳入事务
⑤ EndTxn(commit)          → 协调者向所有涉及分区写 COMMIT 标记
```

第 ⑤ 步就是**两阶段提交的提交点**：在 COMMIT 标记写入之前，这些数据对 `read_committed` 的消费者是**不可见**的。

> **图：Kafka 事务**
> （原文此处为交互式画板，本文件为纯 Markdown 版本，不含该图）

### 5.2 消费端的隔离级别

```properties
isolation.level=read_committed
```

| 取值 | 行为 |
|---|---|
| `read_uncommitted`（默认） | 不等待事务，按 offset 顺序读所有消息 —— 可能读到后来被回滚的数据 |
| `read_committed`（推荐） | 只读到 **LSO** 之前已提交的消息，未提交/已回滚的自动过滤 |

**LSO（Last Stable Offset）** 是「第一个未结束事务的起始位置」。`read_committed` 的消费者不会被服务到 LSO 及其之后的记录。

### 5.3 用事务解决消费端重复

最典型的用法是 **consume-transform-produce** 模式：

```java
producer.initTransactions();
try {
    producer.beginTransaction();
    for (ConsumerRecord<String, String> record : records) {
        String result = transform(record);
        producer.send(new ProducerRecord<>("output-topic", result));
    }
    // 关键：把消费位移也提交到事务里
    producer.sendOffsetsToTransaction(currentOffsets, consumerGroupId);
    producer.commitTransaction();
} catch (Exception e) {
    producer.abortTransaction();
}
```

这样「写 output-topic」和「提交 input 的 offset」就是原子的 —— 不会出现「输出写了但 offset 没提交」导致的重复处理。

### 5.4 事务的代价

事务不是免费的：

- **吞吐下降**：多了一轮协调者交互和标记写入
- **延迟增加**：`read_committed` 消费者要等事务结束才能读到数据
- **协调者本身要可靠**：`transaction.state.log.replication.factor` 和 `min.insync.replicas` 也要配好，否则协调者挂了会卡住事务

---

## 六、端到端清单

前面是分环节讲，这里汇总成一张检查表 —— **任何一环漏掉，前功尽弃**。

> **图：端到端不丢不重的配置清单**
> （原文此处为交互式画板，本文件为纯 Markdown 版本，不含该图）

### 6.1 生产端

```properties
acks=all
enable.idempotence=true          # Kafka 3.0+ 默认已是 true
retries=Integer.MAX_VALUE        # 开启幂等后自动设置
delivery.timeout.ms=120000       # 要 > request.timeout.ms + linger.ms
max.in.flight.requests.per.connection=5
```

### 6.2 Broker / Topic

```properties
replication.factor=3
min.insync.replicas=2
unclean.leader.election.enable=false
transaction.state.log.replication.factor=3
transaction.state.log.min.insync.replicas=2
```

### 6.3 消费端

```properties
enable.auto.commit=false
isolation.level=read_committed
auto.offset.reset=earliest        # 视业务而定，别用 latest 误丢
```

外加：**处理完再提交 offset**，并在**业务侧做幂等**（去重表 / 唯一键 / 状态机）。

---

## 七、几个容易搞错的地方

### 7.1 「设了 acks=all 就不会丢」

错。如果 ISR 缩水成 1，`acks=all` 就退化成 `acks=1`。**必须配 `min.insync.replicas`。**

### 7.2 「开了幂等就不会重复」

错。幂等只管**单生产者、单分区、单会话**。跨分区、生产者重启、消费端重复，它都管不了。

### 7.3 「开了事务就是 exactly-once」

只在 Kafka 内部成立。**写出到外部系统（数据库、HTTP API）不在事务范围内** —— 那部分仍要自己保证幂等。

正确的心态是：Kafka 的事务把「读 Kafka → 写 Kafka」变成原子，但「写数据库」这个副作用需要你自己处理（比如用去重表、或者把结果也写回 Kafka 再由下游幂等消费）。

### 7.4 「重复消费一定是 bug」

不一定。**「至少一次 + 业务幂等」是工程上更常见的组合**，比强上事务简单得多，也够用。

只有在「下游难以做幂等」或「重复的代价很高」时，才值得上事务。

### 7.5 「auto.offset.reset=latest 更安全」

不一定。`latest` 表示「没有已提交 offset 时从最新开始读」，意味着**之前积压的消息会被跳过**。新消费者组上线时用 `latest` 很容易漏数据，除非你明确只想处理新消息。

---

## 八、总结

一句话概括三层的分工：

| 目标 | 靠什么 |
|---|---|
| **不丢** | `acks=all` + `min.insync.replicas` + 关闭 unclean 选举 + 消费端手动提交 |
| **不重（生产端）** | `enable.idempotence=true`（PID + 序列号去重） |
| **不重（消费端）** | 事务（`sendOffsetsToTransaction`）+ `isolation.level=read_committed`，或业务侧幂等 |

三个必须记住的边界：

1. **`acks=all` 等的是当前 ISR，不是全部副本** —— 所以离不开 `min.insync.replicas`
2. **幂等只在单生产者/单分区/单会话内有效** —— 跨分区要靠事务
3. **Kafka 的 exactly-once 不覆盖外部系统副作用** —— 出了 Kafka 就得自己保证幂等

最后：**「至少一次 + 业务幂等」通常比「强上事务」更划算。** 先问清楚「重复的代价有多大」，再决定要不要付出事务的吞吐与延迟成本。

---

## 参考资料

- [Kafka Exactly-Once Semantics — Idempotent Producers and Transactions](https://systeminternals.dev/kafka/exactly-once/)
- [Kafka min.insync.replicas Explained — Conduktor](https://www.conduktor.io/kafka/kafka-topic-configuration-min-insync-replicas)
- [Kafka Idempotent Producer (enable.idempotence) — Conduktor](https://www.conduktor.io/kafka/idempotent-kafka-producer)
- [KIP-679: Producer will enable the strongest delivery guarantee by default](https://issues.apache.org/jira/browse/KAFKA-10619)
- [Kafka Unclean Leader Election — Conduktor](https://www.conduktor.io/kafka/kafka-topic-configuration-unclean-leader-election)
- [Kafka Transactions Deep Dive — Conduktor](https://www.conduktor.io/glossary/kafka-transactions-deep-dive)
- [Why Kafka Consumer Rebalances Cause Duplicate Processing](https://oneuptime.com/blog/post/2026-07-22-kafka-rebalances-duplicate-processing/view)
- [Kafka auto.offset.reset Explained — Conduktor](https://www.conduktor.io/kafka/consumer-auto-offsets-reset-behavior)
- [High Watermark in Apache Kafka Explained: LEO, ISR, and Data](https://bytefreak.dev/high-watermark-in-apache-kafka)
