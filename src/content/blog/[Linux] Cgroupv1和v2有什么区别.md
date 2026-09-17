---
title: 'Cgroup v1 和 v2有什么区别'
description: '分析容器底层资源限制分配的原理'
pubDate: 2026-05-10
updatedDate: 2026-09-17
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
| **内部进程规则**               | 无限制，中间节点也能直接挂进程，父子限制相互干扰 | **No Internal Process Rule**：一个 cgroup 只要有子节点，它自己就不能直接放进程 |
| **控制器启用**                 | 挂载时全局指定并自动继承，子节点无法选择性启用 | **按需启用**，写父节点 `cgroup.subtree_control` 决定子节点能用哪些控制器 |
| **委托授权**                   | 粗糙，把子目录权限交给用户后，用户可以随意改 `tasks` 绕过限制 | **精细化**，被委托的用户只能在授权子树内、只能使用被授权的控制器 |
| **IO 控制器**                  | `blkio`，只对直接 IO（Direct IO）生效 | `io`，直接 IO 与缓冲 IO（Buffered IO）都支持，限制更完整 |
| **挂载方式**                   | `mount -t cgroup -o cpu,memory none /sys/fs/cgroup/cpu_mem` | `mount -t cgroup2 none /sys/fs/cgroup` |
| **内核版本**                   | 2.6.24+                                                      | 4.5+（成熟于 5.x）                                           |

## 拆开来看：三个最本质的变化

表格容易过目即忘，下面把最值得深挖的三点单独拎出来。

### 1. 层级结构：从「多树多挂载」到「单根树」

v1 里每个控制器（subsystem）都有自己独立的一棵树：

```
/sys/fs/cgroup/
├── cpu/                    ← cpu 控制器一棵树
│   ├── docker/
│   │   └── containerid/
│   └── kubepods/
├── memory/                 ← memory 控制器另一棵树
│   ├── docker/
│   │   └── containerid/
│   └── kubepods/
├── blkio/                  ← 又一棵树
├── pids/                   ← 又一棵树
└── ...
```

同一个进程可以同时挂在多棵树上——在 cpu 树的 `docker/xxx` 里，同时在 memory 树的 `docker/xxx` 里。**内核并不强制这些路径保持一致**，所以同一容器在不同控制器树下的位置可能不同，管理自然容易混乱：「限了 CPU 忘了限内存」这种不一致状态就是从这里来的。

v2 只有一棵树，所有控制器的限制都写在同一个 cgroup 目录下的不同文件里：

```
/sys/fs/cgroup/             ← 只有一棵树
├── cgroup.controllers      ← 这棵树启用了哪些控制器
├── docker/
│   └── containerid/
│       ├── cpu.max         ← CPU 限制写这里
│       ├── memory.max      ← 内存限制写这里
│       ├── io.max          ← IO 限制写这里
│       └── pids.max        ← PID 限制写这里
└── kubepods/
    └── podxxx/
        ├── cpu.max
        └── memory.max
```

一个进程只能属于一个 cgroup 节点，所有控制器的限制天然聚合在一起，一致性由内核强制保证。

### 2. 进程归属：从「多处注册」到「全局唯一」

v1 下进程是按树分别登记的，写的是各树的 `tasks` 文件：

```
进程 PID=1234:
  ├── cpu 树:    /sys/fs/cgroup/cpu/docker/xxx/tasks      ← 在这里
  ├── memory 树: /sys/fs/cgroup/memory/docker/xxx/tasks   ← 也在这里
  └── blkio 树:  /sys/fs/cgroup/blkio/docker/xxx/tasks    ← 还在这里
```

要看一个进程的完整资源限制，得跑好几个不同目录去拼，还要假设它们确实对齐。

v2 下归属只有一处：

```
进程 PID=1234:
  └── /sys/fs/cgroup/docker/xxx/cgroup.procs   ← 唯一归属
```

内核直接杜绝了「CPU 在 A 组、memory 在 B 组」这种状态。顺带的好处是容器运行时变简单了：建一个目录，把进程写进 `cgroup.procs`，限制文件全在同级目录，不用跨多棵树操作。

### 3. No Internal Process Rule（最容易被追问的约束）

> **一个 cgroup 只要有了子 cgroup，它自己就不能直接放进程。**要么纯粹当中间节点，要么纯粹当叶子节点。

