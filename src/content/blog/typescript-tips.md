---
title: 'TypeScript 实用技巧与最佳实践'
description: '分享 TypeScript 开发中的实用技巧、类型体操和常见陷阱'
pubDate: 2026-04-17
tags: ['typescript', 'javascript', 'tips']
categories: ['编程语言']
heroImage: '../../assets/blog-placeholder-3.jpg'
author: 'eilvy'
---

## 🎯 TypeScript 简介

TypeScript 是 JavaScript 的超集，添加了静态类型系统。它能在编译时发现错误，提高代码质量和可维护性。

## 💡 实用技巧

### 1. 使用 `unknown` 而非 `any`

```typescript
// ❌ 不推荐
function processValue(value: any) {
  return value.toUpperCase(); // 可能出错
}

// ✅ 推荐
function processValue(value: unknown) {
  if (typeof value === 'string') {
    return value.toUpperCase(); // 类型安全
  }
  throw new Error('Expected string');
}
```

### 2. 类型守卫（Type Guards）

```typescript
// 自定义类型守卫
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function process(value: string | number) {
  if (isString(value)) {
    // value 的类型被收窄为 string
    return value.toUpperCase();
  }
  // value 的类型被收窄为 number
  return value.toFixed(2);
}
```

### 3. 实用工具类型

TypeScript 提供了许多内置的工具类型：

```typescript
// Partial - 使所有属性变为可选
interface User {
  id: number;
  name: string;
  email: string;
}

type PartialUser = Partial<User>;
// { id?: number; name?: string; email?: string; }

// Pick - 选择特定属性
type UserPreview = Pick<User, 'name' | 'email'>;
// { name: string; email: string; }

// Omit - 排除特定属性
type UserWithoutId = Omit<User, 'id'>;
// { name: string; email: string; }

// Record - 创建键值对类型
type UserMap = Record<string, User>;
```

### 4. 泛型的妙用

```typescript
// 基础泛型
function identity<T>(value: T): T {
  return value;
}

identity<string>('hello'); // 'hello'
identity<number>(42); // 42

// 泛型约束
interface Lengthwise {
  length: number;
}

function logLength<T extends Lengthwise>(value: T): T {
  console.log(value.length);
  return value;
}

logLength('hello'); // ✅ 5
logLength([1, 2, 3]); // ✅ 3
logLength(42); // ❌ Error: number 没有 length 属性
```

### 5. 条件类型

```typescript
// 基础条件类型
type IsString<T> = T extends string ? true : false;

type A = IsString<string>; // true
type B = IsString<number>; // false

// infer 关键字
type UnwrapArray<T> = T extends (infer U)[] ? U : T;

type C = UnwrapArray<string[]>; // string
type D = UnwrapArray<number>; // number
```

## ⚠️ 常见陷阱

### 1. 可选链与空值合并

```typescript
interface User {
  name?: string | null;
}

const user: User = {};

// ❌ 可能不是预期的行为
const name1 = user.name || 'Anonymous';
// 当 name 为 '' 时也会返回 'Anonymous'

// ✅ 更精确的控制
const name2 = user.name ?? 'Anonymous';
// 只在 null 或 undefined 时返回 'Anonymous'
```

### 2. 类型断言的风险

```typescript
// ❌ 危险的类型断言
const value = document.getElementById('my-id') as HTMLInputElement;
value.value = 'test'; // 如果元素不是 input，会出错

// ✅ 更安全的做法
const element = document.getElementById('my-id');
if (element instanceof HTMLInputElement) {
  element.value = 'test';
}
```

### 3. 索引签名

```typescript
interface StringMap {
  [key: string]: string;
}

const map: StringMap = {
  a: 'hello',
  b: 'world',
  c: 42, // ❌ Error: number 不能赋值给 string
};
```

## 🎨 高级技巧

### 1. 映射类型

```typescript
// 创建只读版本
type ReadonlyUser = {
  readonly [K in keyof User]: User[K];
};

// 等同于
type ReadonlyUser = Readonly<User>;
```

### 2. 模板字面量类型

```typescript
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type Endpoint = '/users' | '/posts' | '/comments';

type ApiRoute = `${HttpMethod} ${Endpoint}`;
// 'GET /users' | 'POST /users' | 'GET /posts' | ...
```

### 3. 满足操作符（satisfies）

TypeScript 4.9+ 新增：

```typescript
type Color = {
  r: number;
  g: number;
  b: number;
};

const colors = {
  red: { r: 255, g: 0, b: 0 },
  green: { r: 0, g: 255, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
} satisfies Record<string, Color>;

// ✅ 保持字面量类型
// ✅ 验证所有值都符合 Color 类型
```

## 📚 推荐资源

- [TypeScript 官方文档](https://www.typescriptlang.org/docs/)
- [TypeScript 深度探索](https://github.com/microsoft/TypeScript-Handbook)
- [Type Challenges](https://github.com/type-challenges/type-challenges) - 类型体操练习

## 💭 总结

TypeScript 是一个强大的工具，能够显著提高代码质量。掌握这些技巧和最佳实践，可以让你在开发中更加得心应手。

记住：**类型系统是为了帮助你，而不是束缚你**。合理使用类型，让代码更安全、更易维护！
