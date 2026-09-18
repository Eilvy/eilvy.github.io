# 项目架构分析

> 本文档描述 eilvy.github.io 博客（Astro 静态站点）的整体结构、关键机制与维护指引。
> 写于 2026-09，对应代码为同批「代码整理」提交后的状态。

---

## 1. 技术栈与版本

| 组件 | 版本 | 说明 |
|---|---|---|
| Astro | 5.18.1 | 静态站点生成，`output: static`（默认，未显式配置） |
| Vite | 6.4.2 | 由 Astro 5 内置，**不是直接依赖** |
| @astrojs/react | 4.4.2 | React 岛集成 |
| @vitejs/plugin-react | 4.7.0 | 由上一项间接引入 |
| React / ReactDOM | 18.3.1 | 仅画板用到 |
| @excalidraw/excalidraw | 0.18.1 | 只读画板渲染 |
| Tailwind CSS | 3.4.19 | 仅用 `@tailwindcss/typography` 的 `prose` |
| Shiki | 随 Astro | 代码高亮，主题 `one-dark-pro` |

### ⚠️ 版本约束（重要）

**`@astrojs/react` 的大版本必须与 Astro 所用的 Vite 大版本对齐。**

Astro 5.18 → Vite 6 → 必须用 `@astrojs/react@4`（其依赖 `plugin-react@4`）。
若误装 `@astrojs/react@6`（要求 Vite 8 / `plugin-react@5`），会出现：

- `plugin-react@5` 不再导出 `preambleCode`，`@astrojs/react` 拿到 `undefined`
- React Fast Refresh 的 preamble 从未注入
- **dev 环境下**任何 React 岛加载即抛
  `@vitejs/plugin-react can't detect preamble. Something is wrong.`
- 而**生产构建不受影响**（无 HMR），极易漏测

升级 Astro 时须同步核对此项。

---

## 2. 目录结构

```
.
├── astro.config.mjs            # 构建配置（集成、Shiki 代码高亮）
├── package.json                # 依赖与脚本（dev / build / check / preview）
├── tailwind.config.js          # 仅启用 typography 插件
├── tsconfig.json               # 继承 astro/tsconfigs/base，paths 别名 @/*
├── .github/workflows/deploy.yml # 推 main 自动部署到 GitHub Pages
├── public/                     # 原样拷贝的静态资源（favicon、robots.txt）
├── docs/
│   ├── ARCHITECTURE.md         # 本文档（结构与机制）
│   └── WHITEBOARD_GUIDE.md     # 画板绘制指南（布局技巧与踩坑）
├── plan/                       # 历史设计与实施记录（非运行时代码）
│   ├── STAGE5_CONTENT_GUIDE.md
│   ├── build-plan/             # 建站各阶段完成记录
│   └── update-plan/            # 历次功能变更方案
└── src/
    ├── consts.ts               # 站点级常量（标题/描述/邮箱/GitHub/每页条数）
    ├── content.config.ts       # 内容集合 schema（Astro 5 的配置位置）
    ├── content/blog/           # 文章源文件（.md / .mdx）
    ├── types/blog.ts           # 博客数据的共享类型
    ├── utils/posts.ts          # 文章排序、日期、标签等纯函数
    ├── data/                   # 友链数据（friends.json + .d.ts）
    ├── styles/global.css       # 全站样式（含暗色模式与代码块方案）
    ├── assets/                 # 需经 Astro 优化的图片
    ├── layouts/                # 页面骨架（见下）
    ├── components/             # 可复用 UI（见下）
    │   └── whiteboard/         # 画板子系统（见第 5 节）
    └── pages/                  # 路由（文件即路由）
```

### `layouts/` —— 页面骨架

三层嵌套，职责自外向内收窄：

| 文件 | 职责 |
|---|---|
| `BaseLayout.astro` | `<html>` 外壳、主题引导脚本（防 FOUC）、SEO、跳过链接 |
| `BlogLayout.astro` | 在 BaseLayout 之上加 Header / `<main>` / Footer，转发 SEO 参数 |
| `PostLayout.astro` | 文章页专用：hero 图、标题、日期、标签、目录侧栏、分类页脚 |

### `components/` —— 可复用 UI

