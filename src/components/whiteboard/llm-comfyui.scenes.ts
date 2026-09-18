/**
 * 《LLM 接入 ComfyUI 实现草图主导出图》一文的画板场景集合。
 *
 * 覆盖原文中能用图表达的部分：
 *   1. 目标链路：草图 → LLM 识图 → 出参 → ComfyUI → 出图
 *   2. ComfyUI 草图工作流：主链路 + 旁路依赖
 *   3. 人工调试 → API 调用的衔接点
 *   4. 开源生态映射：每个环节对应哪些现成项目
 *   5. 落地路径：MVP 到可选高质量模式
 *
 * 配色与布局件见 scene-kit.ts，绘制规范见 docs/WHITEBOARD_GUIDE.md。
 * 箭头标注一律用箭头自带的 label；说明文字并入节点内部（多行 label），
 * 避免出现独立 text 与图形重叠、或箭头终点悬空。
 */

import { C, box, txt, vArrow, hFlow, type El } from './scene-kit';

/* ─────────────────────────────────────────────
 * 一、目标链路
 *
 * 竖直串联 5 个环节。每步的细节写进节点内部，
 * 因此箭头不需要标注 —— 链路本身是线性的，没有歧义。
 * ───────────────────────────────────────────── */
export const targetPipelineScene: El[] = [
	txt(30, 30, '目标链路：草图 → LLM → ComfyUI → 出图', 22),
	txt(32, 68, 'LLM 既是「看图的人」，又是「发指令的人」', 13, C.muted),

	box(70, 112, 520, 68, '用户草图（图片）\n手绘线稿 / 简笔画', C.input, 15),
	box(70, 220, 520, 68, 'LLM 多模态识图\n理解构图、主体与风格意图', C.llm, 15),
	box(70, 328, 520, 68, '生成结构化控制参数\nPrompt + ControlNet 参数 + 工作流 JSON', C.control, 15),
	box(70, 436, 520, 68, '调用 ComfyUI API 执行\nPOST /prompt 入队', C.engine, 15),
	box(70, 544, 520, 68, '返回最终出图', C.output, 15),

	vArrow(330, 180, 220),
	vArrow(330, 288, 328),
	vArrow(330, 396, 436),
	vArrow(330, 504, 544),
];

/* ─────────────────────────────────────────────
 * 二、ComfyUI 草图工作流
 *
 * 左列是主链路（从上到下），右列是旁路依赖，各自用水平箭头指回
 * 消费它的那个节点 —— 这样箭头短、不交叉，也不会盖住任何方框。
 * 早先试过把所有输入都画在左侧再汇聚到 KSampler，斜线会穿过中间节点。
 * ───────────────────────────────────────────── */
export const comfyWorkflowScene: El[] = [
	txt(30, 30, 'ComfyUI 草图工作流：主链路与依赖', 22),
	txt(32, 68, '草图走 ControlNet 约束结构，prompt 决定风格', 13, C.muted),

	// 左列：主链路
	box(40, 110, 290, 70, '草图（Load Image）', C.input, 15),
	box(40, 210, 290, 70, 'ControlNet 预处理\nlineart / scribble / canny', C.control, 14),
	box(40, 310, 290, 70, 'ControlNetApply\nstrength 0.6–0.9', C.control, 14),
	box(40, 410, 290, 70, 'KSampler\nsteps 20–30，cfg 7，dpmpp_2m + karras', C.engine, 14),
	box(40, 510, 290, 70, 'VAEDecode → 出图', C.output, 15),

	vArrow(185, 180, 210),
	vArrow(185, 280, 310),
	vArrow(185, 380, 410),
	vArrow(185, 480, 510),

	// 右列：旁路依赖，箭头向左指回对应节点
	box(420, 310, 240, 70, 'ControlNet 模型\n须与底模版本匹配', C.control, 13),
	box(420, 410, 240, 70, '底模 + 正/负向 Prompt\n+ 空潜空间 512×512', C.engine, 13),
	hFlow(420, 330, 345),
	hFlow(420, 330, 445),
];

/* ─────────────────────────────────────────────
 * 三、衔接点：人工调试 → API 调用
 * ──────────────────────────────────────────── */
