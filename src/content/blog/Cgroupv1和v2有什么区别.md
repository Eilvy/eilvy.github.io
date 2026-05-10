---
title: 'Cgroup v1 和 v2有什么区别'
description: '分析容器底层的原理'
pubDate: 2026-05-10
tags: ['Docker','Container','Linux']
categories: ['容器'，'计算机系统']
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

## 快速回顾

  v1 是早期增长式设计，每个 subsystem 自己竖一个树，混乱且特性停滞。v2 统一到单树，减少了一个 cgroup 目录 mkdir 点不够的问题，接口更规范，而且带来了 PSI、cgroup.freeze 等对容器编排非常有价值的原生能力。我的 my-GoDocker 使用 v2，核心接口是 `mkdir` → `echo pid > cgroup.procs` → 写入 `cpu.max`/`memory.max`/`io.weight` 等限制文件即可完成容器隔离。