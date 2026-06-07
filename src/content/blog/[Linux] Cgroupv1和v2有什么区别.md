---
title: 'Cgroup v1 和 v2有什么区别'
description: '分析容器底层资源限制分配的原理'
pubDate: 2026-05-10
tags: ['Docker','Container','Linux','k8s']
categories: ['容器','计算机系统','k8s']
author: 'eilvy'
---

> 引言：前一段时间自己根据资料做了个LowLevel级别的容器引擎，目的是借此理解容器的底层实现的原理步骤，本篇所讲的Cgroup的内容在容器中主要是做资源限制的功能，做的时候遇到了v1和v2版本的问题。

总的来说，cgroup v1 是**按 subsystem 挂载多层级树**的模型，v2 改为**统一单层级树 + 独立接口文件**，解决 v1 的混乱与不一致问题。

## 核心区别

我们用一张表格来将两者的不同做出区分：

| 维度                           | v1                                                           | v2                                                           |
| ------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| **层级结构**                   | 每个 subsystem（cpu/memory/blkio 等）各自挂载成一个独立树，一个进程可以在不同树中属于不同 cgroup | 所有 subsystem 在**同一棵树下**，一个进程只有一个 cgroup 节点，所有限制写在该节点下 |
| **进程归属**                   | 一个进程可以在不同 subsystem 下位于不同 cgroup（例如 cpu 在 /cpu/cgA，memory 在 /mem/cgB） | **统一控制**：一个进程只能属于一个 cgroup，该节点下有 cpu、memory、io 等所有接口文件 |
| **线程级控制**                 | 部分 subsystem 不支持线程级区分                              | 通过 `cgroup.threads` 和 `cgroup.type` 支持线程粒度管理，用于 `cpuset` 等场景 |
| **接口设计**                   | 每个 subsystem 自己定义接口文件，命名和语义不统一            | 统一的接口约定，命名规范，且多了 `cgroup.events`（populated/frozen 通知）、`cgroup.freeze` 等高层语义 |
| **资源控制**                   | memory 的 `memory.{usage_in_bytes,limit_in_bytes}`，cpu 的 `cpu.shares`、`cpu.cfs_period_us`、`cpu.cfs_quota_us` | memory 统一为 `memory.{current,max,high,min}`，CPU 统一整合，且 CPU/Memory/IO 的统计在同一目录下可读 |
| **内核态压力感知**             | 没有统一入口                                                 | 引入 `memory.pressure`、`io.pressure`、`cpu.pressure`（PSI，Pressure Stall Information），内核直接报告资源争抢程度 |
| **BPF 集成**                   | 无                                                           | 支持通过 BPF 对 cgroup 做更灵活的流量控制和安全策略          |
| **`release_agent` 与自动清理** | 每个层级都要配置 `notify_on_release` + `release_agent` 处理空 cgroup 删除 | 通过 `cgroup.events` 的 `populated` 字段 + `write-behind` 机制，容器退出后 cgroup 自动清理更干净 |

## 对于容器构建的影响

上面是从Cgroup v1 和 v2的构造上做出的区别，接下来根据这些区别，到容器中有如下的变化：

**v1 创建容器的流程**（旧版Docker/containerd 默认模式）：

```
/sys/fs/cgroup/
├── cpu/docker/<container-id>/
│   └── cpu.shares, cpu.cfs_quota_us, cpu.cfs_period_us
├── memory/docker/<container-id>/
│   └── memory.limit_in_bytes, memory.soft_limit_in_bytes
├── cpuset/docker/<container-id>/
│   └── cpuset.cpus, cpuset.mems
├── blkio/docker/<container-id>/
│   └── blkio.weight
└── pids/docker/<container-id>/
    └── pids.max
```

每个 subsystem 的树互不相干，所以容器创建时运行时要在 **5 个不同路径下各 mkdir** 一次，分别写各自的限制文件。而且不同 subsystem 的行为可能不一致——比如 `memory` cgroup 在容器退出后如果有 page cache 没回收干净，cgroup 目录可能删不掉，造成残留。

而且还有一个坑：v1 下 **不同 subsystem 可能来自不同 mount namespace**，如果某个 subsystem 忘记挂载了，容器就多了一层不确定性。



**v2 下创建容器的流程**（我的 my-GoDocker 以及最新的containerd所使用的是这个模式）：

```
/sys/fs/cgroup/
├── cgroup.controllers          # 当前启用的 controller 列表
├── cgroup.subtree_control      # 子节点可继承的 controller
├── cgroup.procs                # 进程归属
└── my-container/
    ├── cgroup.controllers
    ├── cpu.max                  # 等价于 v1 的 cpu.cfs_quota_us / cpu.cfs_period_us
    ├── cpu.weight               # 等价于 v1 的 cpu.shares
    ├── memory.max               # 等价于 v1 的 memory.limit_in_bytes
    ├── memory.current
    ├── io.weight                # 等价于 v1 的 blkio.weight
    └── pids.max
```

