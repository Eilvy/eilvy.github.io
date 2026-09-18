/**
 * [k8s] Service 一文的画板场景集合。
 *
 * 覆盖原文中能用图表达的部分：
 *   1. ClusterIP：VIP → DNAT → Pod（虚拟 IP 只存在于规则表里）
 *   2. NodePort：入站包走 PREROUTING、集群内走 OUTPUT，两条链都要写规则
 *   3. LoadBalancer：云 LB → NodePort → Pod，以及 Cluster / Local 两种策略
 *   4. iptables 模式：链式匹配，O(n) 线性遍历
 *   5. IPVS 模式：哈希表直查 O(1)，但 SNAT / NodePort 仍回退 iptables
 *   6. 模式对比：链表 vs 哈希表
 *
 * 配色与布局件见 scene-kit.ts（含「不要为暗色另写一套配色」的说明）。
 */

import { C, box, txt, hFlow, vArrow, arrowTo, type El } from './scene-kit';

/* ─────────────────────────────────────────────
 * 一、ClusterIP：虚拟 IP 的 DNAT 过程
 * ───────────────────────────────────────────── */
export const clusterIpScene: El[] = [
	txt(40, 30, 'ClusterIP：虚拟 IP 怎么变成真实 Pod IP', 22),
	txt(42, 68, 'ClusterIP 没有实体网卡，只存在于 iptables/IPVS 规则里', 13, C.muted),

	// 请求方 → 虚拟 IP → 规则表 → 后端 Pod
	box(40, 130, 150, 84, '集群内 Pod\n发起请求', C.external, 14),
	box(240, 130, 150, 84, 'ClusterIP\n10.96.x.x:80', C.rule, 14),
	box(440, 130, 170, 84, '宿主机内核\nDNAT 规则', C.node, 14),

	hFlow(190, 240, 172, C.stroke),
	hFlow(390, 440, 172, C.stroke, '命中'),

	// 后端三选一：箭头要一直指到 Pod 行顶边（y=306），
	// 早先只画到 268，终点悬在 Pod 上方的空白里
	vArrow(525, 214, 306, C.emphasis),
	// 说明文字放在箭头右侧，避免被 x=525 的竖直箭头穿过
	txt(548, 288, '按规则分发到其中一个后端', 13, C.muted),
	box(400, 306, 105, 70, 'PodA', C.pod, 14),
	box(517, 306, 105, 70, 'PodB', C.pod, 14),
	box(634, 306, 105, 70, 'PodC', C.pod, 14),

	// 关键说明
	txt(40, 300, '三个要点：', 15),
	txt(40, 330, '· etcd 存 Service → EndpointSlice 映射', 13, C.muted),
	txt(40, 354, '· kube-proxy watch 变化，写入 DNAT 规则', 13, C.muted),
	txt(40, 378, '· 每个 Node 独立完成，不回源到 APIServer', 13, C.muted),
	txt(40, 410, 'ping ClusterIP 不通：只对特定 port 做 DNAT，ICMP 不匹配任何规则', 13, C.emphasis),
];

/* ─────────────────────────────────────────────
 * 二、NodePort：两条入口链
 * ───────────────────────────────────────────── */
export const nodePortScene: El[] = [
	txt(40, 30, 'NodePort：外部与集群内走不同的链', 22),
	txt(42, 68, 'kube-proxy 必须在两条链上都写规则，才能保证无论来源都命中', 13, C.muted),

	// 两个来源
	box(40, 120, 200, 76, '集群外部请求\nNodeIP:NodePort', C.external, 14),
	box(40, 300, 200, 76, '集群内 Pod\n访问同一端口', C.external, 14),

	// 两条链
	box(330, 120, 190, 76, 'PREROUTING 链', C.node, 15),
	box(330, 300, 190, 76, 'OUTPUT 链', C.node, 15),
	hFlow(240, 330, 158, C.stroke),
	hFlow(240, 330, 338, C.stroke),

	/*
	 * 汇合到 DNAT：两条链的出口在方框左右两侧的上/下，
	 * 必须用斜箭头才能真正「指到」方框 ——
	 * 早先用 hFlow 画水平线，终点落在方框外的空白处（箭头指向空）。
	 */
	box(600, 210, 180, 76, 'NodePort DNAT\n→ PodIP:Port', C.rule, 14),
	arrowTo(520, 158, 600, 232, C.stroke),
	arrowTo(520, 338, 600, 264, C.stroke),

	// 策略说明
	txt(40, 420, 'externalTrafficPolicy 的取舍：', 15),
	box(40, 450, 350, 92, 'Cluster（默认）\n跨 Node 二次转发；源 IP 被 SNAT 换成宿主机 IP', C.neutral, 13),
	box(410, 450, 350, 92, 'Local\n不 SNAT、保留源 IP；但流量只到本机 Pod，可能负载不均', C.warn, 13),
];

