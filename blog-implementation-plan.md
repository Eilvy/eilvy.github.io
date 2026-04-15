# 博客项目实现方案

## 项目概述

本项目旨在构建一个简洁、高效、易于维护的个人博客系统，部署在 GitHub Pages 上。

## 技术选型

### 推荐方案：Astro + Markdown

**选择理由：**
- 零 JavaScript 运行时，性能极佳
- 原生支持 Markdown/MDX 内容
- 静态站点生成，完美适配 GitHub Pages
- 学习曲线平缓，开发体验好
- 支持组件化（React/Vue/Svelte 可选）

### 备选方案

1. **Hexo** - 成熟的静态博客框架，插件丰富
2. **VitePress** - 基于 Vite，适合技术文档型博客
3. **Next.js + MDX** - 需要更多交互功能时的选择

## 项目结构

```
eilvy.github.io/
├── public/              # 静态资源
│   ├── images/         # 图片资源
│   └── favicon.ico     # 网站图标
├── src/
│   ├── components/     # UI 组件
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── PostCard.astro
│   │   └── Layout.astro
│   ├── content/        # 博客内容
│   │   └── posts/      # Markdown 文章
│   │       ├── post-1.md
│   │       └── post-2.md
│   ├── layouts/        # 页面布局
│   │   └── BlogLayout.astro
│   ├── pages/          # 页面路由
│   │   ├── index.astro     # 首页
│   │   ├── blog/
│   │   │   └── [slug].astro # 文章详情页
│   │   └── about.astro     # 关于页
│   └── styles/         # 样式文件
│       └── global.css
├── astro.config.mjs    # Astro 配置
├── package.json
└── tsconfig.json
```

## 核心功能模块

### 1. 内容管理

- **Markdown 文章**：使用 frontmatter 定义元数据
- **分类标签**：支持 tags 和 categories
- **草稿模式**：draft 字段控制发布状态

示例文章结构：
```markdown
---
title: 文章标题
description: 文章描述
pubDate: 2026-04-15
tags: ['JavaScript', '前端']
draft: false
---

文章正文内容...
```

### 2. 页面功能

- **首页**：最新文章列表、个人简介
- **文章列表页**：分页、筛选、搜索
- **文章详情页**：目录导航、上一篇/下一篇
- **关于页**：个人信息、联系方式

### 3. 样式主题

- **响应式设计**：适配移动端和桌面端
- **深色模式**：可选的明暗主题切换
- **自定义主题**：CSS 变量管理主题色

### 4. SEO 优化

- 语义化 HTML 标签
- Meta 标签自动生成
- Open Graph 支持
- Sitemap 自动生成
- robots.txt 配置

## 实施步骤

### 第一阶段：项目初始化（1-2 天）

1. **环境准备**
   ```bash
   node -v  # 确保 Node.js >= 18
   npm create astro@latest
   ```

2. **安装依赖**
   ```bash
   npm install
   npm install @astrojs/mdx  # MDX 支持
   npm install @astrojs/sitemap  # Sitemap
   ```

3. **配置项目**
   - 配置 `astro.config.mjs`
   - 设置 `site` 选项用于 SEO
   - 配置 Markdown 插件

### 第二阶段：基础开发（3-5 天）

1. **创建核心组件**
   - Layout 布局组件
   - Header 导航组件
   - Footer 页脚组件
   - PostCard 文章卡片组件

2. **开发页面**
   - 首页（文章列表）
   - 文章详情页
   - 关于页

3. **样式开发**
   - 全局样式
   - 响应式布局
   - 主题变量

### 第三阶段：内容填充（持续）

1. **创建示例文章**（3-5 篇）
2. **配置导航菜单**
3. **添加个人简介和头像**

### 第四阶段：优化与部署（1-2 天）

1. **性能优化**
   - 图片压缩
   - 代码分割
   - 懒加载

2. **SEO 配置**
   - 添加 meta 标签
   - 生成 sitemap
   - 配置 robots.txt

3. **部署到 GitHub Pages**
   ```bash
   npm run build
   # 推送 dist 目录到 gh-pages 分支
   ```

## 部署配置

### GitHub Actions 自动部署

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

## 依赖包清单

```json
{
  "dependencies": {
    "astro": "^4.0.0",
    "@astrojs/mdx": "^2.0.0",
    "@astrojs/sitemap": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0"
  }
}
```

## 开发规范

### 命名规范
- 组件：PascalCase（如 `PostCard.astro`）
- 文件：kebab-case（如 `blog-post.md`）
- CSS 类：kebab-case（如 `.post-card`）

### Git 提交规范
```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 样式调整
refactor: 代码重构
chore: 构建/工具相关
```

## 扩展功能（可选）

1. **评论系统**
   - Giscus（GitHub Discussions）
   - Utterances（GitHub Issues）

2. **搜索功能**
   - Pagefind（静态搜索）
   - Algolia DocSearch

3. **统计分析**
   - Google Analytics
   - Umami（隐私友好）
   - Plausible

4. **RSS 订阅**
   - @astrojs/rss 插件

## 时间规划

| 阶段 | 任务 | 预计时间 |
|------|------|----------|
| 1 | 项目初始化 | 1-2 天 |
| 2 | 基础开发 | 3-5 天 |
| 3 | 内容填充 | 持续 |
| 4 | 优化部署 | 1-2 天 |
| **总计** | | **5-9 天** |

## 后续优化建议

1. **性能监控**：使用 Lighthouse 定期检测
2. **内容更新**：保持每周至少 1 篇文章
3. **交互优化**：根据用户反馈迭代功能
4. **技术升级**：关注 Astro 最新版本特性

## 参考资源

- [Astro 官方文档](https://docs.astro.build/)
- [GitHub Pages 文档](https://pages.github.com/)
- [Web 最佳实践](https://web.dev/)

---

**创建时间**: 2026-04-15  
**项目地址**: https://github.com/eilvy/eilvy.github.io
