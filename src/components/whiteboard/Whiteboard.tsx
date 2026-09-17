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
 * 两种使用方式：
 * - mode="inline"：文章内嵌插图，尺寸含蓄、不响应滚轮与拖拽，
 *   读者滚页面时不会被画布"抢走"滚动；
 * - mode="dialog"：点击后弹出的全屏查看器，可缩放/平移/适应窗口。
 *
 * 两者共用同一份场景数据，各自持有独立的 Excalidraw 实例。
 */
type Mode = 'inline' | 'dialog';

interface ViewerProps {
	elements: SkeletonElement[];
	theme: 'light' | 'dark';
	mode: Mode;
	height?: number;
	label?: string;
	/** 仅 dialog 用：缩放控制需要拿到 api */
	apiRef?: { current: any };
}

function Viewer({ elements, theme, mode, height, label, apiRef }: ViewerProps) {
	const localRef = useRef<any>(null);
	const ref = apiRef ?? localRef;

	const scene = useMemo(() => convertToExcalidrawElements(elements as never), [elements]);

	/*
	 * 首帧适配视口。
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
			ref.current?.scrollToContent(scene, { fitToViewport: true, viewportZoomFactor: 0.9 });
		};
		(document as any).fonts?.ready?.then(refit) ?? refit();
		const t = window.setTimeout(refit, 300);
		return () => {
			cancelled = true;
			window.clearTimeout(t);
		};
	}, [scene, ref]);

	return (
		<div
			className={`whiteboard whiteboard--${mode}`}
			style={height ? { height } : undefined}
			role="img"
			aria-label={label}
		>
			<Excalidraw
				excalidrawAPI={(api: unknown) => {
					ref.current = api;
				}}
				initialData={{ elements: scene, scrollToContent: true }}
				theme={theme}
				viewModeEnabled
				gridModeEnabled={false}
				autoFocus={false}
				handleKeyboardGlobally={false}
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

/**
 * 挂载时临时屏蔽画布的滚轮行为。
 *
 * Excalidraw 的 handleWheel 只要事件目标是 canvas 就会 preventDefault，
 * 于是「滚页面」变成了「画面滚动」，在文章里很违和。
 * 这里用捕获阶段监听把 wheel 拦下并放行给页面默认行为：
 * 只 stopPropagation（阻止到达 Excalidraw 的 handler），不 preventDefault，
 * 页面照常滚动。
 *
 * 只在 inline 模式下启用；dialog 里画布是主角，保留原生缩放/平移手感。
 */
function usePageScrollWheel(containerRef: { current: HTMLDivElement | null }) {
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			e.stopPropagation();
		};
		// capture 阶段插入，先于 Excalidraw 的冒泡监听
		el.addEventListener('wheel', onWheel, { capture: true });
		return () => el.removeEventListener('wheel', onWheel, { capture: true } as any);
	}, [containerRef]);
}

/**
 * 内嵌画板 + 点击放大的组合。
 *
 * 内嵌部分只做静态展示（不响应滚轮、不响应拖拽），点击后打开对话框查看，
 * 在对话框里才提供缩放/平移/适应窗口。这样把"阅读流"和"操作画布"分开，
 * 避免在正文里误触把页面滚走或把图拖跑。
 */
export default function Whiteboard({ elements, height = 300, label }: Props) {
	const theme = useSiteTheme();
	const inlineRef = useRef<HTMLDivElement>(null);
	const dialogApiRef = useRef<any>(null);
	const [open, setOpen] = useState(false);
	const [zoom, setZoom] = useState(1);

	// 内嵌画布：滚轮交还给页面
	usePageScrollWheel(inlineRef);

	// 打开时锁定页面滚动；关闭时恢复
	useEffect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setOpen(false);
		};
		window.addEventListener('keydown', onKey);
		return () => {
			document.body.style.overflow = prev;
			window.removeEventListener('keydown', onKey);
		};
	}, [open]);

	// 对话框里缩放变化时同步按钮可用态
	useEffect(() => {
		if (!open) return;
		const t = window.setInterval(() => {
			const z = dialogApiRef.current?.getAppState?.().zoom?.value;
			if (typeof z === 'number') setZoom(z);
		}, 300);
		return () => window.clearInterval(t);
	}, [open]);

	const zoomBy = (factor: number) => {
		const api = dialogApiRef.current;
		if (!api) return;
		const app = api.getAppState();
		api.updateScene({ appState: { zoom: { value: app.zoom.value * factor } } });
	};

	const fit = () => {
		dialogApiRef.current?.scrollToContent(undefined, {
			fitToViewport: true,
			viewportZoomFactor: 0.9,
		});
	};

	return (
		<>
			{/*
			  内嵌载体：套一个按钮语义的容器，提示"可点击放大"。
			  用 button 会带来默认样式与内部交互冲突，这里用 div + role/tabIndex，
			  键盘回车/空格也能触发。
			*/}
			<div
				ref={inlineRef}
				className="wb-inline"
				role="button"
				tabIndex={0}
				aria-label={`${label ?? '插图'}（点击放大查看）`}
				onClick={() => setOpen(true)}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						setOpen(true);
					}
				}}
			>
				<Viewer elements={elements} theme={theme} mode="inline" height={height} label={label} />
				{/*
				  交互屏蔽层。
				  viewMode 下 Excalidraw 仍会渲染一个 pointer-events: auto 的
				  .excalidraw__canvas.interactive（cursor: grab），读者能把插图
				  拖着跑、也能用滚轮平移 —— 但这里只想让它当一张「可点击的插图」。
				  与其覆盖 Excalidraw 的内部类名（版本升级就可能失效），
				  不如盖一层透明层把指针事件全部吃掉：
				  点击落在该层 → 冒泡到外层 div → 打开弹窗；
				  拖拽 / 滚轮 / 双击等一概不会传到画布。
				*/}
				<span className="wb-shield" aria-hidden="true" />
				<span className="wb-zoom-hint" aria-hidden="true">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
						<circle cx="11" cy="11" r="7" />
						<path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
					</svg>
					点击放大
				</span>
			</div>

			{open && (
				<div
					className="wb-modal"
					role="dialog"
					aria-modal="true"
					aria-label={label ?? '画板'}
					onClick={(e) => {
						// 点遮罩关闭；点画布本体不关闭
						if (e.target === e.currentTarget) setOpen(false);
					}}
				>
					<div className="wb-modal__panel">
						<header className="wb-modal__bar">
							<span className="wb-modal__title">{label ?? '画板'}</span>
							<div className="wb-modal__tools">
								<button type="button" onClick={() => zoomBy(1 / 1.2)} title="缩小" aria-label="缩小">
									−
								</button>
								<span className="wb-modal__zoom">{Math.round(zoom * 100)}%</span>
								<button type="button" onClick={() => zoomBy(1.2)} title="放大" aria-label="放大">
									+
								</button>
								<button type="button" onClick={fit} title="适应窗口" aria-label="适应窗口">
									适应
								</button>
								<button
									type="button"
									className="wb-modal__close"
									onClick={() => setOpen(false)}
									title="关闭"
									aria-label="关闭"
								>
									×
								</button>
							</div>
						</header>
						<div className="wb-modal__body">
							<Viewer
								elements={elements}
								theme={theme}
								mode="dialog"
								label={label}
								apiRef={dialogApiRef}
							/>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