```
✅ v2 合法:
/docker/            ← 中间节点，不放进程
  ├── container1/   ← 叶子节点，放进程
  │   └── cgroup.procs
  └── container2/   ← 叶子节点，放进程
      └── cgroup.procs

❌ v2 不合法:
/docker/            ← 有子节点却直接放了进程
  ├── cgroup.procs  ← 违反 No Internal Process Rule
  └── container1/
```

这样设计的原因是：如果父节点既挂了进程又有子节点，父节点的限制会传导影响子节点，而子节点又有自己的限制，两套规则的叠加语义很难讲清楚，资源分配容易打架。v1 没有这条限制，代价就是父子限制互相干扰、行为难以预期。这条规则在实操上最直接的后果是——**不能像 v1 那样随手往根 cgroup 塞进程**，中间层必须保持「干净」。

## 控制器的启用、PSI 与线程化

### 按需启用控制器

v1 在挂载时就固定了控制器集合，子 cgroup 自动继承父节点的全部控制器，**不能选择性启用**：父节点如果同时开了 cpu+memory，子节点没法只要 cpu 不要 memory。

v2 改成显式控制，靠一个 `cgroup.subtree_control` 文件：

```bash
# 查看根 cgroup 支持哪些控制器
cat /sys/fs/cgroup/cgroup.controllers
# 输出: cpu io memory pids rdma

# 在子 cgroup 中启用需要的控制器（写父节点的 cgroup.subtree_control）
echo "+cpu +memory" > /sys/fs/cgroup/cgroup.subtree_control

# 此时子节点才会有 cpu.max / memory.max
```

写法上 `+` 表示启用、`-` 表示关闭。这也是 v2 委托机制的基础。

### PSI：内核态压力感知（v2 独有）

PSI（Pressure Stall Information）是 v2 最有用的新增能力之一，它回答的问题是「**有多少时间因资源不足而空转**」，而不只是「用了多少资源」：

```bash
cat /sys/fs/cgroup/.../cpu.pressure
# some avg10=1.20 avg60=0.80 avg300=0.50 total=12345678
# full avg10=0.80 avg60=0.50 avg300=0.30 total=9876543
```

| 指标 | 含义 |
|---|---|
| `some` | **至少有一个**任务在等待资源的时间占比 |
| `full` | **所有**任务都在等待资源的时间占比（更严重，通常意味着实际吞吐已经掉了） |

`avg10/avg60/avg300` 是 10 秒 / 60 秒 / 300 秒的滑动平均，`total` 是累计微秒数。三个资源都有对应文件：`cpu.pressure`、`memory.pressure`、`io.pressure`。

v1 之所以拿不到这套指标，根子还是在架构：压力数据天然需要跨控制器聚合，而 v1 每个控制器各自一棵树，没有统一入口。v2 的单树结构才让「同一 cgroup 下所有资源的压力」可以被聚合计算。

实际用法上，`memory.pressure` 的 `full` 值持续抬升，基本就说明内存瓶颈已经把所有任务都卡住了，是该扩容或调整 limits 的信号——这比等到 OOM Kill 再反应要早得多。

### 线程化 cgroup（Threaded Mode，v2 独有）

v1 的 cgroup 最小管理单位是进程（TGID），想单独限制某个线程做不到——往 `tasks` 写单个 TID 语义混乱，多线程程序「只限制其中一个线程的 CPU」这种需求基本无法表达。

v2 用显式的 threaded 模式解决：

```bash
# 把某个 cgroup 标记为 threaded 模式
echo threaded > /sys/fs/cgroup/app/worker/cgroup.type

# 现在可以用 TID 写入 cgroup.threads（而非 cgroup.procs）
echo $TID > /sys/fs/cgroup/app/worker/cgroup.threads
```

注意进程写 `cgroup.procs`、线程写 `cgroup.threads`，两者分开，语义清晰。对多线程应用做 CPU 隔离（比如把某些 worker 线程固定到一段 CPU 上）时很有用。

## 接口文件对照与实操

| 功能 | v1 文件 | v2 文件 |
|---|---|---|
| CPU 限制 | `cpu.cfs_quota_us` + `cpu.cfs_period_us` | `cpu.max`（格式：`quota period`） |
| CPU 共享 | `cpu.shares` | `cpu.weight`（范围 1–10000） |
| 内存上限 | `memory.limit_in_bytes` | `memory.max` |
| 内存使用量 | `memory.usage_in_bytes` | `memory.current` |
| IO 限制 | `blkio.throttle.read_bps_device` | `io.max`（格式：`MAJ:MIN rbps=BYTES`） |
| PID 限制 | `pids.max` | `pids.max`（同名，但路径不同） |
| 添加进程 | `tasks` | `cgroup.procs` |
| 控制器列表 | 各树各自存在 | `cgroup.controllers` |