| 文件 | 职责 |
|---|---|
| `Header.astro` | 顶部导航 + 主题切换 + GitHub 入口 |
| `HeaderLink.astro` | 导航项，自动标记当前页 |
| `Footer.astro` | 页脚（站点信息 + 友链，数据来自 `data/friends.json`） |
| `PostCard.astro` | 列表页文章卡片（含「更新于」标记） |
| `Tag.astro` | 标签胶囊，可作链接或纯展示 |
| `FormattedDate.astro` | 日期格式化，支持紧凑 / 长格式 |
| `SEO.astro` | meta / OpenGraph / canonical / JSON-LD |
| `TableOfContents.astro` | 文章目录侧栏 + 滚动高亮 |
| `whiteboard/` | 画板子系统，见第 5 节 |

### 各层职责边界

| 位置 | 职责 | 不该放什么 |
|---|---|---|
| `content/blog/` | 只写正文与 frontmatter | 不写组件逻辑（需要交互时用 `.mdx`） |
| `layouts/` | 页面级骨架，组合 head / header / footer / 内容槽 | 不放具体业务数据 |
| `components/` | 可复用 UI | 不直接读 `getCollection`（数据由页面层传入） |
| `pages/` | 路由 + 数据获取 + 排序 | 不堆样式细节（放组件或 global.css） |
| `utils/` | 纯函数，无副作用 | 不依赖 DOM |
| `types/` | 类型定义 | 不放运行时值 |
| `plan/` | 历史方案存档 | 不放会随代码演进的说明（那属于 `docs/`） |

---

## 3. 内容管线

### 3.1 Schema

`src/content.config.ts` 用 Astro 的 glob loader 加载 `src/content/blog/**/*.{md,mdx}`，
字段定义即 frontmatter 的唯一真相：

```ts
title, description, pubDate, updatedDate?,
heroImage?（经 image() 校验，自动转 ImageMetadata）,
tags[], categories[], draft, author, pin, pinOrder
```

对应到 `src/types/blog.ts` 的 `BlogPostData`。此前 `PostCard` / `PostLayout`
各写一份类型且字段不一致，现已收敛为单一来源。

### 3.2 frontmatter 约定

| 字段 | 约定 |
|---|---|
| `pubDate` | 创建时间，必填 |
| `updatedDate` | **只在真正更新过时写**。缺省即视为「更新时间 = 创建时间」 |
| `pin` / `pinOrder` | 置顶与置顶间排序（`pinOrder` 越小越靠前） |
| `draft` | `true` 则不出现在任何列表与 RSS |

### 3.3 排序规则（`src/utils/posts.ts`）

```
置顶优先 → 同为置顶按 pinOrder 升序 → 其余按「有效更新时间」倒序
```

「有效更新时间」= `updatedDate ?? pubDate`。

首页、博客列表、标签页、RSS **全部**走 `getSortedPosts()`，
避免此前四处各写一套排序逻辑（其中首页那份还用了 `as any`）。

### 3.4 路由

| 路由 | 文件 | 说明 |
|---|---|---|
| `/` | `pages/index.astro` | 首页，展示最新 `POSTS_PER_PAGE`（6）篇 + 标签云 |
| `/blog` | `pages/blog/index.astro` | 全部文章 |
| `/blog/<id>` | `pages/blog/[...slug].astro` | 文章详情（含目录侧栏） |
| `/tags/<tag>` | `pages/tags/[tag].astro` | 按标签筛选 |
| `/about` | `pages/about.astro` | 个人介绍 |
| `/rss.xml` | `pages/rss.xml.ts` | RSS，`pubDate` 取有效更新时间 |

标签路由由 `getStaticPaths` 从实际文章聚合生成（此前把「全部文章」和
「已发布文章」混用，会导致草稿的标签也生成空页面）。

---

## 4. 样式组织

`src/styles/global.css` 是唯一全局样式文件，按以下顺序分区：

```
1. CSS 变量（浅色）
2. 深色模式变量覆盖（html.dark）
3. 基础重置 / 可访问性焦点
4. 排版（.prose 及其元素）
5. 代码块（含行号方案）
6. 画板（内嵌视图 + 全屏查看器）
7. 其他元素（引用块/列表/图片/表格/水平线）
8. 主容器 / 滚动条 / 响应式 / 打印 / 辅助类
```

### 4.1 暗色模式

- 站点在 `<html>` 上加减 `.dark` 类（`BaseLayout` 内联脚本在 CSS 前执行，防 FOUC）
- 所有颜色走 CSS 变量，`html.dark` 只覆盖变量值
- 组件内的样式用 `var(--color-*)`，不写死颜色

