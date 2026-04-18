# 博客内容管理指南

**创建时间**: 2026-04-15  
**适用对象**: 博客管理员/作者  
**内容管理系统**: Astro Content Collections

---

## � 快速开始：本地启动博客

### 首次使用（安装依赖）

```bash
# 进入项目目录
cd /home/leiyv/leiyu/blog/eilvy.github.io

# 安装所有依赖（仅需执行一次）
npm install
```

### 启动开发服务器

```bash
# 启动本地开发服务器（支持热更新）
npm run dev

# 访问 http://localhost:4321 查看博客
```

**开发服务器特性**：
- ✅ 自动热更新（修改文件立即生效）
- ✅ 实时预览
- ✅ 错误提示友好

### 其他常用命令

```bash
# 构建生产版本
npm run build

# 预览构建结果
npm run preview

# 检查内容集合
npx astro sync
```

---

## �📁 博客文件结构

### 核心目录

```
src/
├── content/
│   └── blog/              # 📝 所有博客文章存放位置
│       ├── hello-world.md
│       ├── astro-intro.md
│       └── typescript-tips.md
├── pages/
│   ├── blog/
│   │   └── [...slug].astro  # 文章详情页面（自动生成路由）
│   └── index.astro
└── layouts/
    └── PostLayout.astro     # 文章布局
```

### 文章文件命名规范

- **文件名**: 使用小写字母，单词间用 `-` 连接
- **示例**: 
  - ✅ `my-first-post.md`
  - ✅ `typescript-best-practices.md`
  - ❌ `MyFirstPost.md`
  - ❌ `typescript_best_practices.md`

---

## ✍️ 如何创建新文章

### 步骤 1: 创建 Markdown 文件

在 `src/content/blog/` 目录下创建新的 `.md` 文件：

```bash
# 示例：创建一篇关于 React Hooks 的文章
touch src/content/blog/react-hooks-guide.md
```

### 步骤 2: 添加 Frontmatter（元数据）

在文件开头添加 YAML frontmatter，这是文章的元数据：

```yaml
---
title: '文章标题'
description: '文章简短描述（用于 SEO 和列表页）'
pubDate: 2026-04-15          # 发布日期（YYYY-MM-DD 格式）
updatedDate: 2026-04-16      # 更新日期（可选，YYYY-MM-DD 格式）
tags: ['react', 'hooks', 'tutorial']  # 标签数组
categories: ['前端开发']      # 分类数组（可选）
draft: false                 # 草稿标记（true 不发布）
heroImage: '../../assets/blog-placeholder-1.jpg'  # 特色图片（可选）
author: 'your-name'          # 作者名
---
```

### 步骤 3: 编写文章内容

Frontmatter 之后就是文章内容，使用 Markdown 语法：

```markdown
---
title: 'React Hooks 完全指南'
description: '深入理解 React Hooks 的使用方法和最佳实践'
pubDate: 2026-04-15
tags: ['react', 'hooks', 'javascript']
---

## 什么是 React Hooks？

React Hooks 是 React 16.8 引入的新特性...

### useState 示例

```jsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

## 总结

React Hooks 让函数组件也能拥有状态...
```

### 步骤 4: 保存并预览

```bash
# 启动开发服务器
npm run dev

# 访问 http://localhost:4321/blog/react-hooks-guide 查看效果
```

---

## 📝 Frontmatter 字段详解

### 必填字段

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `title` | string | 文章标题 | `'React Hooks 指南'` |
| `description` | string | 文章描述（150-160 字符最佳） | `'深入理解 React Hooks'` |
| `pubDate` | Date | 发布日期 | `2026-04-15` |

### 可选字段

| 字段 | 类型 | 说明 | 默认值 | 示例 |
|------|------|------|--------|------|
| `updatedDate` | Date | 最后更新日期 | - | `2026-04-16` |
| `tags` | string[] | 标签数组 | `[]` | `['react', 'hooks']` |
| `categories` | string[] | 分类数组 | `[]` | `['前端开发', '教程']` |
| `draft` | boolean | 草稿标记 | `false` | `true`（不发布） |
| `heroImage` | string | 特色图片路径 | - | `'../../assets/cover.jpg'` |
| `author` | string | 作者名 | `'eilvy'` | `'Your Name'` |

---

## 🗑️ 如何删除文章

### 方法 1: 完全删除

```bash
# 删除文章文件
rm src/content/blog/old-post.md