/* ─────────────────────────────────────────────
 * 三、LoadBalancer：外挂云 LB
 * ───────────────────────────────────────────── */
export const loadBalancerScene: El[] = [
	txt(40, 30, 'LoadBalancer：在 NodePort 之上外挂云负载均衡', 22),
	txt(42, 68, '云控制器创建 LB 实例，其监听端口绑定所有 Node 的 NodePort', 13, C.muted),

	box(40, 130, 150, 84, '客户端', C.external, 15),
	box(250, 130, 180, 84, '云负载均衡\nSLB / NLB', C.lb, 14),
	hFlow(190, 250, 172, C.stroke),

	// LB 分到两个 Node
	txt(470, 106, 'LB 把请求送到任意 Node', 13, C.muted),
	box(470, 130, 130, 60, 'NodeA:NodePort', C.node, 13),
	box(470, 210, 130, 60, 'NodeB:NodePort', C.node, 13),
	hFlow(430, 470, 160, C.stroke),
	hFlow(430, 470, 240, C.stroke),

	// 各自转发到 Pod
	box(660, 130, 110, 60, 'PodA', C.pod, 14),
	box(660, 210, 110, 60, 'PodB', C.pod, 14),
	hFlow(600, 660, 160, C.stroke),
	hFlow(600, 660, 240, C.stroke),

	// 两种策略
	txt(40, 330, '两种策略的差别：', 15),
	box(40, 360, 350, 96, 'Cluster（默认）\nLB → 任意 Node → 可能二次转发到别的 Node 的 Pod', C.neutral, 13),
	box(410, 360, 350, 96, 'Local\nLB 只发给有目标 Pod 的 Node；避免二次转发、保留源 IP\n但扩容后要等云 LB 健康检查生效', C.warn, 13),
];

/* ─────────────────────────────────────────────
 * 四、iptables 模式：链式匹配
 * ───────────────────────────────────────────── */
export const iptablesScene: El[] = [
	txt(40, 30, 'iptables 模式：链式匹配，逐条遍历', 22),
	txt(42, 68, '规则数量与 Service 数量成正比，匹配复杂度 O(n)', 13, C.muted),

	// ── 上半：链的走向
	box(40, 110, 160, 68, 'PREROUTING', C.node, 15),
	box(240, 110, 190, 68, 'KUBE-SERVICES', C.node, 15),
	hFlow(200, 240, 144, C.stroke),

	box(240, 210, 190, 68, 'KUBE-SVC-XXXX', C.rule, 15),
	vArrow(335, 178, 210, C.stroke),
	txt(455, 182, '匹配 ClusterIP:Port', 13, C.muted),

	// ── 下半：按概率分发到三个后端（左侧说明，右侧规则列表，互不重叠）
	txt(40, 300, '规模上去之后的三个问题：', 15),
	txt(40, 330, '· 规则用链表存，每个包都要从链头遍历', 13, C.muted),
	txt(40, 354, '· 未命中时要走到默认策略，最坏 O(n)', 13, C.muted),
	txt(40, 378, '· 更新是 iptables-restore 原子替换整条链', 13, C.muted),
	txt(40, 408, '→ 上万条规则时内核遍历过慢，出现丢包', 13, C.emphasis),

	// 规则列表放在右侧，与左侧文字留出间隔
	txt(470, 300, '按概率 DNAT 到某个 Pod：', 13, C.muted),
	box(470, 328, 290, 48, 'KUBE-SEP-AAAA   (1/3)  → PodA', C.pod, 13),
	box(470, 386, 290, 48, 'KUBE-SEP-BBBB   (1/3)  → PodB', C.pod, 13),
	box(470, 444, 290, 48, 'KUBE-SEP-CCCC   (1/3)  → PodC', C.pod, 13),
	/*
	 * 从 KUBE-SVC 指向规则列表的引导线。
	 * 用斜线连到列表第一条的左边，而不是画水平线 ——
	 * 水平线终点会落在列表上方的空白处（箭头指向空）。
	 */
	arrowTo(430, 250, 470, 352, C.stroke),
];

