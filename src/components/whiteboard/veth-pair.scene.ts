/**
 * 「veth pair 拓扑」画板场景（只读）。
 *
 * 对应 network-packet-flow-osi 中原来的 ASCII 图：
 * 宿主机侧的 veth 端插在网桥上，Pod 侧是 eth0，两端由同一对 veth 连通。
 *
 * 配色与布局件见 scene-kit.ts（含「不要为暗色另写一套配色」的说明）。
 */

import { C, box, txt, hArrow, vArrow, type El } from './scene-kit';

/** 宿主机侧 veth 网卡 */
const hostVeth = { x: 60, y: 140, w: 200, h: 92 };
/** Pod 侧 eth0 */
const podEth0 = { x: 460, y: 140, w: 200, h: 92 };
/** 网桥 */
const bridge = { x: 60, y: 350, w: 200, h: 84 };

export const vethPairScene: El[] = [
	txt(60, 40, 'veth pair：一根线两个头', 24),
	txt(62, 82, '宿主机侧 vethXXXX 插在网桥，Pod 侧即 eth0', 13, C.muted),

	// ── 两端网卡
	box(hostVeth.x, hostVeth.y, hostVeth.w, hostVeth.h, 'vethXXXX\n（宿主机侧 host 端）', C.l2, 16),
	box(podEth0.x, podEth0.y, podEth0.w, podEth0.h, 'eth0\n（Pod 侧 pod 端）', C.l4, 16),

	// ── 中间的虚拟数据通道（双向）
	hArrow(hostVeth.x + hostVeth.w, podEth0.x, hostVeth.y + hostVeth.h / 2, C.emphasis),
	txt(300, 248, '虚拟数据通道', 14, C.emphasis),

	// ── 网桥
	box(bridge.x, bridge.y, bridge.w, bridge.h, 'cni0 / docker0 网桥', C.l2, 16),

	// 宿主机侧网卡 → 网桥
	vArrow(hostVeth.x + hostVeth.w / 2, hostVeth.y + hostVeth.h, bridge.y),
	txt(290, 280, 'host 端插在网桥上', 14, C.muted),

	txt(60, 480, '数据从一端写入，另一端立即可读 —— 内核里是一对相连的虚拟网卡', 14, C.muted),
];
