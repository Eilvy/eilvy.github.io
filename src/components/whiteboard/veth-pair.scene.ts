/**
 * 「veth pair 拓扑」画板场景（只读）。
 *
 * 对应 network-packet-flow-osi.md 中原来的 ASCII 图：
 * 宿主机侧的 veth 端插在网桥上，Pod 侧是 eth0，两端由同一对 veth 连通。
 *
 * 坐标按 Excalidraw 的画布坐标手写，y 轴向下。
 * 这里只写「骨架」字段，id / seed / version / 绑定关系由
 * convertToExcalidrawElements 自动补全。
 */

const C = {
	stroke: '#1e1e1e',
	host: '#a5d8ff', // 宿主机侧
	pod: '#b2f2bb', // Pod 侧
	bridge: '#ffec99', // 网桥
	link: '#e03131', // 数据通道
};

/**
 * 直接画在画布上的文字颜色。
 *
 * 矩形内部的标签不用管：它们落在浅色填充上，深色字在两种主题下都清晰。
 * 但标题/副标题/说明这类文字是贴在画布背景上的，
 * 暗色主题下画布背景本身就是深色，深色字会「看不见」，
 * 因此这些文字的颜色必须按主题切换。
 */
const textOnCanvas = (isDark: boolean) => (isDark ? '#e9ecef' : '#1e1e1e');
const mutedOnCanvas = (isDark: boolean) => (isDark ? '#adb5bd' : '#868e96');

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

const buildVethPairScene = (isDark: boolean) => [
	// ── 标题
	{
		type: 'text',
		x: 60,
		y: 40,
		text: 'veth pair：一根线两个头',
		fontSize: 24,
		fontFamily: FONT_LOCAL,
		strokeColor: textOnCanvas(isDark),
	},
	{
		type: 'text',
		x: 62,
		y: 82,
		text: '宿主机侧 vethXXXX 插在网桥，Pod 侧即 eth0',
		fontSize: 13,
		fontFamily: FONT_LOCAL,
		strokeColor: mutedOnCanvas(isDark),
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

	// ── 中间的虚拟数据通道
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
		strokeColor: mutedOnCanvas(isDark),
	},

	// ── 说明
	{
		type: 'text',
		x: 60,
		y: 450,
		text: '数据从一端写入，另一端立即可读 —— 内核里是一对相连的虚拟网卡',
		fontSize: 14,
		fontFamily: FONT_LOCAL,
		strokeColor: mutedOnCanvas(isDark),
	},
];

/**
 * 浅色 / 暗色两套场景。
 *
 * 只差「贴在画布上的文字颜色」——暗色画布必须配浅色字。
 * 这里在构建期就把两套数据算好，作为纯 JSON 传给浏览器端组件
 * （client:only 岛的 props 不能被序列化函数，见 Whiteboard.tsx 注释）。
 */
export const vethPairScenes = {
	light: buildVethPairScene(false),
	dark: buildVethPairScene(true),
};
