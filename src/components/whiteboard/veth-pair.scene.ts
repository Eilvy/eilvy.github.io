/**
 * 「veth pair 拓扑」画板场景（只读）。
 *
 * 对应 network-packet-flow-osi 中原来的 ASCII 图：
 * 宿主机侧的 veth 端插在网桥上，Pod 侧是 eth0，两端由同一对 veth 连通。
 *
 * 坐标按 Excalidraw 的画布坐标手写，y 轴向下。
 * 这里只写「骨架」字段，id / seed / version / 绑定关系由
 * convertToExcalidrawElements 自动补全。
 *
 * ── 关于配色（重要：不要为暗色另准备一套颜色）──
 * 只用这一套「浅色主题」配色。暗色模式不需要另写：
 * Excalidraw 在 theme--dark 下会给画布整体套
 *   filter: invert(93%) hue-rotate(180deg)
 * （见其 index.css 的 .excalidraw.theme--dark canvas）。
 * 深色字 #1e1e1e 会被自动反相成亮色（约 211），白底反相成深底，
 * 这正是想要的效果。
 *
 * 若额外为暗色准备「浅色文字」，会被再反相一次变回深色，
 * 反而出现「暗底 + 暗字」看不清的情况（实测踩过这个坑）。
 */

const C = {
	stroke: '#1e1e1e',
	host: '#a5d8ff', // 宿主机侧
	pod: '#b2f2bb', // Pod 侧
	bridge: '#ffec99', // 网桥
	link: '#e03131', // 数据通道
	text: '#1e1e1e',
	muted: '#868e96',
};

/**
 * 使用 Excalidraw 内置的「本地字体」Helvetica（fontFamily: 2）。
 *
 * 不用默认的 Excalifont / 中文回退 Xiaolai：它们默认从 unpkg CDN 按需拉取，
 * 中文的 Xiaolai 还是 200+ 个子集、总计约 12MB。网络不通或被拦时字体加载失败，
 * 文本会按 fallback 字体渲染，而元素宽度是按另一种字体量出来的，
 * 结果就是文字超出文本元素被裁切（实测副标题末尾字符被切掉）。
 * Helvetica 在 Excalidraw 里标记为 local，直接用系统字体，取宽与渲染一致。
 */
const FONT_LOCAL = 2;

/** 宿主机侧 veth 网卡 */
const hostVeth = { x: 60, y: 120, width: 190, height: 90 };
/** Pod 侧 eth0 */
const podEth0 = { x: 480, y: 120, width: 190, height: 90 };
/** 网桥 */
const bridge = { x: 60, y: 320, width: 190, height: 80 };

export const vethPairScene = [
	// ── 标题
	{
		type: 'text',
		x: 60,
		y: 40,
		text: 'veth pair：一根线两个头',
		fontSize: 24,
		fontFamily: FONT_LOCAL,
		strokeColor: C.text,
	},
	{
		type: 'text',
		x: 62,
		y: 82,
		text: '宿主机侧 vethXXXX 插在网桥，Pod 侧即 eth0',
		fontSize: 13,
		fontFamily: FONT_LOCAL,
		strokeColor: C.muted,
	},

	// ── 两端网卡
	{
		type: 'rectangle',
		x: hostVeth.x,
		y: hostVeth.y,
		width: hostVeth.width,
		height: hostVeth.height,
		backgroundColor: C.host,
		fillStyle: 'solid',
		strokeColor: C.stroke,
		roundness: { type: 3 },
		label: { text: 'vethXXXX\n（宿主机侧 host 端）', fontSize: 16, fontFamily: FONT_LOCAL },
	},
	{
		type: 'rectangle',
		x: podEth0.x,
		y: podEth0.y,
		width: podEth0.width,
		height: podEth0.height,
		backgroundColor: C.pod,
		fillStyle: 'solid',
		strokeColor: C.stroke,
		roundness: { type: 3 },
		label: { text: 'eth0\n（Pod 侧 pod 端）', fontSize: 16, fontFamily: FONT_LOCAL },
	},

	// ─ 中间的虚拟数据通道
	{
		type: 'arrow',
		x: hostVeth.x + hostVeth.width,
		y: hostVeth.y + hostVeth.height / 2,
		points: [
			[0, 0],
			[podEth0.x - (hostVeth.x + hostVeth.width), 0],
		],
		strokeColor: C.link,
		strokeWidth: 2,
		endArrowhead: 'arrow',
		startArrowhead: 'arrow',
	},
	// 通道说明放在箭头下方，避免与上方副标题重叠
	{
		type: 'text',
		x: 300,
		y: 226,
		text: '虚拟数据通道',
		fontSize: 14,
		fontFamily: FONT_LOCAL,
		strokeColor: C.link,
	},

	// ── 网桥
	{
		type: 'rectangle',
		x: bridge.x,
		y: bridge.y,
		width: bridge.width,
		height: bridge.height,
		backgroundColor: C.bridge,
		fillStyle: 'solid',
		strokeColor: C.stroke,
		roundness: { type: 3 },
		label: { text: 'cni0 / docker0 网桥', fontSize: 16, fontFamily: FONT_LOCAL },
	},
	// 宿主机侧网卡 → 网桥
	{
		type: 'arrow',
		x: hostVeth.x + hostVeth.width / 2,
		y: hostVeth.y + hostVeth.height,
		points: [
			[0, 0],
			[0, bridge.y - (hostVeth.y + hostVeth.height)],
		],
		strokeColor: C.stroke,
		strokeWidth: 2,
		endArrowhead: 'arrow',
	},
	{
		type: 'text',
		x: 268,
		y: 250,
		text: 'host 端插在网桥上',
		fontSize: 14,
		fontFamily: FONT_LOCAL,
		strokeColor: C.muted,
	},

	// ── 说明
	{
		type: 'text',
		x: 60,
		y: 450,
		text: '数据从一端写入，另一端立即可读 —— 内核里是一对相连的虚拟网卡',
		fontSize: 14,
		fontFamily: FONT_LOCAL,
		strokeColor: C.muted,
	},
];