export const handoffScene: El[] = [
	txt(30, 30, '衔接点：从人工调试到 API 调用', 22),
	txt(32, 68, '两条路径共用同一份工作流 JSON，区别只在「谁来填参」', 13, C.muted),

	box(60, 110, 520, 68, 'ComfyUI WebUI 手动搭建工作流\n所见即所得，便于试参数', C.engine, 15),
	box(60, 218, 520, 68, '开启 Dev mode → Save (API Format)', C.control, 15),
	box(60, 326, 520, 68, '得到 workflow_api.json 模板\n记下 prompt / seed / strength / denoise 的节点 ID', C.control, 14),
	box(60, 434, 520, 68, '中间层加载模板\nLLM 的 function call 输出填入对应字段', C.llm, 15),
	box(60, 542, 520, 68, 'POST /prompt 提交执行', C.engine, 15),

	vArrow(320, 178, 218),
	vArrow(320, 286, 326),
	vArrow(320, 394, 434),
	vArrow(320, 502, 542),

	// 关键结论：LLM 不必理解节点连线
	txt(60, 650, '关键：LLM 不需要理解节点连线，只需输出几个参数值', 14, C.emphasis),
	txt(60, 676, '这正是选「模板填参」而非「让 LLM 直接生成工作流」的原因', 13, C.muted),
];

/* ─────────────────────────────────────────────
 * 四、开源生态映射
 *
 * 四个环节横向排列，每个环节下方挂上可复用的现成项目。
 * ───────────────────────────────────────────── */
export const ecosystemScene: El[] = [
	txt(30, 30, '开源生态：每一环都有现成实现', 22),
	txt(32, 68, '没有一站式成品，但按环节拆开后都能找到对应项目', 13, C.muted),

	// 四个环节
	box(30, 120, 140, 64, '① 草图输入', C.input, 15),
	box(195, 120, 140, 64, '② LLM 识图', C.llm, 15),
	box(360, 120, 140, 64, '③ LLM 工具调用', C.llm, 15),
	box(525, 120, 140, 64, '④ ControlNet 出图', C.output, 15),

	hFlow(170, 195, 152),
	hFlow(335, 360, 152),
	hFlow(500, 525, 152),

	// 各环节下方的对应项目
	box(30, 244, 140, 84, 'ComfyUI-Olm-Sketch\n节点内手绘', C.neutral, 12),
	box(195, 244, 140, 84, 'comfyui_LLM_party\n多模态识图节点', C.neutral, 12),
	box(360, 244, 140, 84, 'comfyui-mcp\nImageMCP\nMCP 工具化', C.neutral, 12),
	box(525, 244, 140, 84, 'sketch-to-image-ai\n标准 ControlNet\n工作流', C.neutral, 12),

	vArrow(100, 184, 244),
	vArrow(265, 184, 244),
	vArrow(430, 184, 244),
	vArrow(595, 184, 244),

	txt(30, 372, '拼装 2–3 个即可覆盖全链路；「LLM 识图主导草图语义」这一环尚无成品，正是差异化空间', 13, C.emphasis),
];

/* ─────────────────────────────────────────────
 * 五、落地路径
 *
 * 横向 4 步，最后一步下面挂一个可选的升级分支。
 * ───────────────────────────────────────────── */
export const roadmapScene: El[] = [
	txt(30, 30, '落地路径', 22),
	txt(32, 68, '先用最小闭环跑通，再考虑画质升级', 13, C.muted),

	box(25, 130, 145, 72, 'ComfyUI WebUI\n搭工作流并调优', C.engine, 13),
	box(185, 130, 145, 72, '导出\nAPI JSON 模板', C.control, 13),
	box(345, 130, 145, 72, '写薄编排层\n约 200 行', C.llm, 13),
	box(505, 130, 145, 72, 'SD1.5\n+ ControlNet 起步', C.output, 13),

	hFlow(170, 185, 166),
	hFlow(330, 345, 166),
	hFlow(490, 505, 166),

	// 可选升级分支
	vArrow(577, 202, 262, C.muted),
	box(505, 262, 145, 72, '（可选）SDXL\n+ fp8 + Tiled VAE', C.neutral, 12),

	txt(25, 372, '编排层留出 model 与 resolution 参数槽位，底模可平滑切换', 13, C.muted),
];
