# 技术博客项目执行阶段计划

## 项目定位

**目标**: 构建一个专注于技术分享的个人博客平台
**技术栈**: Astro 5 + Markdown/MDX + Tailwind CSS
**部署**: GitHub Pages
**风格**: 极简、高性能、开发者友好

---

## 阶段一：项目初始化与配置（Day 1-2）

### 1.1 环境准备 ✅

**任务清单**:
- [ ] 安装 Node.js (>= 18.x)
  ```bash
  node -v  # 检查版本
  ```
- [ ] 安装 Git 并配置 GitHub
  ```bash
  git config --global user.name "Your Name"
  git config --global user.email "your@email.com"
  ```
- [ ] 创建 GitHub 仓库
  - 仓库名：`eilvy.github.io`
  - 设为公开仓库
  - 初始化 README（可选）

**预期成果**: 开发环境就绪，GitHub 仓库创建完成

---

### 1.2 项目创建 ⭐

**任务清单**:
- [ ] 使用 Astro 创建项目
  ```bash
  npm create astro@latest .
  ```
  选择选项:
  - Template: **Blog** (官方博客模板)
  - Install dependencies: **Yes**
  - TypeScript: **Yes** (严格模式)
  - Initialize Git: **No** (已初始化)

- [ ] 安装额外依赖
  ```bash
  # MDX 支持
  npm install @astrojs/mdx
  
  # Sitemap 生成
  npm install @astrojs/sitemap
  
  # Tailwind CSS (如未包含)
  npx astro add tailwind
  
  # RSS Feed
  npm install @astrojs/rss
  ```

**预期成果**: 项目基础结构搭建完成

---

### 1.3 项目配置 🔧

**任务清单**:
- [ ] 配置 `astro.config.mjs`
  ```javascript
  import { defineConfig } from 'astro/config';
  import mdx from '@astrojs/mdx';
  import sitemap from '@astrojs/sitemap';
  import tailwind from '@astrojs/tailwind';

  export default defineConfig({
    site: 'https://eilvy.github.io',
    integrations: [mdx(), sitemap(), tailwind()],
    markdown: {
      shikiConfig: {
        theme: 'one-dark-pro',
        wrap: true
      }
    }
  });
  ```

- [ ] 配置 `tsconfig.json`
  - 设置路径别名 `@/*` 指向 `src/*`
  - 启用严格模式

- [ ] 配置 `package.json`
  ```json
  {
    "scripts": {
      "dev": "astro dev",
      "build": "astro build",
      "preview": "astro preview",
      "lint": "eslint src"
    }
  }
  ```

- [ ] 创建 `.gitignore`
  ```
  node_modules
  dist
  .astro
  .env
  ```

**预期成果**: 项目配置完成，可正常运行 `npm run dev`

---

### 1.4 GitHub Pages 部署配置 🚀

**任务清单**:
- [ ] 创建 `.github/workflows/deploy.yml`
  ```yaml
  name: Deploy to GitHub Pages

  on:
    push:
      branches: [ main ]
    workflow_dispatch:

  permissions:
    contents: read
    pages: write
    id-token: write

  concurrency:
    group: "pages"
    cancel-in-progress: false

  jobs:
    build:
      runs-on: ubuntu-latest
      steps:
        - name: Checkout
          uses: actions/checkout@v4

        - name: Setup Node
          uses: actions/setup-node@v4
          with:
            node-version: '18'

        - name: Install dependencies
          run: npm ci

        - name: Build
          run: npm run build

        - name: Upload artifact
          uses: actions/upload-pages-artifact@v3
          with:
            path: ./dist

    deploy:
      environment:
        name: github-pages
        url: ${{ steps.deployment.outputs.page_url }}
      runs-on: ubuntu-latest
      needs: build
      steps:
        - name: Deploy to GitHub Pages
          id: deployment
          uses: actions/deploy-pages@v4
  ```

- [ ] 首次部署测试
  ```bash
  git add .
  git commit -m "chore: initial commit"
  git push origin main
  ```