**关键区别：**

- **一个 mkdir 解决问题**：只需要在一个路径下 `mkdir`，所有限制文件都在同一个目录下，统一写。
- **继承关系清晰**：通过 `cgroup.subtree_control` 控制子节点能继承哪些 controller，不需要像 v1 一样每个 subsystem 各挂各的。
- **`cgroup.freeze` 容器暂停**：v2 多了一个 `cgroup.freeze` 接口，`echo 1 > cgroup.freeze` 即可 freeze 整个 cgroup 的所有进程。这在容器 pause/unpause 时非常有用，v1 下要手动向所有进程发 SIGSTOP。
- **内核 PSI 接口**：直接读 `memory.pressure`、`cpu.pressure` 就能知道资源是否紧张。这在容器编排平台做**过载检测、热点迁移**时非常方便。
- **退出清理更可靠**：v2 解决了 v1 中 memory cgroup 被 page cache 拖住无法删除的 bug。

## 历史变迁

在 cgroup v1 的遗留系统上，有几个典型问题：

- **`memory` 和 `blkio` 的跨层级互动难以追踪**：IO 压力和内存回收互相影响，但它们在两个树里，排查困难。
- **NUMA 场景下 `cpuset` 的协同复杂**：多个 subsystem 同时配置时可能出现隐式冲突。
- **内核社区的新特性（PSI、Writeback 跟踪、IO Latency 控制、Memory Reclaim 原生统计）全部只在 v2 上实现**。

所以 Fedora/CentOS/RHEL 从 8 开始默认 v2，Ubuntu 22.04+ 默认 v2，Docker 20.10+ 和 containerd 1.5+ 也默认走 v2。

## 阶段总结

  v1 是早期增长式设计，每个 subsystem 自己竖一个树，混乱且特性停滞。v2 统一到单树，减少了一个 cgroup 目录 mkdir 点不够的问题，接口更规范，而且带来了 PSI、cgroup.freeze 等对容器编排非常有价值的原生能力。我的 my-GoDocker 使用 v2，核心接口是 `mkdir` → `echo pid > cgroup.procs` → 写入 `cpu.max`/`memory.max`/`io.weight` 等限制文件即可完成容器隔离。

---

## cgroup v2 与 Kubernetes limits/requests 的映射

在 Kubernetes 中，Pod 的 `resources.limits` 和 `resources.requests` 最终由 kubelet 通过 CRI 下发到容器运行时，容器运行时再写入 cgroup v2 的对应文件。整个映射关系如下：

### CPU 映射

| K8s 配置 | cgroup v2 文件 | 写入值示例 | 含义 |
|----------|---------------|-----------|------|
| `limits.cpu: "2"` | `cpu.max` | `"200000 100000"` | 每 100ms 周期内最多使用 200ms CPU 时间（2 核） |
| `limits.cpu: "200m"` | `cpu.max` | `"20000 100000"` | 每 100ms 周期内最多使用 20ms（0.2 核） |
| `limits.cpu` 未设置 | `cpu.max` | `"max 100000"` | 无硬上限，不节流 |
| `requests.cpu: "1"` | `cpu.weight` | `1024` | CPU 争抢时的调度权重基准值 |
| `requests.cpu: "500m"` | `cpu.weight` | `512` | 0.5 核对应的权重 |
| `requests.cpu` 未设置 | `cpu.weight` | `1` | 最低权重 |

`cpu.max` 的格式是 `$MAX $PERIOD`，单位是微秒（µs）。换算公式：

```
$MAX = limits.cpu × $PERIOD
# 例如 limits.cpu=2, PERIOD=100000(100ms)
# $MAX = 2 × 100000 = 200000
```

`cpu.weight` 的换算公式：

```
cpu.weight = requests.cpu × 1024
# 换算范围 1 ~ 10000
```

**CPU 超出限制时的行为**：
- 当容器 CPU 使用达到 `cpu.max` 设定的上限时，内核 CFS 调度器会对该 cgroup 内的进程做**带宽节流（throttling）**——剥夺 CPU 时间片，强制让出 CPU 给其他 cgroup。进程不会被杀，但会感觉"突然变慢"。
- `cpu.weight` 不是硬限制，**不设置也不会有"超出"的概念**。CPU 空闲时，容器可以使用超过 `requests.cpu` 的 CPU；CPU 紧张时，各 cgroup 按其 `cpu.weight` 比例分配剩余 CPU 时间。`cpu.weight` 值越大的 cgroup，在争抢时拿到的时间片越多。

### Memory 映射

| K8s 配置 | cgroup v2 文件 | 作用性质 |
|----------|---------------|---------|
| `limits.memory: "512Mi"` | `memory.max` | **硬上限**——超出即 OOM Kill |
| `requests.memory: "256Mi"` | `memory.low` | **软保护线**——内存压力时优先保护这部分不被回收 |
| 节点层面（kubelet 自动设置） | `memory.high` | **节流线**——超出后 throttle 进程 + 强制回收，但不杀进程 |

