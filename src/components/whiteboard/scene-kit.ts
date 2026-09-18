/**
 * 画板场景的共享构建件。
 *
 * 绘制技巧与踩坑记录见 docs/WHITEBOARD_GUIDE.md
 * （配色约定、箭头用法、布局取舍、交付前自查清单）。
 *
 * 所有场景共用一套「浅色主题」配色 —— 暗色模式不另写一套：
 * Excalidraw 在 theme--dark 下会给画布整体套
 *   filter: invert(93%) hue-rotate(180deg)
 * 深色字会被自动反相成亮色、白底变深底。若额外准备一套「浅色文字」，
 * 会被再反相一次变回深色，反而变成暗底暗字（实测踩过）。
 *
 * 坐标一律手写（y 轴向下）。元素只写「骨架」字段，
 * id / seed / version / 绑定关系由 convertToExcalidrawElements 补全。
 */

/**
 * Excalidraw 内置的「本地字体」Helvetica（fontFamily: 2）。
 *
 * 不用默认的 Excalifont / 中文回退 Xiaolai：它们运行时从 unpkg CDN 按需拉取，
 * 中文子集约 200+ 个、总计约 12MB。加载失败时文字按 fallback 渲染，
 * 而元素宽度是按另一字体量出的，会导致文字被裁切（实测副标题末尾被切掉）。
 * Helvetica 在 Excalidraw 里标记为 local，直接用系统字体，取宽与渲染一致。
 */
export const FONT_LOCAL = 2;

/** 元素骨架（与 Whiteboard.tsx 的 SkeletonElement 结构对齐） */
export type El = { type: string; [k: string]: unknown };

export const C = {
	stroke: '#1e1e1e',
	text: '#1e1e1e',
	muted: '#868e96',
	emphasis: '#e03131',

	/* 按 OSI 层次着色，全篇保持一致，读者扫一眼就知道处于哪一层 */
	l1: '#ffd8a8', // 物理层
	l2: '#ffec99', // 数据链路层
	l3: '#a5d8ff', // 网络层
	l4: '#b2f2bb', // 传输层
	l5: '#d0bfff', // 会话/表示/应用层
	neutral: '#e9ecef',
	warn: '#ffc9c9',

	/*
	 * 通用语义色：给非 OSI 语境的图用（如 k8s Service 的网络拓扑）。
	 * 取值与上面的 l1…l5 相同，保证全站观感一致，
	 * 只是换了更好懂的语义名，避免在 Service 图里写 C.l3 这种看不懂的引用。
	 */
	external: '#ffd8a8', // 集群外部 / 客户端
	node: '#a5d8ff', // 宿主机 / Node
	rule: '#ffec99', // 转发规则 / 内核态处理
	pod: '#b2f2bb', // Pod / 后端实例
	lb: '#d0bfff', // 负载均衡器

	/*
	 * AI / 生图语境：LLM 识图 + ComfyUI 出图。
	 * 同样与上面的取值一致，只是换成该语境下好懂的语义名 ——
	 * 在 ComfyUI 的图里写 C.lb 表示「LLM」没人看得懂，写 C.llm 一目了然。
	 */
	input: '#ffd8a8', // 用户输入（草图、意图文字）
	llm: '#d0bfff', // LLM 环节（识图、出参）
	control: '#ffec99', // 控制参数 / 编排层
	engine: '#a5d8ff', // 执行引擎（ComfyUI / 采样）
	output: '#b2f2bb', // 产出（图片）

	/*
	 * Kafka 语境：生产端 → Broker → 消费端，外加事务协调。
	 * 同样复用上面的取值，只是换成该语境下的语义名 ——
	 * 在 Kafka 的图里用 C.engine 表示 broker 会很别扭。
	 */
	kafkaProducer: '#ffd8a8', // 生产端
	kafkaBroker: '#a5d8ff', // Broker / 副本存储
	kafkaConsumer: '#b2f2bb', // 消费端
	kafkaTxn: '#d0bfff', // 事务 / 协调者
};

/** 纯文本 */
export const txt = (
	x: number,
	y: number,
	text: string,
	size = 14,
	color: string = C.text
): El => ({ type: 'text', x, y, text, fontSize: size, fontFamily: FONT_LOCAL, strokeColor: color });

/** 圆角节点框，文字居中（用 Excalidraw 的 label 自动居中） */
export const box = (
	x: number,
	y: number,
	w: number,
	h: number,
	label: string,
	fill: string,
	size = 15
): El => ({
	type: 'rectangle',
	x,
	y,
	width: w,
	height: h,
	backgroundColor: fill,
	fillStyle: 'solid',
	strokeColor: C.stroke,
	strokeWidth: 1,
	roundness: { type: 3 },
	label: { text: label, fontSize: size, fontFamily: FONT_LOCAL },
});