**预期成果**: CI/CD 流水线配置完成，自动部署可用

---

## 阶段二：核心组件开发（Day 3-5）

### 2.1 布局系统 🎨

**任务清单**:
- [ ] 创建基础布局 `src/layouts/BaseLayout.astro`
  ```astro
  ---
  interface Props {
    title: string;
    description?: string;
  }
  
  const { title, description = '技术博客' } = Astro.props;
  ---
  
  <!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width" />
      <title>{title}</title>
      <meta name="description" content={description} />
    </head>
    <body>
      <slot />
    </body>
  </html>
  ```

- [ ] 创建博客布局 `src/layouts/BlogLayout.astro`
  - 继承 BaseLayout
  - 包含 Header 和 Footer
  - 支持文章目录

- [ ] 创建文章布局 `src/layouts/PostLayout.astro`
  - 支持代码高亮
  - 目录导航
  - 上一篇/下一篇导航

**预期成果**: 3 个核心布局组件完成

---

### 2.2 组件开发 🧩

**任务清单**:
- [ ] Header 组件 `src/components/Header.astro`
  - Logo/站点名称
  - 导航菜单（首页、文章、关于）
  - 移动端汉堡菜单
  - 深色模式切换按钮

- [ ] Footer 组件 `src/components/Footer.astro`
  - 版权信息
  - 社交链接（GitHub、Twitter 等）
  - RSS 订阅链接

- [ ] 文章卡片 `src/components/PostCard.astro`
  - 标题、日期、标签
  - 摘要预览
  - 阅读更多链接

- [ ] 目录组件 `src/components/TableOfContents.astro`
  - 自动生成文章目录
  - 滚动高亮当前章节
  - 可折叠

- [ ] 标签组件 `src/components/Tag.astro`
  - 标签样式
  - 点击筛选功能

**预期成果**: 5 个可复用组件完成

---

### 2.3 样式系统 🎨

**任务清单**:
- [ ] 配置 Tailwind (`tailwind.config.mjs`)
  ```javascript
  export default {
    content: ['./src/**/*.{astro,html,js,md}'],
    theme: {
      extend: {
        colors: {
          primary: '#3b82f6',
          secondary: '#64748b',
        },
        fontFamily: {
          sans: ['Inter', 'system-ui', 'sans-serif'],
          mono: ['Fira Code', 'monospace'],
        },
      },
    },
    plugins: [
      require('@tailwindcss/typography'),
    ],
  }
  ```

- [ ] 全局样式 `src/styles/global.css`
  - CSS 变量定义（主题色）
  - 深色模式变量
  - 基础样式重置

- [ ] 深色模式支持
  - `useDarkMode` composable
  - localStorage 持久化
  - 系统偏好检测

**预期成果**: 完整的样式系统，支持明暗主题切换

---

## 阶段三：内容系统开发（Day 6-8）

### 3.1 内容集合配置 📝

**任务清单**:
- [ ] 配置内容集合 `src/content/config.ts`
  ```typescript
  import { defineCollection, z } from 'astro:content';
  
  const blog = defineCollection({
    type: 'content',
    schema: z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.date(),
      updatedDate: z.date().optional(),
      tags: z.array(z.string()).default([]),
      categories: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
      heroImage: z.string().optional(),
      author: z.string().default('eilvy'),
    }),
  });
  
  export const collections = { blog };
  ```

- [ ] 创建示例文章
  - `src/content/blog/hello-world.md` - 开篇文
  - `src/content/blog/astro-intro.md` - Astro 介绍
  - `src/content/blog/typescript-tips.md` - TypeScript 技巧

**预期成果**: 内容系统配置完成，3 篇示例文章

---

### 3.2 页面开发 📄

**任务清单**:
- [ ] 首页 `src/pages/index.astro`
  - 个人简介区域
  - 最新文章列表（按日期排序）
  - 分类/标签云
  - 分页功能

- [ ] 文章列表页 `src/pages/blog/index.astro`
  - 所有文章列表
  - 筛选功能（按标签、分类）
  - 搜索框（可选）
  - 分页

