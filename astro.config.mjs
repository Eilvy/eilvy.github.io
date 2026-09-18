// @ts-check

import mdx from '@astrojs/mdx';
import remarkCjkFriendly from 'remark-cjk-friendly';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import { defineConfig } from 'astro/config';

/*
 * 站点构建配置。
 *
 * 关于依赖版本：@astrojs/react 必须与 Astro 所用的大版本 Vite 对齐 ——
 * Astro 5.18 用 Vite 6，因此这里用 @astrojs/react@4（plugin-react@4）。
 * 若装成 @astrojs/react@6（需 Vite 8 / plugin-react@5），dev 下
 * React Fast Refresh 的 preamble 注入会失败，画板等 React 岛直接报错。
 */
export default defineConfig({
	site: 'https://eilvy.github.io',
	integrations: [
		mdx({ remarkPlugins: [remarkCjkFriendly] }),
		react(),
		sitemap(),
		tailwind(),
	],
	/*
	 * remark-cjk-friendly：修正 CommonMark 的 emphasis 边界规则在中文语境下的失效。
	 *
	 * 问题：`**` 能否成对，取决于两侧字符是否「flanking」。中文里
	 * `**「引用」**` 这种写法中，起始 ** 后面紧跟全角引号（属于标点），
	 * 按 CommonMark 规则它既不是 left-flanking 也不是 right-flanking ——
	 * 于是 ** 原样输出，加粗失效（实测本文就有两处）。
	 *
	 * 该插件放宽了 CJK 标点附近的判定，让 `**中文**`、`**「中文」**`
	 * 都能正常加粗。markdown 与 mdx 两条管线都要挂。
	 */
	markdown: {
		remarkPlugins: [remarkCjkFriendly],
		shikiConfig: {
			theme: 'one-dark-pro',
			// 不折行：折行会让续行与行号列错位，也会破坏 ASCII 图（拓扑/协议栈示意）的对齐。
			// 超宽内容改由代码块的横向滚动承载（见 global.css 的 pre[data-line-numbers]）。
			wrap: false,
			transformers: [
				{
					/*
					 * 把代码块重构成「固定行号栏 + 可滚动代码区」两列。
					 *
					 * ── 为什么必须改 DOM ──
					 * 原先 pre 既是视觉容器、又是横向滚动容器，行号是
					 * .line 的 ::before —— 属于滚动内容，一横向滚动就跟着
					 * 滚出可视区；语言标签挂在 pre::after 上，同样被带走。
					 *
					 * 试过但不可行的办法：
					 *   - ::before 加 position:sticky —— 伪元素是 inline-block，
					 *     sticky 不生效（实测滚动后行号仍在可视区外）
					 *   - 把 .line 改 display:block 再加 sticky —— 会破坏
					 *     Shiki 用 \n 文本节点分行 的机制，行距翻倍
					 * 因此改为：pre 不再滚动（overflow:hidden），
					 * 内部拆成 gutter（固定）+ scroller（滚动）两列。
					 * 这样 pre::after 的语言标签也自然固定住了。
					 */
					/** @param {import('hast').Element} node */
					pre(node) {
						node.properties['data-line-numbers'] = 'true';

						/** @param {import('hast').ElementContent} n */
						const isEl = (n) => n.type === 'element';

						/** @param {import('hast').Element} el */
						const classNameOf = (el) => {
							const v = el.properties?.className ?? el.properties?.class ?? '';
							return Array.isArray(v) ? v.join(' ') : String(v);
						};

						const code = node.children.find((c) => isEl(c) && c.tagName === 'code');
						if (!code || !isEl(code)) return;

						const lines = (code.children ?? []).filter(
							(c) => isEl(c) && c.tagName === 'span' && classNameOf(c).includes('line')
						);
						if (!lines.length) return;

						// 行号栏：每行一个等高格子，与代码行一一对应
						/** @type {import('hast').Element} */
						const gutter = {
							type: 'element',
							tagName: 'span',
							properties: { className: ['code-gutter'], 'aria-hidden': 'true' },
							children: lines.map((_, i) => ({
								type: 'element',
								tagName: 'span',
								properties: { className: ['code-gutter__num'] },
								children: [{ type: 'text', value: String(i + 1) }],
							})),
						};

						// 代码区：外面套一层滚动容器，只有它横向滚动
						/** @type {import('hast').Element} */
						const scroller = {
							type: 'element',
							tagName: 'span',
							properties: { className: ['code-scroll'] },
							children: [code],
						};

						node.children = [gutter, scroller];
					}				},
			],
		},
	},
});