/* ─────────────────────────────────────────────
 * 五、IPVS 模式：哈希直查 + 回退 iptables
 * ───────────────────────────────────────────── */
export const ipvsScene: El[] = [
	txt(40, 30, 'IPVS 模式：哈希表直查，但并非全靠 IPVS', 22),
	txt(42, 68, '匹配 O(1)、增量更新；SNAT 与 NodePort 入站仍回退 iptables', 13, C.muted),

	// 主路径：哈希查找
	box(40, 120, 160, 76, '数据包到达', C.external, 14),
	box(250, 120, 220, 76, 'IPVS 哈希表\nkey = (协议, 目标IP, 端口)', C.rule, 13),
	box(520, 120, 170, 76, '后端 Pod', C.pod, 14),
	hFlow(200, 250, 158, C.stroke),
	hFlow(470, 520, 158, C.stroke),

	// 三个优势
	txt(40, 240, 'IPVS 的优势：', 15),
	txt(40, 270, '· 匹配复杂度 O(1)：直接 hash 查找', 13, C.muted),
	txt(40, 294, '· 内核原生调度算法：rr / sh / lc / dh / sed / nq', 13, C.muted),
	txt(40, 318, '· 增量更新：只改对应那一条，不重建全表', 13, C.muted),

	// 回退部分
	txt(40, 366, '仍然需要 iptables 的部分：', 15),
	box(40, 396, 320, 96, 'SNAT（MASQUERADE）\nIPVS 只做四层转发，不处理 SNAT', C.warn, 13),
	box(380, 396, 320, 96, 'NodePort 入站拦截\n因此 iptables -t nat -L 仍能看到规则\n只是规则量从 O(n) 降到 O(1)', C.warn, 13),

	txt(40, 516, '另外：ip_vs 内核模块要提前加载，并需 ipset 配合管理白名单', 13, C.muted),
];

/* ─────────────────────────────────────────────
 * 六、两种模式对比
 * ───────────────────────────────────────────── */
export const modeCompareScene: El[] = [
	txt(40, 30, 'iptables 模式 vs IPVS 模式', 22),
	txt(42, 68, '核心差别在「怎么找到那条转发规则」', 13, C.muted),

	// 左：链表
	txt(40, 110, 'iptables：链表遍历', 16),
	box(40, 140, 340, 56, '规则 1 → 规则 2 → 规则 3 → … → 规则 n', C.warn, 13),
	txt(40, 212, '每个包从链头开始逐条比对，最坏要走完整条链', 13, C.muted),
	box(40, 244, 340, 66, '复杂度 O(n)\n规则随 Service 数量线性增长', C.warn, 13),

	// 右：哈希
	txt(470, 110, 'IPVS：哈希直查', 16),
	box(470, 140, 340, 56, 'hash(协议, 目标IP, 端口) → 直接命中', C.pod, 13),
	txt(470, 212, '内核维护哈希表，一步定位到对应转发项', 13, C.muted),
	box(470, 244, 340, 66, '复杂度 O(1)\n增量更新，不重建全表', C.pod, 13),

	// 底部结论
	txt(40, 348, '结论：', 15),
	txt(40, 378, '大规模集群基本都用 IPVS —— 规则量上万时，链表遍历的开销会成为瓶颈', 13, C.emphasis),
];