这三个文件构成了从软到硬的三层防线：

```
memory 用量增长方向 ───────────────────────────────►

  memory.low            memory.high            memory.max
  (尽力保护)            (节流回收)              (OOM Kill)
  对应 requests         节点层自动设置          对应 limits
```

**超出 `memory.high` 时的行为（节流，不杀）**：

当 cgroup 的内存使用超过 `memory.high` 设定的值时，内核会立即对该 cgroup 内所有进程采取以下措施：

1. **剥夺 CPU 时间**——该 cgroup 内的所有进程被临时挂起，无法继续分配新内存
2. **触发同步内存回收（direct reclaim）**——内核强制回收该 cgroup 内的干净页缓存（clean page cache）、换出匿名页（swap anonymous pages），尽可能把内存压回 `memory.high` 以下
3. **回收完成后恢复执行**——一旦内存降到阈值以下，CPU 归还，进程继续运行，整个过程中**进程不被杀死**，只是经历了短暂的卡顿

在 Kubernetes 节点上，`memory.high` 被设置在 `kubepods.slice` 根 cgroup 上，值等于 `Allocatable Memory`（节点总内存减去系统预留和驱逐预留）。当所有 Pod 的总内存使用触及这条线时，全体 Pod 被 throttle 而非被内核随机 OOM Kill。这就给了 kubelet 的 Eviction Manager 一个决策窗口——kubelet 可以在预留的系统内存中正常运行，按驱逐策略自主选择要驱逐的 Pod。

**超出 `memory.max` 时的行为（硬杀）**：

当 cgroup 的内存使用超过 `memory.max` 时，**内核直接触发 OOM Killer**：

1. 内核检查该 cgroup 内所有进程的 `oom_score_adj`，选择得分最高的进程（即"最该被杀"的进程）
2. 向该进程发送 `SIGKILL`，进程被强制终止
3. 进程占用的内存被释放，cgroup 内存用量回落
4. 容器退出，Pod 状态变为 `OOMKilled`

`memory.max` 和 `memory.high` 的核心区别在于手段：`max` 一过就杀，`high` 一过就卡住等待回收。前者是不可逆的进程终止，后者是可逆的瞬时节流。

**超出 `memory.low` 时的行为（回收优先级提升）**：

`memory.low` 不是一个"限制"，更像一个"保护声明"。当 cgroup 的内存使用低于 `memory.low` 时，这部分内存在全局内存压力下会被**尽力保护**，内核回收时会优先回收那些**超出自己 `memory.low`** 的 cgroup 的内存。

一旦使用的内存超过了 `memory.low`：
- 超出的部分和所有没有 `memory.low` 保护的 cgroup（`memory.low = 0`）处于同一回收优先级
- 节点内存压力越大，超出部分越可能被回收
- 但**低于 `memory.low` 的部分依然受到保护**，不会被轻易回收

### 完整路径示例

一个设置了 `requests.memory=256Mi, limits.memory=512Mi` 的容器，其 cgroup v2 实际路径和文件如下：

```bash
# 容器 cgroup 目录（containerd + systemd cgroup driver 示例）
/sys/fs/cgroup/kubepods.slice/
  kubepods-burstable.slice/
    kubepods-burstable-pod<uid>.slice/
      cri-containerd-<cid>.scope/

# 关键文件
cat /sys/fs/cgroup/.../cri-containerd-<cid>.scope/memory.max
# 536870912  (512MiB——limits.memory)

cat /sys/fs/cgroup/.../cri-containerd-<cid>.scope/memory.low
# 268435456  (256MiB——requests.memory)

cat /sys/fs/cgroup/.../cri-containerd-<cid>.scope/cpu.max
# "20000 100000"  (limits.cpu=200m 的场景)

cat /sys/fs/cgroup/.../cri-containerd-<cid>.scope/cpu.weight
# 1024  (requests.cpu=1 的场景)
```

### 完整行为对比总结

```
资源类型     K8s 配置          cgroup v2 文件    超出后行为
─────────────────────────────────────────────────────────────
CPU         limits.cpu        cpu.max           节流（throttle），剥夺时间片，进程变慢但不死
CPU         requests.cpu      cpu.weight        无"超出"概念，仅决定争抢时比例
Memory      limits.memory     memory.max        硬杀——OOM Kill，进程终止
Memory      - (节点层)        memory.high       节流——挂起+强制回收，进程不死
Memory      requests.memory   memory.low        回收优先级升高，超出部分优先被回收
```

**总结**：`limits` 对应硬边界（`cpu.max` / `memory.max`），超出后要么节流要么死；`requests` 对应软声明（`cpu.weight` / `memory.low`），决定的是"优先级"而非"天花板"。而 `memory.high` 作为第三维，在节点层面提供了"先勒紧不杀，给编排器反应时间"的缓冲机制。