### 4.2 代码块与行号（易踩坑，改动前必读）

Shiki 输出形如 `<code><span class="line">…</span>\n<span class="line">…</span></code>`，
**相邻 `span` 之间有真实的换行文本节点**。由此有两条硬约束：

1. **`.line` 必须保持 `display: inline`**
   改成 `block` 后那些 `\n` 会各自生成一个行盒，每行代码后多出一个空行，
   行距直接翻倍。

   > 验证口径：行距应恒等于 `line-height`。移动端断点（≤768px，根字号 14px）
   > 实测 21px → 42px；桌面端（根字号 16px）行距为 24px。
   > 两个断点下「行距 == line-height」都成立，翻倍时则明显不等。

2. **代码块不折行（`wrap: false`）**
   行号是每个 `.line` 的 `::before`。一旦折行，续行不属于行号的可见行首，
   会与行号列错位，ASCII 图也失去对齐意义。超宽内容由横向滚动承载。

行号栏宽度由三个 CSS 变量统一描述（`--gutter-inset` / `--gutter-num` / `--gutter-gap`），
底色渐变的宽度复用同一组变量，避免「底色带宽」与「行号实际占位」两处各写一个数字而错位。

> 曾因用 `em` 定位行号（行号自身有 `font-size: 0.75em` 缩放，与 `pre` 的 `em` 基准不一致）
> 导致数字越过分隔线，现统一用 `rem` / 变量。

### 4.3 行内代码

需覆盖 `@tailwindcss/typography` 的两处默认行为：

- 它会用 `:where(code)::before/::after` 注入 `content: "\`"`，
  使行内代码被渲染成 `` `cpu.max` `` 的样子 → 须 `content: none`
- 其 `--tw-prose-code` 只有浅色值，暗色下文字几乎不可见 → 改用项目自己的
  `--code-text` / `--code-bg`

另外 `.prose pre code` 必须显式 `color: inherit`：Shiki 代码块是固定深色主题
（内联 `background:#282c34`），浅色模式下若继承 `--code-text` 会深字压深底。

---

## 5. 画板子系统

这是项目中唯一带客户端交互的部分，也是踩坑最多的地方。

> **本节讲「怎么实现」；「怎么画」见 [WHITEBOARD_GUIDE.md](./WHITEBOARD_GUIDE.md)**
> （布局技巧、配色约定、箭头用法、交付前自查清单）。

### 5.1 文件

分三层：**通用外壳 / 共享件 / 场景数据**。

| 文件 | 层级 | 职责 |
|---|---|---|
| `WhiteboardLoader.astro` | 外壳 | 通用懒加载容器：占位按钮 + `<template>` + 克隆挂载。所有画板统一用它 |
| `Whiteboard.tsx` | 外壳 | React 组件：内嵌视图（只读插图）+ 全屏查看器两种模式 |
| `scene-kit.ts` | 共享件 | 配色常量、字体常量、布局件（`txt`/`box`/`vArrow`/`hArrow`/`hFlow`/`groupFrame`/`vStack`） |
| `osi-flow.scenes.ts` | 场景数据 | OSI 一文的 6 张图：总览 + 四跳 + veth 内核实现 |
| `veth-pair.scene.ts` | 场景数据 | veth pair 拓扑 |

**新增一张画板的做法**：写一个场景数据文件（纯数据、单一配色），
在 `.mdx` 里 `import` 场景与 `WhiteboardLoader`，传 `elements` 即可 ——
不需要再写专用包装组件（早期 `VethPairWhiteboard.astro` 那种转发壳已移除，
因为 6 个画板都用同一个外壳，多一层包装只会增加维护面）。

**场景数据只写「骨架」字段**，`id` / `seed` / `version` / 绑定关系由
`convertToExcalidrawElements` 补全。

### 5.2 懒加载（点击加载）

Excalidraw 主 chunk 约 **1.1MB（gzip 约 361KB）**。若直接
`<Whiteboard client:only="react" />`，打开文章就会下载执行 —— 哪怕读者不看图。

采用 `<template>` + 克隆：

```
页面加载 → <template> 内的 island 不连接 DOM，组件不被 import
读者点击 → 克隆模板内容到 .wb-mount → island 接入 DOM → 自动 hydrate
```

**实测：点击前 0KB JS / 0 个 island；点击后约 1256KB。**

