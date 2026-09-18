/**
 * network-packet-flow-osi 一文的画板场景集合。
 *
 * 每个场景对应正文里的一张流程图，命名与文章小节一一对应。
 * 共享配色与布局件见 scene-kit.ts。
 *
 * ── 布局取舍 ──
 * 说明文字直接写进节点内部（多行 label），而不是单独放在箭头旁。
 * 原因是内嵌画布约 686×600，Excalidraw 的 fitToViewport 会按
 * 「完整装下内容」来缩放：若内容又窄又高（例如 640×900），
 * 就会被压得很小、文字难读。把说明并入节点后内容更接近画布比例，
 * 同一屏内文字更大更清楚。
 */

import { C, box, txt, hArrow, vStack, type El } from './scene-kit';

/* ─────────────────────────────────────────────
 * 第一跳：物理网卡 → 宿主机协议栈
 * ───────────────────────────────────────────── */
export const hop1Scene: El[] = [
	txt(40, 30, '第一跳：物理网卡 → 宿主机协议栈', 22),
	txt(42, 68, '包从网线进入内核，此时帧头仍在、三层信息完整', 13, C.muted),

	...vStack(
		[
			{ label: '物理网卡 eth0\nL1 物理层：电信号 / 光信号 → 比特流', fill: C.l1 },
			{ label: 'L2 数据链路层\nMAC 校验、剥离以太网帧头、触发硬中断', fill: C.l2 },
			{ label: '宿主机内核网络栈\nL2→L3：软中断 NAPI 收包，分配 sk_buff', fill: C.l3 },
			{ label: 'PREROUTING 钩子\nL3：目标 IP 不是本机 → 走 FORWARD', fill: C.l3 },
		],
		{ x: 40, y0: 120, w: 560, h: 76, gap: 52 }
	),

	txt(40, 610, '包的状态：以太网帧头仍在，三层信息完整，sk_buff 在宿主机内核中', 13, C.muted),
];

/* ─────────────────────────────────────────────
 * 第二跳：宿主机协议栈 → 网桥（含 FDB 查表）
 * ───────────────────────────────────────────── */
export const hop2Scene: El[] = [
	txt(40, 30, '第二跳：宿主机协议栈 → 网桥', 22),
	txt(42, 68, '网桥只看 MAC、不看 IP，是纯 L2 转发', 13, C.muted),

	...vStack(
		[
			{ label: '宿主机 FORWARD 路径\nL3 路由决策：目标 IP 属于 Pod 子网 → 出接口 cni0', fill: C.l3 },
			{ label: '网桥 cni0（二层虚拟交换机）\nL2：查 FDB 表（MAC → 出口端口）', fill: C.l2 },
		],
		{ x: 40, y0: 120, w: 560, h: 76, gap: 52 }
	),

	txt(40, 380, '查表结果决定两种走向：', 15),
	box(40, 410, 265, 92, '目标 MAC 命中\n→ 单播，帧从 vethA 口出去', C.l4),
	box(335, 410, 265, 92, '目标 MAC 未命中\n→ 泛洪到所有端口', C.warn),
	txt(40, 522, '（ARP 广播走的就是泛洪这条路）', 12, C.muted),
];

/* ─────────────────────────────────────────────
 * 第三跳：veth host 端 → veth pod 端
 * ───────────────────────────────────────────── */
export const hop3Scene: El[] = [
	txt(40, 30, '第三跳：veth host 端 → veth pod 端', 22),
	txt(42, 68, '没有真实物理层：内核函数调用 + 内存拷贝', 13, C.muted),

	...vStack(
		[
			{ label: 'veth host 端 —— vethA\nxmit() 被调用，内核直接找到对端 net_device 指针', fill: C.l2 },
			{ label: 'dev_forward_skb()\n整个以太网帧经内存传递，无电信号、无 DMA', fill: C.l2 },
			{ label: 'veth pod 端 = Pod 内 eth0\nL2：目标 MAC 匹配 → 剥离帧头，上送 L3', fill: C.l2 },
		],
		{ x: 40, y0: 120, w: 560, h: 76, gap: 52 }
	),

	txt(40, 530, '本质：不是物理发送，而是内核里的函数调用 + sk_buff 内存传递', 14, C.emphasis),
];

/* ─────────────────────────────────────────────
 * 第四跳：Pod 内协议栈 → 应用进程
 * ───────────────────────────────────────────── */
export const hop4Scene: El[] = [
	txt(40, 30, '第四跳：Pod 内协议栈 → 应用进程', 22),
	txt(42, 68, '从内核态一路走到用户态', 13, C.muted),

	...vStack(
		[
			{ label: 'Pod 协议栈 PREROUTING\nL3：Service DNAT 在此生效（ClusterIP → Pod IP）', fill: C.l3 },
			{ label: 'INPUT 路径\nL3：INPUT 钩子，NetworkPolicy 可在此过滤', fill: C.l3 },
			{ label: 'L4 传输层\n解 TCP/UDP 头，查 socket 五元组；校验序列号与 ACK', fill: C.l4 },
			{ label: 'socket 接收缓冲区\n数据放入缓冲区，等待应用读取', fill: C.l4 },
			{ label: '应用进程\nL5–L7：内核态→用户态，read()/recv() 取数据，HTTP/gRPC/DNS 解析', fill: C.l5 },
		],
		{ x: 40, y0: 120, w: 560, h: 72, gap: 48 }
	),
];

/* ─────────────────────────────────────────────
 * veth pair 跨端转发的内核实现（结构示意）
 * ───────────────────────────────────────────── */
export const vethKernelScene: El[] = [
	txt(40, 30, 'veth pair 跨端转发：内核里的实现', 22),
	txt(42, 68, '一对 net_device 之间由「虚拟数据通道」相连', 13, C.muted),

	box(40, 120, 210, 96, 'veth host 端', C.l2),
	box(430, 120, 210, 96, 'veth pod 端', C.l2),

	/*
	 * 两端之间的双向箭头（xmit 直接调用对端 rx）。
	 * 标注走箭头内置 label；label 过大会换行盖住箭头，所以这里同时：
	 *   1) 把箭头间距放宽到 220px（原来 100px 太窄，长文字会折成三行）
	 *   2) 标注只留核心短语，细节移到下方正文
	 */
	hArrow(250, 430, 168, C.emphasis, 'xmit() 调用对端 rx()'),

	txt(40, 250, '关键：不是物理发送，是内核函数调用 + 内存拷贝', 15),
	box(40, 300, 600, 88, 'sk_buff 交给对端协议栈处理（必要时才 clone / copy）', C.neutral, 14),
];
