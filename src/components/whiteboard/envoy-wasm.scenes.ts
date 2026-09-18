/**
 * 《Envoy WASM 入门》一文的画板场景集合。
 *
 * 只把**复杂**流程图改为画板；一句话级别的示意图（如
 * 「Go 源码 → .wasm → 沙箱」）保留原文的代码块形式，不必为它加载 1MB 的
 * Excalidraw 运行时。
 *
 * 覆盖：
 *   1. 过滤器链完整时序（请求正序 / 响应倒序）
 *   2. 单插件内部时间线（ai-log 的 decode / encode 两阶段与流式分支）
 *   3. 从写代码到在网关生效的三阶段总览
 *
 * 配色与布局件见 scene-kit.ts，绘制规范见 docs/WHITEBOARD_GUIDE.md。
 */

import { C, box, txt, vArrow, hFlow, arrowTo, groupFrame, type El } from './scene-kit';

/* ─────────────────────────────────────────────
 * 一、过滤器链完整时序
 *
 * 竖直主链路（客户端 → Listener/HCM → 过滤器链 → Cluster → 上游），
 * 右侧一条向上的回路表示响应倒序返回。
 *
 * 回路的竖向箭头放在 x=645（范围框右边缘 590 之外），
 * 避免它的 label 压到范围框 —— 这是画板里最容易踩的坑之一。
 * ───────────────────────────────────────────── */
export const filterChainScene: El[] = [
	txt(30, 30, 'HTTP 过滤器链：请求正序、响应倒序', 22),
	txt(32, 68, 'http_filters 数组的顺序就是执行顺序', 13, C.muted),

	// ── 主链路
	box(100, 100, 420, 56, '客户端请求', C.input, 15),
	vArrow(310, 156, 182),
	box(100, 182, 420, 56, 'Listener :10000\nHTTP Connection Manager', C.engine, 13),
	vArrow(310, 238, 264),

	txt(40, 268, 'HTTP 过滤器链（顺序执行）', 13, C.muted),
	groupFrame(30, 290, 560, 272),

	box(45, 302, 530, 32, '1. route-guard      白名单校验，未命中直接 404', C.control, 13),
	box(45, 338, 530, 32, '2. key-auth         API Key 鉴权，身份写入 filter state', C.control, 13),
	box(45, 374, 530, 32, '3. scheduler        从 Redis 选上游模型 / 厂商 / Token', C.control, 13),
	box(45, 410, 530, 32, '4. rate-limiter     TPM / RPS 限流', C.control, 13),
	box(45, 446, 530, 32, '5. ai-proxy         改写 path / host / auth 头，协议转换', C.control, 13),
	box(45, 482, 530, 32, '6. ai-log           采集审计数据（异步上报）', C.control, 13),
	box(45, 518, 530, 32, '7. router           真正转发到上游', C.output, 13),

	vArrow(310, 562, 588),
	box(100, 588, 420, 56, 'Cluster: dynamic_forward_proxy_cluster', C.engine, 13),
	vArrow(310, 644, 670),
	box(100, 670, 420, 56, '上游 AI 供应商', C.output, 15),

	// ── 响应回路（右侧向上）
	arrowTo(520, 698, 645, 698, C.muted),
	vArrow(645, 698, 128, C.muted, '响应倒序'),
	arrowTo(645, 128, 520, 128, C.muted),

	txt(40, 750, '响应在 encode 阶段沿同一链倒序返回，所以插件的响应回调顺序与请求相反', 13, C.muted),
];

/* ─────────────────────────────────────────────
 * 二、单插件内部时间线（ai-log）
 *
 * 两个阶段竖直排列；encode 阶段的「流式 / 非流式」分支用斜箭头展开，
 * 再汇合到 onHttpStreamDone。分支是这张图的重点，所以用颜色区分。
 * ───────────────────────────────────────────── */
export const pluginTimelineScene: El[] = [
	txt(30, 30, '单插件内部时间线（以 ai-log 为例）', 22),
	txt(32, 68, '回调本身同步执行；耗时的上报要异步 fire-and-forget', 13, C.muted),

	// ── decode 阶段
	txt(40, 100, 'decode 阶段（请求方向）', 14, C.muted),
	box(40, 124, 560, 44, 'onHttpRequestHeaders —— 记请求到达时间、真实 IP', C.control, 13),
	box(40, 176, 560, 44, 'onHttpRequestBody —— 拿请求体、存截断后的 payload', C.control, 13),
	vArrow(320, 220, 246),
	box(190, 246, 260, 44, '转发到上游', C.engine, 13),

	// ── encode 阶段
	txt(40, 316, 'encode 阶段（响应方向）', 14, C.muted),
	box(40, 340, 560, 44, 'onHttpResponseHeaders —— 记状态码、判断流式/非流式、注入 trace 头', C.control, 13),

	// 分支：流式 / 非流式
	arrowTo(320, 384, 180, 424, C.stroke),
	arrowTo(320, 384, 460, 424, C.stroke),
	box(40, 424, 280, 56, '非流式\nBufferResponseBody → onHttpResponseBody', C.warn, 12),
	box(340, 424, 260, 56, '流式\nonStreamingResponseBody 逐 chunk', C.pod, 12),

	// 汇合
	arrowTo(180, 480, 320, 516, C.stroke),
	arrowTo(460, 480, 320, 516, C.stroke),
	box(40, 516, 560, 44, 'onHttpStreamDone —— 流结束收尾', C.control, 13),
];

/* ─────────────────────────────────────────────
 * 三、从写代码到在网关生效
 *
 * 三个阶段各用一个虚线框圈出，框内是该阶段的事。
 * 阶段之间用带 label 的竖箭头连接（label 短，不会折行）。
 * ───────────────────────────────────────────── */
export const lifecycleScene: El[] = [
	txt(30, 30, '从写代码到在网关生效', 22),
	txt(32, 68, '开发期 → 配置期 → 运行期', 13, C.muted),

	/*
	 * 阶段之间的间距要留足：箭头上的 label 是**居中且不换行**的，
	 * 若箭头比文字还短，label 会把箭头整根盖住（实测 32px 的间距下
	 * 「make config & make run」几乎把箭头遮没）。
	 * 这里把阶段间距放到 96px，并把 label 缩短到能放下的长度。
	 */
	// ── 开发期
	txt(40, 100, '开发期', 15),
	groupFrame(30, 122, 620, 118),
	box(50, 142, 250, 60, 'Go 源码\nmain.go + init 注册回调', C.control, 13),
	hFlow(300, 350, 172, C.stroke),
	box(350, 142, 280, 60, '.wasm 字节码\nGOARCH=wasm GOOS=wasip1', C.output, 13),

	vArrow(340, 240, 336, C.stroke, '部署'),

	// ── 配置期
	txt(40, 346, '配置期', 15),
	groupFrame(30, 368, 620, 100),
	box(50, 388, 580, 60, 'envoy.yaml.tmpl 的 http_filters\n挂到过滤器链对应位置 + 加载 .wasm', C.control, 13),

	vArrow(340, 468, 604, C.stroke, 'make config / run'),

	// ── 运行期
	txt(40, 614, '运行期', 15),
	groupFrame(30, 636, 620, 160),
	box(50, 656, 580, 40, 'Envoy :10000 收请求', C.engine, 13),
	box(50, 704, 580, 40, '按 http_filters 顺序过每个插件（proxy-wasm API 收事件）', C.control, 13),
	box(50, 752, 580, 40, 'router 转发到上游', C.output, 13),
];