- [ ] 文章详情页 `src/pages/blog/[slug].astro`
  - 渲染 Markdown 内容
  - 代码高亮
  - 目录导航
  - 上一篇/下一篇
  - 评论系统占位

- [ ] 标签页 `src/pages/tags/[tag].astro`
  - 按标签筛选文章
  - 标签文章列表

- [ ] 关于页 `src/pages/about.md`
  - 个人介绍
  - 技能栈
  - 联系方式
  - 项目经历

- [ ] RSS Feed `src/pages/rss.xml.ts`
  ```typescript
  import rss from '@astrojs/rss';
  import { getCollection } from 'astro:content';
  
  export async function GET() {
    const posts = await getCollection('blog');
    return rss({
      title: 'eilvy 的技术博客',
      description: '分享前端开发、TypeScript、Astro 等技术文章',
      site: Astro.site!,
      items: posts.map((post) => ({
        title: post.data.title,
        pubDate: post.data.pubDate,
        description: post.data.description,
        link: `/blog/${post.slug}/`,
      })),
    });
  }
  ```

**预期成果**: 完整的页面系统，所有路由可用

---

### 3.3 技术博客特色功能 ⚡

**任务清单**:
- [ ] 代码块增强
  - 行号显示
  - 代码复制按钮
  - 语言标签
  - 标题支持

- [ ] 数学公式支持（可选）
  ```bash
  npm install rehype-katex remark-math
  ```

- [ ] 图表支持（可选）
  - Mermaid 图表
  - 流程图、时序图

- [ ] 交互式代码演示
  - Astro Playgrounds 集成
  - CodePen/StackBlitz 嵌入

**预期成果**: 技术博客专属功能完成

---

## 阶段四：SEO 与优化（Day 9-10）

### 4.1 SEO 优化 🔍

**任务清单**:
- [ ] Meta 标签组件 `src/components/SEO.astro`
  ```astro
  ---
  interface Props {
    title: string;
    description: string;
    image?: string;
    canonicalURL?: string;
  }
  ---
  
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <meta name="description" content={description} />
  
  <!-- Open Graph -->
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:type" content="website" />
  <meta property="og:image" content={image} />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  
  <!-- Canonical URL -->
  <link rel="canonical" href={canonicalURL} />
  ```

- [ ] 结构化数据（JSON-LD）
  ```json
  {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "eilvy 的技术博客",
    "url": "https://eilvy.github.io",
    "author": {
      "@type": "Person",
      "name": "eilvy"
    }
  }
  ```

- [ ] robots.txt `public/robots.txt`
  ```
  User-agent: *
  Allow: /
  Sitemap: https://eilvy.github.io/sitemap-index.xml
  ```

- [ ] Sitemap 自动生成
  - 已在 `astro.config.mjs` 配置
  - 验证生成结果

**预期成果**: SEO 完整优化，搜索引擎友好

---

### 4.2 性能优化 ⚡

**任务清单**:
- [ ] 图片优化
  - 使用 Astro Image 组件
  - WebP 格式转换
  - 懒加载
  ```astro
  <Image
    src="../images/hero.jpg"
    alt="Hero"
    loading="lazy"
    widths="[400, 800, 1200]"
  />
  ```

- [ ] 字体优化
  - 本地字体托管
  - `font-display: swap`
  - 预加载关键字体

- [ ] 代码分割
  - Astro 自动处理
  - 验证 Bundle 分析

- [ ] 第三方脚本优化
  - 延迟加载分析脚本
  - 使用 `client:idle` 或 `client:visible`

**预期成果**: Lighthouse 评分 90+

---

### 4.3 可访问性优化 ♿

**任务清单**:
- [ ] 语义化 HTML
  - 使用正确的标签（`<article>`, `<nav>`, `<main>`）
  - ARIA 标签补充

- [ ] 键盘导航
  - Tab 键顺序合理
  - 焦点可见样式