```bash
# v1 限制 CPU 为 1 核：要写两个文件
echo 100000 > /sys/fs/cgroup/cpu/docker/xxx/cpu.cfs_quota_us
echo 100000 > /sys/fs/cgroup/cpu/docker/xxx/cpu.cfs_period_us

# v2 限制 CPU 为 1 核：一行搞定
echo "100000 100000" > /sys/fs/cgroup/docker/xxx/cpu.max

# v1 限制内存 512MB
echo 536870912 > /sys/fs/cgroup/memory/docker/xxx/memory.limit_in_bytes

# v2 限制内存 512MB
echo 536870912 > /sys/fs/cgroup/docker/xxx/memory.max
```

v2 的接口更简洁：一个文件承担一个限制，不像 v1 设 CPU 要 quota + period 成对写才生效。

## 委托与授权（Delegation）

v1 的委托很粗糙：把某个子目录的权限交给用户，但用户依然可以随意改 `tasks` 等文件，限制容易被绕过。

v2 把委托建立在 `cgroup.subtree_control` 之上，能精确控制子树里能用哪些控制器：

```bash
# root 授权给用户：这个子树只能用 cpu 和 memory
echo "+cpu +memory" > /sys/fs/cgroup/user.slice/cgroup.subtree_control
```

被委托的非 root 用户只能在自己被授权的子树内操作，也启用不了未授权的控制器。systemd 把 `/sys/fs/cgroup/user.slice` 交给用户 session 管理，用的就是这套机制——这也是为什么 v2 下 `systemd --user` 能独立管理自己的资源分组。

## 怎么判断当前系统在用哪个版本

```bash
# 看 /sys/fs/cgroup 的文件系统类型
stat -fc %T /sys/fs/cgroup
# cgroup2fs → v2
# tmpfs     → v1（也可能是混合模式）

# 更直接：cgroup.controllers 是 v2 独有的
ls /sys/fs/cgroup/cgroup.controllers
```

Docker / K8s 切到 v2 的常见做法：

- Docker 20.10+：`/etc/docker/daemon.json` 里配 `"native.cgroupdriver": "systemd"`（systemd 默认走 v2）。
- K8s 1.25+：cgroup v2 已 GA，kubelet 自动检测。
- 底层要求：内核 5.10+ / systemd 247+ / containerd 1.5+。

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

---

## 几个常见追问

**为什么 v1 一定要被 v2 取代？**

最核心的问题是「多树多挂载导致管理不一致」：一个容器在不同控制器树下路径可能不同，容易出现「限了 CPU 忘了限内存」。v2 用统一树 + 进程唯一归属把这个不一致从根上消掉了，顺带补上了 PSI、线程级控制、精细委托这些 v1 结构上做不了的能力。

**为什么 No Internal Process Rule 要这么设计？**

如果父节点既挂了进程又有子节点，父节点的限制会传导影响子节点，而子节点又有自己的限制，两套规则叠加后的语义很难说清，资源分配会打架。强制「要么中间节点、要么叶子节点」，层级关系才是干净可推理的。代价是根 cgroup 不能随便塞进程——systemd 会把进程都放进 `.slice` 末端的 `.scope` 里，就是为了满足这个约束。

**v2 的 IO 控制比 v1 强在哪？**

v1 的 `blkio` 只能限制**直接 IO**（Direct IO），对缓冲 IO（Buffered IO，也就是普通文件读写）基本无效。v2 的 `io` 控制器同时覆盖直接 IO 和缓冲 IO，限制更完整。这对数据库、日志密集型这类以缓冲写为主的应用差别很实在。

**v1 到 v2 迁移时最容易踩的坑是什么？**

两处：一是接口文件全变了，任何直接读写 cgroup 文件的脚本和监控都要改（`cpu.cfs_quota_us` → `cpu.max`、`memory.usage_in_bytes` → `memory.current`）；二是根 cgroup 不能再放进程，把进程挂在根节点的老做法在 v2 下会直接失败。

## 参考资料

- 内核文档：[Control Group v2](https://docs.kernel.org/admin-guide/cgroup-v2.html)、[cgroup v1](https://docs.kernel.org/admin-guide/cgroup-v1/index.html)
- [PSI（Pressure Stall Information）](https://docs.kernel.org/accounting/psi.html)
- Kubernetes：[About cgroup v2](https://kubernetes.io/docs/concepts/architecture/cgroups/)