/**
 * 竖直箭头（向下）。
 *
 * 关于箭头上的文字标注 —— 一律用 label，不要另写一个 text 元素。
 *
 * 原因：Excalidraw 会把 label 自动绑定到箭头上并居中（横竖箭头都是），
 * 而手工摆一个 text 就得自己算坐标，极易偏。实测现状里两条标注的偏差：
 *   - 「虚拟数据通道」相对箭头中点偏移 dx=-18 / dy=+71
 *   - 「host 端插在网桥上」相对箭头中点偏移 dx=+191
 * 一旦调整箭头长度或位置，这些硬编码坐标还会继续错位；
 * 用 label 则完全跟随箭头，改坐标不用管标注。
 */
export const vArrow = (
	x: number,
	y1: number,
	y2: number,
	color: string = C.stroke,
	label?: string
): El => ({
	type: 'arrow',
	x,
	y: y1,
	points: [
		[0, 0],
		[0, y2 - y1],
	],
	strokeColor: color,
	strokeWidth: 2,
	endArrowhead: 'arrow',
	...(label
		? { label: { text: label, fontSize: 13, fontFamily: FONT_LOCAL } }
		: {}),
});

/** 水平双向箭头（label 同 vArrow，由 Excalidraw 自动居中） */
export const hArrow = (
	x1: number,
	x2: number,
	y: number,
	color: string = C.stroke,
	label?: string
): El => ({
	type: 'arrow',
	x: x1,
	y,
	points: [
		[0, 0],
		[x2 - x1, 0],
	],
	strokeColor: color,
	strokeWidth: 2,
	startArrowhead: 'arrow',
	endArrowhead: 'arrow',
	...(label
		? { label: { text: label, fontSize: 13, fontFamily: FONT_LOCAL } }
		: {}),
});

export interface Step {
	/** 节点文字 */
	label: string;
	/** 节点填充色（建议取 C.l1 … C.l5） */
	fill: string;
}

/**
 * 单向水平箭头（右向）。用于串起流程：x2 < x1 时自动变成左向。
 * 与 hArrow 的区别是只有箭头端有箭头（hArrow 是双向）。
 */
export const hFlow = (
	x1: number,
	x2: number,
	y: number,
	color: string = C.stroke,
	label?: string
): El => ({
	type: 'arrow',
	x: x1,
	y,
	points: [
		[0, 0],
		[x2 - x1, 0],
	],
	strokeColor: color,
	strokeWidth: 2,
	endArrowhead: 'arrow',
	...(label ? { label: { text: label, fontSize: 13, fontFamily: FONT_LOCAL } } : {}),
});

/**
 * 任意两点之间的单向箭头（可斜向）。
 *
 * vArrow / hFlow 只处理正上正下、正左正右；当需要把两条平行的链
 * 「汇入」同一个节点时，必须画斜线，否则箭头会落在目标方框之外 ——
 * 实测 NodePort 图里误用 hFlow 画汇合线，两个箭头都指向了空白。
 */
export const arrowTo = (
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	color: string = C.stroke,
	label?: string
): El => ({
	type: 'arrow',
	x: x1,
	y: y1,
	points: [
		[0, 0],
		[x2 - x1, y2 - y1],
	],
	strokeColor: color,
	strokeWidth: 2,
	endArrowhead: 'arrow',
	...(label ? { label: { text: label, fontSize: 13, fontFamily: FONT_LOCAL } } : {}),
});

/** 虚线分组框，用来圈出「宿主机侧 / Pod 侧」这类范围。须先于内部节点入数组 */
export const groupFrame = (
	x: number,
	y: number,
	w: number,
	h: number
): El => ({
	type: 'rectangle',
	x,
	y,
	width: w,
	height: h,
	backgroundColor: 'transparent',
	fillStyle: 'solid',
	strokeColor: C.muted,
	strokeWidth: 1,
	strokeStyle: 'dashed',
	roundness: { type: 3 },
});

/**
 * 竖直流程布局：节点自上而下排列，节点之间画箭头，箭头右侧放该段的旁注。
 *
 * 把重复的坐标运算收在这里，场景文件里只描述「有哪些步骤、每步注什么」，
 * 既少犯错也便于统一调整间距。
 */
export function vStack(
	steps: Step[],
	opts: { x?: number; y0?: number; w?: number; h?: number; gap?: number } = {}
): El[] {
	const { x = 60, y0 = 120, w = 300, h = 78, gap = 96 } = opts;
	const els: El[] = [];

	steps.forEach((step, i) => {
		const y = y0 + i * (h + gap);
		els.push(box(x, y, w, h, step.label, step.fill));

		if (i < steps.length - 1) {
			els.push(vArrow(x + w / 2, y + h, y + h + gap));
		}
	});

	return els;
}