- [ ] 颜色对比度
  - 确保文字对比度 >= 4.5:1
  - 深色模式同样满足

- [ ] 跳过链接
  - 添加"跳转到主要内容"链接

**预期成果**: WCAG 2.1 AA 标准合规

---

## 阶段五：内容填充与测试（Day 11-14）

### 5.1 内容创作 ✍️

**任务清单**:
- [ ] 撰写开篇文（必做）
  - 自我介绍
  - 博客定位
  - 更新频率承诺

- [ ] 技术文章储备（至少 5 篇）
  - [ ] Astro 入门教程
  - [ ] TypeScript 最佳实践
  - [ ] CSS 技巧合集
  - [ ] 前端性能优化指南
  - [ ] 工具链推荐

- [ ] 完善关于页
  - 个人照片
  - 详细简历
  - 项目作品集链接

- [ ] 配置社交链接
  - GitHub
  - Twitter/X
  - LinkedIn
  - 邮箱

**预期成果**: 至少 6 篇高质量文章，内容充实

---

### 5.2 功能测试 🧪

**任务清单**:
- [ ] 跨浏览器测试
  - Chrome/Edge
  - Firefox
  - Safari
  - 移动端浏览器

- [ ] 响应式测试
  - 桌面端（1920px, 1366px）
  - 平板（768px, 1024px）
  - 手机（375px, 414px）

- [ ] 功能测试
  - [ ] 导航链接正确
  - [ ] 深色模式切换正常
  - [ ] 搜索功能可用
  - [ ] RSS 订阅有效
  - [ ] 404 页面友好

- [ ] 性能测试
  - Lighthouse 跑分
  - PageSpeed Insights
  - WebPageTest

**预期成果**: 所有功能正常，无明显 Bug

---

### 5.3 评论系统集成（可选）💬

**任务清单**:
- [ ] 选择评论系统
  - **推荐**: Giscus（基于 GitHub Discussions）
  - 备选：Utterances（基于 GitHub Issues）

- [ ] 配置 Giscus
  ```astro
  <!-- src/components/Comments.astro -->
  <script src="https://giscus.app/client.js"
    data-repo="eilvy/eilvy.github.io"
    data-repo-id="xxx"
    data-category="General"
    data-category-id="xxx"
    data-mapping="pathname"
    data-strict="0"
    data-reactions-enabled="1"
    data-emit-metadata="0"
    data-input-position="bottom"
    data-theme="preferred_color_scheme"
    data-lang="zh-CN"
    crossorigin="anonymous"
    async>
  </script>
  ```

- [ ] 在文章页集成评论组件

**预期成果**: 评论系统可用（如选择集成）

---

## 阶段六：上线与运营（Day 15+）

### 6.1 正式上线 🎉

**任务清单**:
- [ ] 最终检查清单
  - [ ] 所有链接有效
  - [ ] 无控制台错误
  - [ ] 移动端显示正常
  - [ ] SEO 标签完整
  - [ ] Analytics 已集成

- [ ] 自定义域名（可选）
  - 购买域名
  - 配置 DNS
  - GitHub Pages 域名设置
  - HTTPS 自动启用

- [ ] 提交搜索引擎
  - Google Search Console
  - Bing Webmaster Tools
  - 提交 Sitemap

- [ ] 首次发布
  ```bash
  git tag v1.0.0
  git push origin main --tags
  ```

**预期成果**: 博客正式上线，可公开访问

---

### 6.2 数据分析 📊

**任务清单**:
- [ ] 集成统计工具
  - **推荐**: Umami（隐私友好）
  - 备选：Google Analytics 4
  - 备选：Plausible

- [ ] 配置 Umami
  ```astro
  <!-- src/components/Analytics.astro -->
  <script async defer
    data-website-id="xxx"
    src="https://umami.example.com/script.js">
  </script>
  ```

- [ ] 监控关键指标
  - 页面浏览量（PV）
  - 独立访客（UV）
  - 平均停留时间
  - 热门文章

**预期成果**: 数据统计系统就绪

