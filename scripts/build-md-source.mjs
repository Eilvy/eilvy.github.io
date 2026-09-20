#!/usr/bin/env node
/**
 * 从 src/content/blog 的 .mdx 生成纯 Markdown 版本到 docs/md-source/。
 *
 * ── 为什么要这个目录 ──
 * 部分文章的源文件是 .mdx，因为它需要 import 画板组件（<WhiteboardLoader>）。
 * 但 .mdx 不适合直接复制到其他平台（组件在那里的渲染结果千差万别，
 * 也可能根本不支持 JSX）。所以这里生成一份「无组件依赖」的纯 Markdown，
 * 供复制、归档、或在别的编辑器里阅读。
 *
 * ── 转换规则 ──
 * 1. 去掉顶部 import 语句（那里只 import 画板组件，正文不需要）
 * 2. <WhiteboardLoader> 整块替换为一行引用式占位提示
 * 3. <details> 外壳拆掉，保留内部的 ASCII 兜底内容
 *    （多数 Markdown 渲染器不认 <details>；拆掉后内容更可移植）
 * 4. 其余正文原样保留
 *
 * 目录刻意放在 docs/ 下，而不是 src/content/blog/ —— 后者的 glob 是
 * `**\/*.{md,mdx}`，放进去会被当成独立文章再收录一遍，站点出现重复内容。
 *
 * 用法：node scripts/build-md-source.mjs
 */

import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'src/content/blog');
const OUT_DIR = path.join(ROOT, 'docs/md-source');

/**
 * 把一段 mdx 转成纯 Markdown。
 * @param {string} mdx
 * @returns {string}
 */
function toPlainMarkdown(mdx) {
	let out = mdx;

	// 1) 去掉整段 import（含多行解构导入）
	//    形如：import X from '...';  或  import { a, b } from '...';
	out = out.replace(/^import\s+[\s\S]*?from\s+'[^']+';?\s*$/gm, '');
	// 解构导入会跨多行，上面那条只吃掉首行，这里再清掉残留的括号行
	out = out.replace(/^\s*\}?\s*from\s+'[^']+';?\s*$/gm, '');

	// 2) 画板整块 → 占位提示
	//    <WhiteboardLoader ... /> 可能跨多行，label 里是图的说明
	out = out.replace(
		/<WhiteboardLoader\b([\s\S]*?)\/>/g,
		(_match, attrs) => {
			const label = /label="([^"]*)"/.exec(attrs)?.[1] ?? '';
			const text = label ? `图：${label.split('：')[0]}` : '图';
			// 用引用块提示，避免看起来像正文
			return `> **${text}**\n> （原文此处为交互式画板，本文件为纯 Markdown 版本，不含该图）`;
		}
	);

	// 3) 拆掉 <details> 外壳，保留内部 ASCII 内容
	//
	// summary 原文是「等价的 ASCII 图（便于复制 / 无 JS 环境）」——
	// 那是网页语境下的措辞（相对上面的交互式画板而言）。
	// 到了纯 Markdown 里画板已被换成占位提示，再叫「等价的」就没有指代对象了，
	// 所以这里简化成「ASCII 图」，并去掉与网页相关的括注。
	out = out.replace(
		/<details>\s*<summary>[\s\S]*?<\/summary>/g,
		'**ASCII 图**'
	);
	out = out.replace(/<\/details>/g, '');

	// 4) 收敛多余空行（删掉 import 后会留下连续空行）
	out = out.replace(/\n{3,}/g, '\n\n');
	out = out.trimEnd() + '\n';

	return out;
}

async function main() {
	// 每次全量重建，避免删除源文件后这里留下孤儿。
	// 只清理本脚本生成的 .md —— 目录里还有一份手写的 README.md，不能一起删掉。
	await mkdir(OUT_DIR, { recursive: true });
	for (const f of await readdir(OUT_DIR)) {
		if (f.endsWith('.md') && f !== 'README.md') {
			await rm(path.join(OUT_DIR, f), { force: true });
		}
	}

	const entries = await readdir(SRC_DIR);
	const mdxFiles = entries.filter((f) => f.endsWith('.mdx')).sort();

	if (!mdxFiles.length) {
		console.log('没有找到 .mdx 文件，未生成任何内容。');
		return;
	}

	for (const file of mdxFiles) {
		const src = path.join(SRC_DIR, file);
		const raw = await readFile(src, 'utf8');
		const md = toPlainMarkdown(raw);
		const outName = file.replace(/\.mdx$/, '.md');
		await writeFile(path.join(OUT_DIR, outName), md, 'utf8');
		console.log(`  ${file}  →  docs/md-source/${outName}`);
	}

	console.log(`\n共生成 ${mdxFiles.length} 个 Markdown 文件到 docs/md-source/`);
}

main().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