> **为什么不用手动 `import('./Whiteboard.tsx')`？**
> 生产可用，但 `astro dev` 必然失败。原因：Vite 的 React Fast Refresh 需要
> preamble（`$RefreshReg$`），`@astrojs/react` 是把它作为 `before-hydration`
> 脚本、以「**每个 island 一个 `before-hydration-url` 属性**」注入的
> （见 `astro/dist/runtime/server/hydration.js`）。只有经 Astro 渲染流程产出的
> island 才带该属性，手动 import 绕过整条链路，拿不到 preamble。
> 改为 `<template>` 后 island 由 Astro 正常产出，dev/prod 均可。

**多画板共存的关键**：Astro 的 island 运行时脚本（定义 `self.Astro.only` 与
`customElements.define('astro-island')`）整页**只输出一次**，且会被排进
**第一个** `<template>` 内。`<template>` 内容是惰性的，脚本不执行 ——
于是直接点非首个画板时，克隆出的 `<astro-island>` 是未知元素、无人处理。
因此 `WhiteboardLoader` 在插入 island 前会先把引导脚本从模板取出、
重建为可执行节点追加到 `head`（只执行一次；含 `customElements.define`，
重复执行会抛错）。

### 5.3 两种显示模式

| | 内嵌（inline） | 弹窗（dialog） |
|---|---|---|
| 定位 | 文章里的插图 | 点击后的全屏查看器 |
| 尺寸 | 240px 占位 → 380px 画布 | 铺满可视区（窄屏全屏） |
| 交互 | **仅可点击放大**，不可拖动/缩放 | 可缩放、平移、适应窗口 |
| 滚轮 | 交还页面滚动 | 用于画布缩放 |
| 拖动 | 被屏蔽层拦截 | 正常 |

设计意图：把「阅读流」与「操作画布」分开，避免正文里误触把页面滚走或把图拖跑。

### 5.4 交互屏蔽层（`.wb-shield`）

viewMode 下 Excalidraw 仍会渲染一个 `pointer-events: auto` 的
`.excalidraw__canvas.interactive`（`cursor: grab`），读者能把插图拖着跑。

处理方式是**盖一层透明层吃掉指针事件**，而不是覆盖 Excalidraw 的内部类名
（后者属于私有实现，升级即可能失效）。

> **坑**：屏蔽层初版无效。用 `elementsFromPoint`（不是 `elementFromPoint`）
> 打出堆叠顺序才看清：画布带 `z-index: 2`（其 `--zIndex-canvas`），
> 而屏蔽层是 `z-index: auto`，被压在下面。补 `z-index: 3`
> 并让 `.whiteboard` 建立层叠上下文后生效。

### 5.5 主题跟随

站点用 `html.dark` 切换主题，画板通过 `MutationObserver` 监听该类名。

**关键：场景数据只需要一套「浅色主题」配色，不要为暗色再写一套。**
Excalidraw 在 `theme--dark` 下会给画布整体套
`filter: invert(93%) hue-rotate(180deg)`（见其 `index.css`），
深色字会被自动反相成亮色、白底变深底。
若额外准备「浅色文字」，会被**再反相一次变回深色**，反而出现暗底暗字。

### 5.6 字体

场景文字固定用 Excalidraw 标记为 `local` 的 Helvetica（`fontFamily: 2`）。
默认的 Excalifont / 中文回退 Xiaolai 是**运行时从 unpkg CDN 按需拉取**的
（中文子集约 200+ 个、总计约 12MB），加载失败时文字按 fallback 渲染，
而元素宽度是按另一字体量出的，会导致文字被裁切（实测副标题末尾被切掉）。

另需在字体就绪后 `scrollToContent` 一次，修正首帧取宽不准造成的视口偏差。

---

## 6. 关键约束与踩坑速查

