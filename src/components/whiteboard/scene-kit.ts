/**
 * 画板场景的共享构建件。
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

/** 竖直箭头（向下） */
export const vArrow = (x: number, y1: number, y2: number, color: string = C.stroke): El => ({
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
});

/** 水平双向箭头 */
export const hArrow = (x1: number, x2: number, y: number, color: string = C.stroke): El => ({
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
});

export interface Step {
	/** 节点文字 */
	label: string;
	/** 节点填充色（建议取 C.l1 … C.l5） */
	fill: string;
	/** 该节点「之后」那段箭头的旁注（可多行，用 \n） */
	note?: string;
}

/**
 * 竖直流程布局：节点自上而下排列，节点之间画箭头，箭头右侧放该段的旁注。
 *
 * 把重复的坐标运算收在这里，场景文件里只描述「有哪些步骤、每步注什么」，
 * 既少犯错也便于统一调整间距。
 */
export function vStack(
	steps: Step[],
	opts: { x?: number; y0?: number; w?: number; h?: number; gap?: number; noteSize?: number } = {}
): El[] {
	const { x = 60, y0 = 120, w = 300, h = 78, gap = 96, noteSize = 13 } = opts;
	const els: El[] = [];

	steps.forEach((step, i) => {
		const y = y0 + i * (h + gap);
		els.push(box(x, y, w, h, step.label, step.fill));

		if (step.note) {
			// 旁注放在「该节点下方那段箭头」的右侧
			els.push(txt(x + w + 40, y + h + 10, step.note, noteSize, C.muted));
		}

		if (i < steps.length - 1) {
			els.push(vArrow(x + w / 2, y + h, y + h + gap));
		}
	});

	return els;
}