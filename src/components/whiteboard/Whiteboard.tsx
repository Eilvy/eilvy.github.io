import { useEffect, useMemo, useRef, useState } from 'react';
import { Excalidraw, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';

/**
 * 画板元素「骨架」。
 *
 * 这里不直接从 @excalidraw/excalidraw 深层路径导入 ExcalidrawElementSkeleton：
 * 该包的 package.json exports 只暴露了 "." 与 "./index.css"，
 * 而主入口又没有 re-export 这个类型，深层 import 会被 exports 校验拦下。
 * 因此本地声明一个够用的最小结构，交给 convertToExcalidrawElements 补全。
 */
type SkeletonElement = {
	type: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	angle?: number;
	strokeColor?: string;
	backgroundColor?: string;
	fillStyle?: string;
	strokeWidth?: number;
	strokeStyle?: string;
	roughness?: number;
	opacity?: number;
	roundness?: { type: number } | null;
	text?: string;
	fontSize?: number;
	fontFamily?: number;
	textAlign?: string;
	verticalAlign?: string;
	label?: { text: string; fontSize?: number };
	points?: [number, number][];
	startBinding?: unknown;
	endBinding?: unknown;
	startArrowhead?: string | null;
	endArrowhead?: string | null;
	groupIds?: string[];
	id?: string;
};

interface Props {
	/**
	 * 浅色 / 暗色两套场景元素骨架。
	 *
	 * 之所以传两份静态数据而不是一个 build(isDark) 工厂函数：
	 * client:only 岛在构建期会把 props 序列化成 JSON 交给浏览器，
	 * 函数无法被序列化（实测会变成 null，画布直接空白）。
	 * 因此这里只传纯数据，由组件内部按当前主题挑选。
	 */
	elements: { light: SkeletonElement[]; dark: SkeletonElement[] };
	/** 画布高度（px） */
	height?: number;
	/** 图表说明，用于无障碍标签 */
	label?: string;
}

/**
 * 只读画板（Excalidraw）。
 *
 * 仅作「查看器」使用：开启 viewModeEnabled 后不渲染工具栏，
 * 读者只能平移 / 缩放画布，无法编辑，因此不需要任何持久化后端。
 *
 * 调用方须以 client:only="react" 挂载 —— Excalidraw 依赖
 * canvas / window 等浏览器 API，不能在构建期做 SSR。
 */
export default function Whiteboard({ elements, height = 420, label }: Props) {
	const apiRef = useRef<any>(null);

	/*
	 * 跟随站点主题。
	 *
	 * 初始值直接同步读一次 DOM（组件是 client:only，挂载时 document 已可用），
	 * 不要先给 false 再在 useEffect 里纠正：Excalidraw 只认挂载那一刻的
	 * initialData，若首帧用的是浅色场景，之后即使 state 变了也不会重画，
	 * 会出现「暗色画布 + 深色文字」几乎看不见的情况。
	 *
	 * 之后用 MutationObserver 监听 <html> 的 class 变化，
	 * 覆盖「跟随系统」与「手动点切换」两种运行期切换。
	 */
	const [isDark, setIsDark] = useState(
		() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
	);

	useEffect(() => {
		const root = document.documentElement;
		const sync = () => setIsDark(root.classList.contains('dark'));
		sync();
		const ob = new MutationObserver(sync);
		ob.observe(root, { attributes: true, attributeFilter: ['class'] });
		return () => ob.disconnect();
	}, []);

	// 骨架 → 完整元素，省去手写 id / seed / version / 绑定关系等字段
	const scene = useMemo(
		() => convertToExcalidrawElements((isDark ? elements.dark : elements.light) as never),
		[elements, isDark]
	);

	/*
	 * 运行期切换主题时同步替换画布内容。
	 *
	 * Excalidraw 只在首次挂载读取 initialData，theme 变化不会重画元素，
	 * 而两种主题下的文字颜色不同，所以主题一变就得主动 updateScene 把
	 * 对应当套场景写进去（顺带保留原有缩放/滚动，避免视角跳动）。
	 *
	 * 首帧跳过：此时内容和 theme 已经是配套的，重复写一次纯属浪费。
	 */
	const firstRun = useRef(true);
	useEffect(() => {
		if (firstRun.current) {
			firstRun.current = false;
			return;
		}
		apiRef.current?.updateScene({ elements: scene });
	}, [scene]);

	/*
	 * 二次适配视口。
	 *
	 * initialData.scrollToContent 在挂载瞬间就计算了「适应内容」的缩放，
	 * 此时字体还没就绪（Excalidraw 的字体是异步加载的），
	 * 文字按 fallback 字体量出来的宽度与最终渲染不一致，
	 * 可能超出已经定好的视口而被裁切。
	 * 因此在字体就绪后再 fit 一次，保证内容完整可见。
	 */
	useEffect(() => {
		let cancelled = false;
		const refit = () => {
			if (cancelled) return;
			apiRef.current?.scrollToContent(scene, { fitToViewport: true, viewportZoomFactor: 0.9 });
		};
		(document as any).fonts?.ready?.then(refit) ?? refit();
		// 兜底：个别浏览器 fonts.ready 触发较早，再补一次
		const t = window.setTimeout(refit, 300);
		return () => {
			cancelled = true;
			window.clearTimeout(t);
		};
	}, [scene]);

	return (
		<div class="whiteboard" style={{ height }} role="img" aria-label={label}>
			<Excalidraw
				excalidrawAPI={(api: unknown) => {
					apiRef.current = api;
				}}
				initialData={{ elements: scene }}
				// 跟随站点主题：站点用 html.dark 切换暗色，这里同步给画布，
				// 否则暗色页面里会嵌一块亮白的画布，非常突兀
				theme={isDark ? 'dark' : 'light'}
				viewModeEnabled
				gridModeEnabled={false}
				autoFocus={false}
				handleKeyboardGlobally={false}
				// 只读场景不需要这些入口
				UIOptions={{
					canvasActions: {
						loadScene: false,
						saveToActiveFile: false,
						export: false,
						toggleTheme: false,
					},
				}}
			/>
		</div>
	);
}