---
title: 'Astro 框架入门指南'
description: '深入了解 Astro 框架的核心概念、岛屿架构和快速上手教程'
pubDate: 2026-04-16
tags: ['astro', 'framework', 'tutorial']
categories: ['前端框架']
heroImage: '../../assets/blog-placeholder-2.jpg'
author: 'eilvy'
---

## 🚀 Astro 是什么？

Astro 是一个现代化的静态站点生成器（SSG），专为内容驱动的网站而设计。它的核心理念是**零 JavaScript 运行时**，这意味着默认情况下不会向浏览器发送任何 JavaScript 代码。

### 核心特性

#### 1. 零 JavaScript 运行时

Astro 会在构建时将组件渲染为纯 HTML 和 CSS，不添加任何 JavaScript 运行时开销。

```astro
---
// 这段代码只在构建时运行
const title = 'Hello World';
---

<h1>{title}</h1>
<!-- 输出为纯 HTML -->
```

#### 2. 岛屿架构（Islands Architecture）

Astro 采用岛屿架构，只在需要交互的地方加载 JavaScript 组件：

```astro
---
import InteractiveComponent from '../components/InteractiveComponent.jsx';
---

<!-- 静态内容 -->
<div>这是静态内容</div>

<!-- 交互式组件，只在客户端加载 -->
<InteractiveComponent client:load />
```

#### 3. 多框架支持

你可以在同一个项目中混合使用多种框架：

```astro
---
import ReactComponent from '../components/ReactComponent.jsx';
import VueComponent from '../components/VueComponent.vue';
import SvelteComponent from '../components/SvelteComponent.svelte';
---

<ReactComponent />
<VueComponent />
<SvelteComponent />
```

## 📦 快速开始

### 安装 Astro

```bash
# 使用 npm
npm create astro@latest

# 使用 pnpm
pnpm create astro

# 使用 yarn
yarn create astro
```

### 项目结构

```
my-astro-blog/
├── src/
│   ├── components/    # 可复用组件
│   ├── layouts/       # 布局组件
│   ├── pages/         # 页面路由
│   └── content/       # Markdown 内容
├── public/            # 静态资源
├── astro.config.mjs   # Astro 配置
└── package.json
```

### 创建第一个页面

创建 `src/pages/index.astro`：

```astro
---
import Layout from '../layouts/Layout.astro';
---

<Layout title="我的博客">
  <h1>欢迎来到我的博客！</h1>
  <p>这是使用 Astro 构建的静态网站。</p>
</Layout>
```

## 🎨 Markdown 支持

Astro 原生支持 Markdown 和 MDX，可以轻松地创建博客文章：

```markdown
---
title: '我的第一篇文章'
pubDate: 2026-04-15
---

# 标题

这是文章内容...
```

## 🔧 常用指令

```bash
# 开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 📚 学习资源

- [Astro 官方文档](https://docs.astro.build/)
- [Astro 示例项目](https://astro.build/examples/)
- [岛屿架构介绍](https://jasonformat.com/islands-architecture/)

## 💡 小结

Astro 是一个强大且灵活的框架，特别适合内容驱动的网站。它的零 JavaScript 运行时特性和岛屿架构使其在性能方面表现优异。

如果你正在寻找一个快速、轻量级的网站构建工具，Astro 绝对值得尝试！
