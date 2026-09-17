// @ts-check

import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://eilvy.github.io',
	integrations: [mdx(), react(), sitemap(), tailwind()],
	markdown: {
		shikiConfig: {
			theme: 'one-dark-pro',
			// 不折行：折行会让续行与行号列错位，也会破坏 ASCII 图（拓扑/协议栈示意）的对齐。
			// 超宽内容改由代码块的横向滚动承载（见 global.css 的 pre[data-line-numbers]）。
			wrap: false,
			transformers: [
				{
					pre(node) {
						// 添加行号属性
						node.properties['data-line-numbers'] = 'true';
					},
				},
			],
		},
	},
	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Atkinson',
			cssVariable: '--font-atkinson',
			fallbacks: ['sans-serif'],
			options: {
				variants: [
					{
						src: ['./src/assets/fonts/atkinson-regular.woff'],
						weight: 400,
						style: 'normal',
						display: 'swap',
					},
					{
						src: ['./src/assets/fonts/atkinson-bold.woff'],
						weight: 700,
						style: 'normal',
						display: 'swap',
					},
				],
			},
		},
	],
});
