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
	label?: { text: string; fontSize?: number; fontFamily?: number };
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
	 * 场景元素骨架（纯数据）。
	 *
	 * 必须是可 JSON 序列化的静态数据：client:only 岛在构建期会把 props
	 * 序列化后交给浏览器，函数无法被序列化（实测会变成 null，画布空白），
	 * 所以不能传 build(isDark) 之类的工厂函数。
	 *
	 * 只需传「浅色主题」一套配色 —— 暗色由 Excalidraw 自己反相画布完成，
	 * 详见 veth-pair.scene.ts 顶部说明。
	 */
	elements: SkeletonElement[];
	/** 画布高度（px） */
	height?: number;
	/** 图表说明，用于无障碍标签 */
	label?: string;
}

/**
 * 跟随站点暗色主题，返回 Excalidraw 需要的 theme 值。
 *
 * 站点在 <html> 上加减 .dark 类（含跟随系统与手动切换），
 * 这里监听该类名变化。Excalidraw 会在暗色下给画布套
 * invert 滤镜，因此元素数据无需区分主题，只有这个 theme 开关要跟着变。
 */
function useSiteTheme(): 'light' | 'dark' {
	// 惰性初始值同步读一次 DOM：组件是 client:only，挂载时 document 已就绪。
	// 读晚了会让画布先用浅色渲染再翻转，出现闪白。
	const [isDark, setIsDark] = useState(() =>
		typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
	);

	useEffect(() => {
		const root = document.documentElement;
		const sync = () => setIsDark(root.classList.contains('dark'));
		sync();
		const ob = new MutationObserver(sync);
		ob.observe(root, { attributes: true, attributeFilter: ['class'] });
		return () => ob.disconnect();
	}, []);

	return isDark ? 'dark' : 'light';
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
	const theme = useSiteTheme();

	// 骨架 → 完整元素，省去手写 id / seed / version / 绑定关系等字段
	const scene = useMemo(() => convertToExcalidrawElements(elements as never), [elements]);

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
				initialData={{ elements: scene, scrollToContent: true }}
				// 跟随站点主题，避免暗色页面里嵌一块亮白画布
				theme={theme}
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