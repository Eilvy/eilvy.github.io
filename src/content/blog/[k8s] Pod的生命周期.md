---
title: 'Pod的生命周期'
description: '分析Pod从提交yaml开始到成功创建的流程'
pubDate: 2026-05-13
tags: ['k8s']
categories: ['k8s']
author: 'eilvy'
---

> 这个问题需要**按时间线把各组件的协作关系讲清楚**，同时能深入到 informer/watch 机制层面。

### 总述

> Pod 从创建到 Running，本质上是 **API Server 持久化 → Scheduler 调度 → Kubelet 调和 → CRI/CNI/CSI 三板斧落地** 的串行链路，整个过程由各个组件的 watch 机制驱动。

### **1. 准入与持久化（API Server + etcd）**

`kubectl apply` 把 Pod YAML 以 JSON 格式 POST 到 API Server。API Server 先过 **Authentication → Authorization → Admission Controllers**（Mutating 先改、Validating 后验）。比如 Mutating 阶段可能注入 sidecar 或设置默认资源限制，Validating 阶段检查字段合法性。全部通过后，Pod 对象序列化写入 **etcd**，此时 Pod 的 `status.phase` 为空，`spec.nodeName` 也为空。

### **2. 调度（Scheduler）**

Scheduler 通过 **Informer watch** 到 etcd 中出现了 `spec.nodeName` 为空且未被删除的 Pod，放入调度队列。调度分两阶段：

- **预选（Filtering）**：过滤掉不满足条件的 Node——资源不够的、有污点不匹配的、NodeSelector/Affinity 不满足的、端口冲突的全部干掉。
- **优选（Scoring）**：对剩余 Node 打分，综合 LeastRequestedPriority、BalancedResourceAllocation、NodeAffinityPriority 等策略，分数最高的胜出。

选定 Node 后，Scheduler 通过 API Server 把 Pod 的 `spec.nodeName` 写回 etcd。注意这是个 **乐观并发更新**，如果写回时发现 Pod 已被其他调度器绑定（ResourceVersion 冲突），则放弃重试。

### **3. 容器创建（Kubelet + CRI）**

目标 Node 上的 Kubelet 同样通过 Informer watch 到了 `spec.nodeName` 指向自己的 Pod。Kubelet 的 syncLoop 开始处理这个 Pod：

- **创建 PodSandbox（pause 容器）**：通过 CRI 调用容器运行时（containerd/dockerd），先起一个极简的 `pause` 容器。这个容器什么都不做，只 hold 住 Network Namespace 和 IPC Namespace，后续业务容器全部共享它的 NS。这是「一个 Pod 一个网络栈」的关键。
- **CNI 网络配置**：调用 CNI 插件（Calico/Flannel/Cilium）为 pause 容器分配 IP、创建 veth pair、配置路由和 iptables 规则。这时候 Pod IP 就确定了。
- **CSI 卷挂载**：如果有 PV/PVC，调用 CSI 驱动完成 Attach → Mount 流程。注意挂载发生在 Pod 到 Node 的绑定之后，不是在 Scheduler 阶段。

### **4. 镜像拉取与容器启动**

Kubelet 根据 Pod 的 `imagePullPolicy` 决定拉取策略。然后按顺序启动：

- **Init Containers**（如果有）：串行执行，前一个成功才跑下一个。
- **业务 Containers**：并行启动，每个容器通过 `setns` 加入到 pause 容器的 Namespace 中。

启动后 Kubelet 执行配置的探针：

- **Startup Probe** 先跑（如果配了），通过后才会启动 Liveness/Readiness。
- **Readiness Probe** 通过后，Pod 的 Ready Condition 变为 True，Service 的 Endpoints 才会把该 Pod IP 加入后端列表。

### **5. 状态回写**

Kubelet 持续通过 API Server 把 `pod.status` 写回 etcd，更新 conditions 和 containerStatuses。用户 `kubectl get pod` 看到的状态就是从 etcd 读出来的。

------

### 总结

> 整个链路本质上是 **Informer + List-Watch + 调谐循环** 的经典模式：每个组件只关心自己的前置条件是否满足，条件满足就干活、干完就更新 status，下一个组件自然被触发，最终收敛到 Running。

