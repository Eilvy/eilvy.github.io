---
title: 'Envoy WASM 入门：从零理解整个流程'
description: '从「为什么有它 → 是什么 → 怎么写 → 怎么跑起来 → 在网关里怎么串联」逐层讲清 Envoy WASM 插件：Envoy 与 Higress 的关系、proxy-wasm 规范、Go 插件如何注册回调、如何编译部署、请求在过滤器链里如何流转。'
pubDate: 2026-09-18
tags: ['Envoy', 'WASM', 'Higress']
categories: ['云原生', '网关']
author: 'eilvy'
---

> 面向对「Envoy WASM / 过滤器链」流程还比较模糊的同学，从**为什么有它 → 是什么 → 怎么写 → 怎么跑起来 → 在网关里怎么串联**逐层讲清楚。
>
> 内容基于一个企业级 AI 网关的真实配置与插件代码整理，已对仓库名与内部路径做泛化处理。
>
> 学完应该能回答：Envoy 是什么、WASM 为什么用在 Envoy 里、一个 Go 写的 WASM 插件从源码到在网关里生效经历了什么、多个插件如何串成一条过滤器链。

---

## 第一部分：先把大背景讲清楚

### 1.1 Envoy 是什么？

**Envoy** 是一个开源的**云原生边缘/服务代理**，用 C++ 写的，被很多网关/服务网格当数据面用（Istio、Higress、以及 AWS/Google 的很多网关都在用）。

它做的事本质是：**夹在客户端和后端服务中间，替它们接收请求、做各种处理、再转发到后端，把响应带回来。**

```
客户端 ──► [ Envoy 网关 ] ──► 后端服务（AI 供应商 / 微服务）
              ▲
       在这层做：鉴权、限流、路由、转发、审计……
```

### 1.2 Higress 又是什么？

**Higress** 是基于 Envoy 的**云原生 API 网关**（阿里开源）。它**用 Go + WASM 提供了一套插件体系**，让你不用写 C++ 就能给 Envoy 加功能。

> 一句话：**Envoy 是「引擎」，Higress 是「基于这个引擎造的车」，而 WASM 插件是给这辆车加的各种「功能配件」。**

### 1.3 为什么需要 WASM？

Envoy 原生加功能要用 **C++ 写 filter**，门槛高、编译重、上线要重启。WASM 解决了这个痛点：

- 用 **Go / Rust** 等安全语言写插件（不需要 C++）
- 插件编译成 **WASM 字节码**，在 Envoy 的**沙箱**里跑，崩溃不影响主进程
- 插件可**动态加载/替换**，不用重启 Envoy

---

## 第二部分：WASM 到底是什么

### 2.1 WASM（WebAssembly）一句话

WASM 是一种**可以在沙箱里高效运行的字节码格式**。它不是给人类写的，而是把 C/Go/Rust 等高级语言编译成的一种**可移植、安全、接近原生性能**的指令集。

```
Go 源码 ──编译──► .wasm 字节码 ──加载──► 沙箱执行
```

- **可移植**：同一个 `.wasm` 文件能在浏览器、Node、Envoy 等不同宿主跑
- **安全**：沙箱隔离，不能直接访问宿主内存，通过「宿主提供的 API」来交互
- **高性能**：有 JIT/AOT 编译优化，接近原生

### 2.2 proxy-wasm 是什么

**proxy-wasm** 是 Envoy 定制的 WASM 规范 —— 定义了「Envoy 和 WASM 插件之间怎么通信」的一组 API。

插件通过这组 API：

- 接收 Envoy 传来的请求事件（请求头、请求体、响应头……）
- 读取/修改请求和响应
- 调用 Envoy 的能力（发 HTTP 请求、读配置、读 filter state……）

**Higress 的 Go 插件用的 SDK**：

- `github.com/higress-group/proxy-wasm-go-sdk` —— 低层 proxy-wasm Go SDK
- `github.com/higress-group/wasm-go` —— Higress 封装的更友好的高层 SDK（`wrapper` 包就是它）

插件的 `go.mod` 里通常引用这两个，再加上 `tetratelabs/wazero`（一个纯 Go 的 WASM 运行时，测试时用）。

---

## 第三部分：一个 Go WASM 插件怎么写的

以审计日志插件 `ai-log` 为例。

### 3.1 插件入口：init() 注册回调

WASM 插件**没有 main 函数**（因为不是独立程序），而是通过 **`init()` 注册回调**，让 Envoy 在合适时机调用它。

```go
func main() {}   // 空 main，符合编译要求

func init() {
    wrapper.SetCtx(
        pluginName,
        wrapper.ParseConfig(config.ParseGlobalConfig),   // 1. 解析插件配置
        wrapper.ProcessRequestHeaders(onHttpRequestHeaders),          // 2. 注册各阶段回调
        wrapper.ProcessRequestBody(onHttpRequestBody),
        wrapper.ProcessResponseHeaders(onHttpResponseHeaders),
        wrapper.ProcessStreamingResponseBody(onStreamingResponseBody),
        wrapper.ProcessStreamDone(onHttpStreamDone),
        wrapper.ProcessResponseBody(onHttpResponseBody),
    )
}
```