| 现象 | 根因 | 处理 |
|---|---|---|
| dev 下 React 岛报 `can't detect preamble` | `@astrojs/react` 与 Vite 大版本不匹配 | 见第 1 节版本约束 |
| 同上（版本已正确） | 手动 `import()` 绕过了 island 的 preamble 注入 | 改用 `<template>` + 克隆 |
| 代码块行距翻倍 | `.line` 被设为 `display: block`，Shiki 的 `\n` 各生成一个行盒 | 保持 `display: inline` |
| 行号与代码错位 | 代码块折行，或行号用 `em` 定位（基准不一致） | `wrap: false`；行号用 `rem`/变量 |
| 行内代码显示成 `` `x` `` | Typography 注入 `content: "\`"` | `::before/::after { content: none }` |
| 暗色下行内代码不可见 | Typography 的 `--tw-prose-code` 无深色值 | 改用项目 `--code-text/--code-bg` |
| 浅色下代码块几乎看不见 | `pre code` 继承了浅色主题的深色 `--code-text` | `pre code { color: inherit }` |
| 画板暗色下文字过暗 | 为暗色多准备了一套配色，被反相两次 | 只用一套浅色配色 |
| 画板文字被裁切 | CDN 字体加载失败，取宽与渲染不一致 | 用 `local` 的 Helvetica |
| 点击后画板不显示且提前出现「正在加载」 | 面板用 `hidden` 属性但 CSS 是 `display: flex`（author 覆盖 UA 的 `[hidden]`） | 改用 `data-state` 精确控制 `display` |
| 内嵌画板能被拖动 | `interactive` canvas 的 `pointer-events: auto` | 加 `.wb-shield`（需 `z-index` 高于画布） |
| 画板拖走了页面滚动 | Excalidraw 的 `handleWheel` 对 canvas 一律 `preventDefault` | 捕获阶段 `stopPropagation`（不 preventDefault） |
| 只点非首个画板时加载不出来，倒序点到第一个却全部出现 | Astro 的 island 运行时脚本整页只输出一次，且被排进**第一个** `<template>` 内；`<template>` 惰性，脚本不执行，`<astro-island>` 是未知元素无人处理。点到第一个时引导脚本才随克隆进入 DOM 并执行，浏览器追溯升级此前所有 island | 插入 island 前先把引导脚本从模板取出、重建为可执行节点追加到 `head`（只执行一次，含 `customElements.define` 重复执行会抛错） |
| 箭头标注偏离箭头 | 标注是独立的 `text` 元素、坐标硬编码，与算出来的箭头位置无关联 | 改用箭头内置 `label`（Excalidraw 自动居中）。注意 label 过长会在箭头上折行盖住箭头，需同时放宽箭头间距或缩短文字 |

---

## 7. 常见修改指引

**新增一篇文章**
在 `src/content/blog/` 加 `.md`（需要嵌入组件时用 `.mdx`），frontmatter 至少写
`title` / `description` / `pubDate` / `tags` / `categories`。
排名会自动按「有效更新时间」插入，无需手动调整。

**更新已有文章**
把 `updatedDate` 设为当天，它会自动排到前面并在列表卡片显示「更新于」。
不要写与 `pubDate` 相同的 `updatedDate`（会被 `isUpdated` 判为未更新而不显示）。

**调整首页条数**
改 `src/consts.ts` 的 `POSTS_PER_PAGE`。

**新增一个画板**
1. 在 `components/whiteboard/` 写场景数据（纯数据、**单一浅色配色**，
   暗色交给 Excalidraw 反相；用 `scene-kit` 的 `box`/`txt`/`vArrow` 等搭）
2. 在 `.mdx` 里 `import` 该场景与 `WhiteboardLoader`，传 `elements` / `label` /
   `height` 即可 —— 无需另写包装组件
3. 箭头标注一律用箭头自带的 `label`（不要另写 `text` 元素，否则会偏）；
   label 过长会在箭头上折行盖住箭头，此时应放宽箭头间距或缩短文字

**新增文章里的图（不改代码）**
非交互场景直接用 Markdown 图片即可；只有需要缩放/平移等交互才上画板。

**改主题色 / 新增颜色**
在 `global.css` 的 `:root` 与 `html.dark` 两处同步加变量，组件里用 `var()` 引用。

---

## 8. 开发与验证

```bash
npm run dev      # 开发服务器
npm run build    # 生产构建 → dist/
npm run check    # 类型检查（astro check）
npm run preview  # 预览构建产物
```

**改动画板相关代码后，务必同时验证 dev 与 build 两条路径** ——
此前若干问题只在 `astro dev` 下复现（HMR 机制与生产不同），
只用构建产物测会漏掉。

---

## 9. 已知待办

- `about.astro`（约 380 行）含大量个人内容与样式，尚未细拆
- `friends.json` 中的 GitHub 链接与 `consts.ts` 的 `MY_GITHUB` 存在重复来源
- 画板弹窗初始缩放偏大（fit 后约 160%），如需更「收敛」可调 `viewportZoomFactor`