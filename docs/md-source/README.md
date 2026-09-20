# md-source —— mdx 文章的纯 Markdown 版本

本目录的文件是**自动生成的**，请勿手工编辑（下次构建会被覆盖）。

## 为什么有这个目录

部分文章的源文件是 `.mdx`，因为它们需要 `import` 画板组件：

```mdx
import WhiteboardLoader from '../../components/whiteboard/WhiteboardLoader.astro';
import { holBlockingScene } from '../../components/whiteboard/http-versions.scenes';

<WhiteboardLoader elements={holBlockingScene} label="…" height={540} />
```

`.mdx` 只适合本站构建。一旦要**复制到其他平台**（掘金、知乎、Notion、
公司内网 wiki 等），JSX 与自定义组件要么不被支持，要么渲染结果完全不同 ——
所以在 `src/content/blog/` 之外存一份「无组件依赖」的纯 Markdown。

## 生成方式

```bash
npm run md-source    # 单独生成
npm run build        # 构建站点时会顺带生成，保持同步
```

源文件：`src/content/blog/*.mdx`
生成脚本：`scripts/build-md-source.mjs`

脚本每次**全量重建**（先清空本目录），因此删除源文件后这里不会残留孤儿文件。

## 转换规则

| 处理 | 说明 |
|---|---|
| 去掉 `import` 语句 | 只 import 画板组件，正文不需要 |
| `<WhiteboardLoader … />` | 替换为一行引用式占位提示 |
| `<details>` 外壳 | 拆掉，保留内部的 ASCII 图（多数 Markdown 渲染器不认 `<details>`）|
| `<summary>` | 简化为「**ASCII 图**」（原文措辞是相对交互式画板而言的，这里没有指代对象了）|
| 其余正文 | 原样保留 |

**注意**：脚本只删「出现在行首的 `import … from '…'`」，代码块里的
`import requests` 之类不会被动 —— 实测对比过围栏数量一致。

## 关于画板

纯 Markdown 里**没有**交互式画板，只有占位提示：

```markdown
> **图：HTTP 过滤器链完整时序**
> （原文此处为交互式画板，本文件为纯 Markdown 版本，不含该图）
```

如果某张图有 `<details>` 里的 ASCII 兜底，会紧跟着以 `**ASCII 图**` 保留下来。

> 不是每张画板都有 ASCII 兜底（实测 6 篇中只有 1 篇全部覆盖）。
> 若需要完整版本，请看 `.mdx` 原文或线上的文章页面。

## 目录位置为什么在 docs/ 下

`src/content.config.ts` 的 loader 是：

```ts
glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' })
```

如果把这份 `.md` 放在 `src/content/blog/` 或其子目录，它会被当成
**另一篇文章再收录一遍**，站点上就会出现同名重复内容。
放在 `docs/` 下天然避开了这个 glob。

## 当前覆盖范围

只有 `.mdx` 文章需要转换 —— `.md` 文章本身就是纯 Markdown，直接在
`src/content/blog/` 里即可，无需副本。所以本目录的文件数应等于
`src/content/blog/*.mdx` 的数量。