### 3.2 各回调干什么

| 回调 | 阶段 | 在 ai-log 里做的事 |
|---|---|---|
| `onHttpRequestHeaders` | 请求头 | 记录请求到达时间、真实 IP |
| `onHttpRequestBody` | 请求体 | 拿请求体、存截断后的 payload |
| `onHttpResponseHeaders` | 响应头 | 记录状态码、判断流式/非流式、注入 trace 头 |
| `onStreamingResponseBody` | 流式响应体 | 逐 chunk 提取首 token 时间、token 用量、拼接 |
| `onHttpResponseBody` | 非流式响应体 | 拿完整 body 提取 token、响应文本 |
| `onHttpStreamDone` | 流结束 | 收尾日志 |

### 3.3 插件之间 / 回调之间怎么共享数据

两个机制（key 定义在 `shared/` 包里）：

1. **`wrapper.HttpContext`**（`ctx.SetContext` / `ctx.GetContext`）：**单插件内**跨回调传数据。比如 ai-log 在请求头阶段 `SetContext(CtxRequestTime, time)`，响应阶段再取出来用。

2. **Envoy Filter State**（`proxywasm.SetProperty` / `GetProperty`）：**跨插件**传数据。比如 key-auth 插件把用户身份写进 filter state，后面的 scheduler / ai-log 读取。

---

## 第四部分：插件怎么编译、怎么部署

### 4.1 编译

把 Go 源码编译成 WASM 字节码（wasip1 目标）：

```bash
cd 插件目录/ai-log
GOARCH=wasm GOOS=wasip1 go build -buildmode=c-shared -o ../../wasm/ai-log.wasm main.go
```

或者用顶层 Makefile 一键编译所有插件：

```bash
cd 插件目录
make build          # 编译全部插件 → wasm/*.wasm
make build ai-log   # 只编译单个
```

编译产物：`wasm/ai-log.wasm`，同目录还有 route-guard.wasm / key-auth.wasm / scheduler.wasm / rate-limiter.wasm / ai-proxy.wasm。

### 4.2 注册进 Envoy（关键：envoy.yaml）

**插件必须挂到 Envoy 的 HTTP 过滤器链里才会生效。** 这个配置在 `envoy.yaml.tmpl`。

结构如下（简化）：

```yaml
static_resources:
  listeners:
    - address: { socket_address: { port_value: 10000 } }   # 监听 10000 端口
      filter_chains:
        - filters:
            - name: envoy.filters.network.http_connection_manager   # HTTP 层
              typed_config:
                # ... route_config：路由规则（prefix / → dynamic_forward_proxy_cluster）
                http_filters:
                  - name: route-guard    # 第 1 个 WASM 插件
                    typed_config:
                      type_url: ...envoy.extensions.filters.http.wasm.v3.Wasm
                      value:
                        config:
                          name: route-guard
                          vm_config:
                            runtime: envoy.wasm.runtime.v8          # 用 V8 跑 WASM
                            code:
                              local: { filename: /opt/apps/wasm/route-guard.wasm }  # 加载字节码
                          configuration: { value: '{"allowedPrefixes":[...]}' }     # 插件配置
                  - name: key-auth      # 第 2 个插件（同结构）
                  - name: scheduler     # 第 3 个
                  - name: rate-limiter  # 第 4 个
                  - name: ai-proxy      # 第 5 个
                  - name: ai-log        # 第 6 个
                  - name: envoy.filters.http.router   # 最后必须是 router（转发用）
```

**要点**：

- `http_filters` 数组的**顺序就是过滤器链的执行顺序**
- 每个 WASM 插件通过 `type_url: ...Wasm` + `vm_config.code.local.filename` 指定 `.wasm` 文件
- `runtime: envoy.wasm.runtime.v8` 指定用 **V8 引擎**跑 WASM（Envoy 内置）
- `configuration.value` 是传给插件的配置（JSON）
- **链的最后一环必须是 `envoy.filters.http.router`**，它负责真正转发到上游（否则请求不会继续转发）

### 4.3 启动

```bash
make config   # 用模板 + 环境变量生成最终 envoy.yaml
make run      # 起 Docker Envoy，加载 wasm 插件
```

---

## 第五部分：一个请求在过滤器链里到底怎么流转

### 5.1 完整时序

