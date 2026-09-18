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
					pre(node) {
						// 给代码块加 data-line-numbers，CSS 据此渲染行号栏
						node.properties['data-line-numbers'] = 'true';
					},
				},
			],
		},
	},
});