# 重新构建
npm run build
```

### 方法 2: 设为草稿（推荐）

保留文件但不在网站上显示：

```yaml
---
title: '旧文章'
draft: true  # ← 设置为 true
---
```

### 方法 3: 修改发布日期

将发布日期设为未来时间，文章不会显示：

```yaml
---
title: '未来文章'
pubDate: 2027-01-01  # ← 未来日期
---
```

---

## 🔄 如何修改文章

### 修改文章内容

1. 打开 `src/content/blog/` 下对应的 `.md` 文件
2. 编辑 Markdown 内容
3. 保存文件
4. 开发模式下自动热更新，生产环境需要重新构建

### 修改文章元数据

```yaml
# 修改标题
title: '新的文章标题'

# 添加更新日期
updatedDate: 2026-04-20

# 添加/修改标签
tags: ['react', 'hooks', 'updated', '2026']

# 修改分类
categories: ['前端开发', '进阶教程']
```

### 修改特色图片

```yaml
# 方式 1: 使用现有图片
heroImage: '../../assets/blog-placeholder-1.jpg'

# 方式 2: 使用新图片
heroImage: '../../assets/my-new-cover.png'

# 方式 3: 移除特色图片
# heroImage:  # 注释掉或删除这行
```

---

## 📸 图片使用指南

### 方法 1: 使用本地图片（推荐）

1. 将图片放入 `src/assets/` 目录
2. 在 frontmatter 或内容中引用：

```yaml
---
heroImage: '../../assets/my-image.jpg'
---
```

```markdown
![描述文字](../../assets/my-image.jpg)
```

### 方法 2: 使用网络图片

```markdown
![描述文字](https://example.com/image.jpg)
```

```yaml
---
heroImage: 'https://example.com/cover.jpg'
---
```

### 图片优化建议

- **格式**: 优先使用 WebP（Astro 自动转换）
- **大小**: 建议宽度 1200px 以内
- **压缩**: 使用 TinyPNG 等工具压缩
- **命名**: 使用描述性文件名

---

## 🏷️ 标签和分类管理

### 标签（Tags）

- 用于标记文章主题
- 建议每篇文章 3-5 个标签
- 标签会自动生成标签页

```yaml
tags: ['react', 'hooks', 'javascript', 'frontend']
```

### 分类（Categories）

- 用于文章大分类
- 建议每篇文章 1-2 个分类
- 分类比标签更宏观

```yaml
categories: ['前端开发', '教程']
```

### 标签/分类最佳实践

```yaml
# ✅ 好的示例
tags: ['react', 'hooks', 'performance']
categories: ['前端开发']

# ❌ 避免过多标签
tags: ['react', 'hooks', 'javascript', 'frontend', 'web', 'coding', 'tutorial', '2026', 'guide']  # 太多了！

# ❌ 避免拼写错误
tags: ['react', 'React', 'REACT']  # 应该统一为 'react'
```

---

## 📋 文章模板

### 技术教程模板

```markdown
---
title: '[技术名称] 完全指南'
description: '学习 [技术名称] 的完整教程，从入门到精通'
pubDate: 2026-04-15
tags: ['[technology]', 'tutorial', 'guide']
categories: ['教程']
author: 'your-name'
---

## 简介

简要介绍 [技术名称] 是什么，为什么要学习它。

## 什么是 [技术名称]？

详细解释概念...

## 快速开始

### 环境准备

```bash
npm install [package-name]
```

### 基础示例

```javascript
// 示例代码
```

## 核心概念

### 1. 概念一

解释和示例...

### 2. 概念二

解释和示例...

## 最佳实践

- 实践建议 1
- 实践建议 2

## 常见问题

### Q: 问题一？

A: 回答...

## 总结

总结全文...

## 参考资源

- [官方文档](链接)
- [相关教程](链接)
```

### 技术技巧模板

```markdown
---
title: '[数字] 个 [技术] 实用技巧'
description: '分享 [数字] 个提升开发效率的 [技术] 技巧'
pubDate: 2026-04-15
tags: ['[technology]', 'tips', 'best-practices']
categories: ['技巧']
---

## 技巧 1: [技巧名称]

### 问题

描述常见错误做法...

### 解决方案

展示正确做法...

```javascript
// ❌ 错误示例
const bad = 'example';

// ✅ 正确示例
const good = 'example';
```

## 技巧 2: [技巧名称]

...

## 总结

这些技巧可以帮助你...
```

---

## 🚀 发布流程

### 开发环境预览

```bash
# 启动开发服务器
npm run dev

# 访问 http://localhost:4321
```

### 生产环境构建

```bash
# 1. 检查所有文章
ls src/content/blog/

# 2. 确保没有草稿文章（除非故意）
# 检查 draft: true 的文章

# 3. 构建项目
npm run build

# 4. 预览构建结果
npm run preview

# 5. 提交并推送
git add .
git commit -m "feat: 新增文章 [文章标题]"
git push origin main
```

### 自动部署

推送到 GitHub 后，GitHub Actions 会自动：
1. 安装依赖
2. 构建项目
3. 部署到 GitHub Pages

---

## 📊 内容规划建议

### 文章类型比例

- **教程类**: 40%（深入的技术教程）
- **技巧类**: 30%（实用技巧和最佳实践）
- **随笔类**: 20%（学习心得、踩坑记录）
- **资源类**: 10%（工具推荐、资源合集）

### 更新频率建议

- **理想**: 每周 1-2 篇
- **最低**: 每月 2 篇
- **关键**: 保持规律更新

### 内容主题建议

1. **前端基础**
   - HTML/CSS 技巧
   - JavaScript 进阶
   - TypeScript 实践

2. **框架技术**
   - React/Vue/Astro
   - 状态管理
   - 性能优化

3. **开发工具**
   - VS Code 配置
   - Git 工作流
   - 构建工具

4. **最佳实践**
   - 代码规范
   - 测试策略
   - 部署流程

---

## 🔧 常用命令速查

```bash
# 创建新文章
touch src/content/blog/my-new-post.md

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview

# 查看文章列表
ls src/content/blog/

# 统计文章数量
ls src/content/blog/*.md | wc -l
```

---

## 📝 检查清单

### 发布前检查

- [ ] Frontmatter 完整（title, description, pubDate）
- [ ] 标签和分类合理
- [ ] 文章内容无错别字
- [ ] 代码示例可运行
- [ ] 图片路径正确
- [ ] 链接有效
- [ ] 不是草稿状态（draft: false）

### SEO 优化检查

- [ ] 标题包含关键词（50-60 字符）
- [ ] 描述吸引人（150-160 字符）
- [ ] 使用了合适的标签
- [ ] 文章结构清晰（h2, h3）
- [ ] 包含内部链接
- [ ] 图片有 alt 描述

---

## 💡 高级技巧

### 1. 使用 MDX

MDX 允许在 Markdown 中使用 React 组件：

```mdx
---
title: '使用 MDX 的文章'
---

import MyComponent from '../../components/MyComponent.astro';

<MyComponent />

# 内容
```

### 2. 代码块语法高亮

````markdown
```javascript
// 自动语法高亮
const code = 'example';
```

```typescript
// TypeScript 支持
const typed: string = 'example';
```

```css
/* CSS 也支持 */
.container {
  display: flex;
}
```
````

### 3. 文章间互链

```markdown
[相关文章](./other-post.md)

[React Hooks 指南](./react-hooks-guide.md)
```

### 4. 使用摘要

在文章中添加 `<!-- more -->` 标记，标记摘要结束：

```markdown
这是摘要内容，会显示在列表页。

<!-- more -->

这是正文内容...
```

---

## 🎯 示例：完整的博客文章

```markdown
---
title: 'TypeScript 泛型完全指南'
description: '深入理解 TypeScript 泛型的概念、使用场景和最佳实践，提升类型编程能力'
pubDate: 2026-04-15
updatedDate: 2026-04-16
tags: ['typescript', 'generics', 'type-system']
categories: ['TypeScript', '进阶教程']
draft: false
heroImage: '../../assets/typescript-generics.jpg'
author: 'eilvy'
---

## 什么是泛型？

泛型（Generics）是 TypeScript 中强大的类型编程工具...

## 基础语法

### 泛型函数

```typescript
function identity<T>(arg: T): T {
  return arg;
}

// 使用
const result = identity<string>('hello');
```

### 泛型接口

```typescript
interface Box<T> {
  value: T;
}

const stringBox: Box<string> = { value: 'hello' };
```

## 高级用法

### 泛型约束

```typescript
interface Lengthwise {
  length: number;
}

function logLength<T extends Lengthwise>(arg: T): T {
  console.log(arg.length);
  return arg;
}
```

### 默认泛型类型

```typescript
interface Container<T = string> {
  value: T;
}

const defaultContainer: Container = { value: 'hello' };
```

## 实用工具类型

### Partial<T>

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

type PartialUser = Partial<User>;
// { id?: number; name?: string; email?: string; }
```

### Pick<T, K>

```typescript
type UserPreview = Pick<User, 'id' | 'name'>;
// { id: number; name: string; }
```

## 总结

泛型是 TypeScript 类型系统的核心概念...

## 参考资源

- [TypeScript 官方文档 - 泛型](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [TypeScript 工具类型大全](链接)
```

---

## 📞 需要帮助？

如果在使用过程中遇到问题：

1. 查看 [Astro 官方文档](https://docs.astro.build/)
2. 检查 [Content Collections 文档](https://docs.astro.build/zh-cn/guides/content-collections/)
3. 查看项目 `README.md`
4. 检查 `src/content/config.ts` 中的 schema 定义

---

**最后更新**: 2026-04-15  
**文档版本**: v1.0