```
客户端请求
   │
   ▼
[Listener :10000] 接收连接
   │
   ▼
[HTTP Connection Manager]
   │
   ▼
┌──────────────── HTTP 过滤器链（顺序执行）────────────────┐
│ 1. route-guard    : 白名单校验，未命中直接 404           │
│ 2. key-auth       : API Key 鉴权，写身份到 filter state  │
│ 3. scheduler      : 从 Redis 选上游模型/厂商/Token        │
│ 4. rate-limiter   : TPM/RPS 限流                          │
│ 5. ai-proxy       : 改写 path/host/auth 头，协议转换      │
│ 6. ai-log         : 采集审计数据（异步上报）              │
│ 7. router         : 真正转发到上游                        │
└──────────────────────────────────────────────────────────┘
   │
   ▼
[Cluster: dynamic_forward_proxy_cluster]
   │ 转发
   ▼
[上游 AI 供应商]
   │ 响应返回，再倒着经过过滤器链（encode 阶段）
   ▼
[客户端收到响应]
```

### 5.2 每个插件内部的时间线（以 ai-log 为例）

```
decode 阶段（请求方向）：
  onHttpRequestHeaders  ──► 记请求时间
  onHttpRequestBody     ──► 存 payload
[转发到上游]

encode 阶段（响应方向）：
  onHttpResponseHeaders ──► 记状态码、判断流式/非流式
   └─ 非流式：BufferResponseBody 缓冲完整 body → onHttpResponseBody
   └─ 流式：onStreamingResponseBody 逐 chunk 处理（提取 token/首字节时间）
  onHttpStreamDone ──► 流结束收尾
```

---

## 第六部分：几个关键机制

### 6.1 过滤器链的「执行顺序」由谁定？

由 **`envoy.yaml` 里 `http_filters` 数组的顺序**决定。改顺序 = 改执行顺序。网关侧路由等也是在这里配。

### 6.2 WASM 插件是「同步处理还是异步」？

回调函数本身**同步**执行（在一个请求的处理流程里），但**不能在回调里做阻塞的长操作**（如等一次外部 HTTP 响应返回）。所以像 ai-log 上报审计日志，用的是**异步 fire-and-forget** —— 发出去就不等结果。

### 6.3 插件崩溃了怎么办？

WASM 沙箱隔离 —— 单个插件 panic 不会崩掉 Envoy 主进程，只会影响该插件自身的处理（通常记录错误日志后继续/放行）。这正是用 WASM 隔离的核心价值。

### 6.4 body 太大怎么办？

- 非流式：`BufferResponseBody()` 缓冲，但受 Envoy buffer limit 限制
- 流式：逐 chunk 处理，攒批控制内存
- 实践中的做法：请求 payload 会**截断**，流式用**攒批**（`accumulateAndFlush`）

---

## 第七部分：一张图总结全流程

从写代码到在网关生效：

```
┌────────────── 开发期 ──────────────┐
│ Go 源码 (main.go + init 注册回调)    │
│   │                                 │
│   ▼ GOARCH=wasm GOOS=wasip1 编译    │
│ .wasm 字节码 (沙箱里跑)             │
└──────────────┬───────────────────────┘
               │ 部署
               ▼
┌────────────── 配置期 ──────────────┐
│ envoy.yaml.tmpl 里 http_filters     │
│ 挂到过滤器链对应位置 + 加载 .wasm    │
└──────────────┬─────────────────────┘
               │ make config & make run
               ▼
┌────────────── 运行期 ──────────────┐
│ Envoy :10000 收请求                │
│ → 按 http_filters 顺序过每个插件    │
│ → 每个插件通过 proxy-wasm API       │
│   收到请求/响应事件，做处理          │
│ → router 转发到上游                │
└────────────────────────────────────┘
```

---

## 快速自测

1. Envoy 和 Higress 什么关系？
2. WASM 为什么能安全地跑在 Envoy 里？（沙箱 + proxy-wasm API）
3. 一个 Go 插件怎么被 Envoy 调用？（init 注册回调 + http_filters 挂载）
4. 过滤器链顺序在哪定义？最后为什么必须有 router？
5. ai-log 里「跨插件传数据」和「插件内跨回调传数据」分别用什么？
6. 为什么审计上报要异步 fire-and-forget？

---

## 关键术语速查

| 术语 | 一句话 |
|---|---|
| Envoy | C++ 写的云原生代理/网关数据面 |
| Higress | 基于 Envoy 的 Go-WASM 云原生网关 |
| WASM | 可移植、沙箱化、高性能的字节码 |
| proxy-wasm | Envoy 与 WASM 插件间的通信规范/API |
| wasm-go SDK | Higress 封装的 Go 写插件的 SDK |
| Filter | Envoy 里的处理单元（有网络层/HTTP 层） |
| http_filters | HTTP 过滤器链，顺序 = 执行顺序 |
| router filter | 过滤器链最后转发用的 filter |
| Listener / Cluster / Route | 监听器 / 上游集群 / 路由规则 |
| Filter State | 跨插件共享数据（SetProperty / GetProperty） |
| HttpContext | 单插件内跨回调共享数据 |