---

### 6.3 持续运营计划 📅

**内容更新计划**:
- **频率**: 每周至少 1 篇技术文章
- **时间**: 固定周末更新
- **主题规划**:
  - 周一：前端技巧
  - 周三：工具推荐
  - 周五：项目复盘
  - 周日：学习笔记

**推广计划**:
- [ ] 在社交媒体分享文章
- [ ] 参与技术社区讨论
- [ ] 与其他博主互访
- [ ] 提交到技术聚合平台（掘金、知乎等）

**维护计划**:
- 每月检查依赖更新
- 每季度审查性能指标
- 每半年重构优化代码

---

## 验收标准

### 功能验收 ✅
- [ ] 首页正常显示文章列表
- [ ] 文章详情页渲染正确
- [ ] 深色模式切换流畅
- [ ] 移动端响应式正常
- [ ] RSS 订阅可用
- [ ] 搜索功能正常（如实现）

### 性能验收 ⚡
- [ ] Lighthouse Performance >= 90
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3.5s
- [ ] Total Bundle Size < 500KB

### SEO 验收 🔍
- [ ] 所有页面有唯一 Title
- [ ] Meta Description 完整
- [ ] Sitemap 生成成功
- [ ] robots.txt 配置正确
- [ ] 结构化数据验证通过

### 内容验收 📝
- [ ] 至少 6 篇技术文章
- [ ] 关于页信息完整
- [ ] 联系方式有效
- [ ] 社交链接正确

---

## 风险与应对

| 风险 | 可能性 | 影响 | 应对措施 |
|------|--------|------|----------|
| 时间不足 | 中 | 中 | 优先完成核心功能，扩展功能后续迭代 |
| 技术难点 | 低 | 中 | 查阅官方文档，参考示例项目 |
| 内容创作困难 | 中 | 高 | 提前准备选题列表，从学习笔记开始 |
| 部署问题 | 低 | 高 | 严格按照文档配置，保留回滚方案 |

---

## 资源清单

### 文档资源
- [Astro 官方文档](https://docs.astro.build/)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [GitHub Pages 文档](https://pages.github.com/)
- [Web 性能最佳实践](https://web.dev/fast/)

### 工具资源
- [Lighthouse](https://developer.chrome.com/docs/lighthouse/overview/)
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [Schema Markup Validator](https://validator.schema.org/)

### 参考项目
- [AstroWind](https://github.com/onwidget/astrowind)
- [Astro 官方博客模板](https://github.com/withastro/astro/tree/main/examples/blog)

---

## 进度追踪表

| 阶段 | 计划开始 | 计划完成 | 实际完成 | 状态 |
|------|----------|----------|----------|------|
| 阶段一：项目初始化 | Day 1 | Day 2 | - | ⏳ 待开始 |
| 阶段二：核心组件 | Day 3 | Day 5 | - | ⏳ 待开始 |
| 阶段三：内容系统 | Day 6 | Day 8 | - | ⏳ 待开始 |
| 阶段四：SEO 优化 | Day 9 | Day 10 | - | ⏳ 待开始 |
| 阶段五：内容填充 | Day 11 | Day 14 | - | ⏳ 待开始 |
| 阶段六：上线运营 | Day 15 | - | - | ⏳ 待开始 |

---

**文档版本**: v1.0  
**创建时间**: 2026-04-15  
**最后更新**: 2026-04-15  
**项目负责人**: eilvy

---

## 快速启动检查清单

准备开始？按顺序完成以下任务：

```
□ 1. 确认 Node.js >= 18 已安装
□ 2. 创建 GitHub 仓库 eilvy.github.io
□ 3. 运行 npm create astro@latest .
□ 4. 安装依赖 npm install
□ 5. 配置 astro.config.mjs
□ 6. 配置 GitHub Actions
□ 7. 运行 npm run dev 查看效果
□ 8. 提交代码并推送
□ 9. 验证 GitHub Pages 部署成功
```

完成以上步骤后，你的博客就已经初步运行了！🎉
