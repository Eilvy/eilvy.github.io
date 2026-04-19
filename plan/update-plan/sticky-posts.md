# 文章置顶功能实现方案

## 📋 方案概述

通过在文章 frontmatter 中添加 `pin` 字段来标识置顶文章，并在排序时优先显示置顶文章。

---

## 🎯 实现目标

1. 支持在文章 frontmatter 中设置 `pin: true` 来置顶文章
2. 支持 `pinOrder` 字段控制多篇文章的置顶顺序
3. 置顶文章始终显示在列表顶部
4. 非置顶文章按发布日期排序

---

## 📁 文件结构

### 改造前
```
src/
├── content.config.ts (缺少 pin 字段定义)
├── pages/
│   ├── index.astro (按日期排序)
│   └── blog/index.astro (按日期排序)
└── content/blog/
    └── hello-world.md (普通文章)
```

### 改造后
```
src/
├── content.config.ts (添加 pin 和 pinOrder 字段)
├── pages/
│   ├── index.astro (优先显示置顶文章)
│   └── blog/index.astro (优先显示置顶文章)
└── content/blog/
    └── hello-world.md (pin: true)
```

---

## 🔧 实施步骤

### 步骤 1：修改内容 Schema

**文件**：`src/content.config.ts`

添加 `pin` 和 `pinOrder` 字段定义：

```typescript
schema: ({ image }) =>
  z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.optional(image()),
    tags: z.array(z.string()).default([]),
    categories: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    author: z.string().default('eilvy'),
    pin: z.boolean().default(false),           // 新增：是否置顶
    pinOrder: z.number().default(999),         // 新增：置顶顺序
  }),
```

**字段说明**：
- `pin`: 布尔值，`true` 表示置顶，`false` 或不设置表示不置顶
- `pinOrder`: 数字，值越小越靠前，默认为 999（排在其他置顶文章后面）

---

### 步骤 2：修改首页排序逻辑

**文件**：`src/pages/index.astro`

修改排序逻辑，优先显示置顶文章：

```typescript
// 过滤草稿并排序
const publishedPosts = posts
  .filter((post) => !(post.data as any).draft)
  .sort((a, b) => {
    const aPin = (a.data as any).pin || false;
    const bPin = (b.data as any).pin || false;
    
    // 如果都是置顶文章，按 pinOrder 排序
    if (aPin && bPin) {
      const aOrder = (a.data as any).pinOrder || 999;
      const bOrder = (b.data as any).pinOrder || 999;
      return aOrder - bOrder;
    }
    
    // 只有一个是置顶文章，置顶的排在前面
    if (aPin) return -1;
    if (bPin) return 1;
    
    // 都不是置顶文章，按发布日期排序
    return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
  })
  .slice(0, POSTS_PER_PAGE);
```

---

### 步骤 3：修改博客列表页排序逻辑

**文件**：`src/pages/blog/index.astro`

使用相同的排序逻辑：

```typescript
const posts = (await getCollection('blog'))
  .filter((post) => !post.data.draft)
  .sort((a, b) => {
    const aPin = a.data.pin || false;
    const bPin = b.data.pin || false;
    
    // 如果都是置顶文章，按 pinOrder 排序
    if (aPin && bPin) {
      return (a.data.pinOrder || 999) - (b.data.pinOrder || 999);
    }
    
    // 只有一个是置顶文章，置顶的排在前面
    if (aPin) return -1;
    if (bPin) return 1;
    
    // 都不是置顶文章，按发布日期排序
    return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
  });
```

---

### 步骤 4：设置置顶文章

**文件**：`src/content/blog/hello-world.md`

在 frontmatter 中添加 `pin` 字段：

```markdown
---
title: '欢迎来到我的技术博客'
description: '这是我的第一篇博客文章，在这里我将分享运维开发、后端开发、VibeCoding 等技术文章'
pubDate: 2026-04-15
tags: ['blog', 'welcome', 'intro']
categories: ['随笔']
heroImage: '../../assets/blog-placeholder-1.jpg'
author: 'eilvy'
pin: true          # 启用置顶
pinOrder: 1        # 置顶顺序（可选）
---
```

---

## 📝 使用示例

### 单篇文章置顶

```markdown
---
title: '重要公告'
pin: true
---
```

### 多篇文章置顶（控制顺序）

```markdown
---
title: '置顶文章 A'
pin: true
pinOrder: 1    # 第一个显示
---

---
title: '置顶文章 B'
pin: true
pinOrder: 2    # 第二个显示
---

---
title: '普通文章'
# pin: false 或不设置
---
```

### 取消置顶

```markdown
---
title: '不再置顶的文章'
pin: false    # 或不设置此字段
---
```

---

## 🎨 扩展功能建议

### 1. 在文章卡片上显示"置顶"标识

修改 `src/components/PostCard.astro`：

```astro
<header>
  {data.pin && <span class="pin-badge">置顶</span>}
  <h3 class="post-title">{data.title}</h3>
  ...
</header>

<style>
  .pin-badge {
    display: inline-block;
    padding: 0.25em 0.5em;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    background-color: var(--color-primary);
    border-radius: 4px;
    margin-bottom: 0.5em;
  }
</style>
```

### 2. 支持分类置顶

可以为不同页面设置不同的置顶文章：

```markdown
---
title: '技术文章'
pin: true
pinCategory: 'tech'    # 只在技术页面置顶
---
```

### 3. 支持时间范围置顶

```markdown
---
title: '限时活动'
pin: true
pinUntil: '2026-12-31'    # 在此日期后自动取消置顶
---
```

---

## 📊 排序逻辑说明

### 优先级规则

1. **第一优先级**：`pin` 字段
   - `pin: true` 的文章排在前面
   - `pin: false` 或不设置的文章排在后面

2. **第二优先级**（仅置顶文章）：`pinOrder` 字段
   - 值越小，排名越靠前
   - 默认为 999

3. **第三优先级**（仅非置顶文章）：`pubDate` 字段
   - 发布日期越新，排名越靠前

### 排序示例

假设有以下文章：

| 文章标题 | pin | pinOrder | pubDate | 最终位置 |
|---------|-----|----------|---------|---------|
| 文章 A | ✅ | 1 | 2026-04-15 | **1** |
| 文章 B | ✅ | 2 | 2026-04-16 | **2** |
| 文章 C | ✅ | - | 2026-04-17 | **3** (pinOrder=999) |
| 文章 D | ❌ | - | 2026-04-18 | **4** (最新) |
| 文章 E | ❌ | - | 2026-04-15 | **5** |

---

## ✅ 检查清单

实施完成后，请检查：

- [ ] `content.config.ts` 中添加了 `pin` 和 `pinOrder` 字段
- [ ] `index.astro` 中修改了排序逻辑
- [ ] `blog/index.astro` 中修改了排序逻辑
- [ ] `hello-world.md` 中添加了 `pin: true`
- [ ] 首页置顶文章显示在顶部
- [ ] 博客列表页置顶文章显示在顶部
- [ ] 非置顶文章按日期正常排序
- [ ] 多篇文章置顶时顺序正确

---

## 🔗 相关文件

- `/src/content.config.ts` - 内容 Schema 定义
- `/src/pages/index.astro` - 首页
- `/src/pages/blog/index.astro` - 博客列表页
- `/src/content/blog/hello-world.md` - 示例文章
- `/src/components/PostCard.astro` - 文章卡片组件（可选扩展）

---

## 🎯 最佳实践

### 1. 置顶文章数量
- 建议不超过 **3 篇** 置顶文章
- 过多置顶会降低用户体验

### 2. 置顶顺序
- 使用 `pinOrder` 明确控制多篇文章的顺序
- 建议使用 1, 2, 3... 连续数字

### 3. 内容类型
- 适合置顶的内容：
  - 欢迎文章/博客介绍
  - 重要公告
  - 精选文章/系列教程
  - 常见问题解答

### 4. 定期审查
- 定期检查置顶文章是否仍然相关
- 及时取消过时文章的置顶状态

---

**文档版本**：v1.0  
**创建日期**：2026-04-19  
**作者**：Eilvy
