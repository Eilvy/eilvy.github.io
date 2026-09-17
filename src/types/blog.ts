import type { CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';

/**
 * 博客文章的 frontmatter 数据结构。
 *
 * 以 src/content.config.ts 的 schema 为准。此前 PostCard 与 PostLayout
 * 各自声明了一份且字段不一致（一个有 pin/pinOrder、一个有 ImageMetadata
 * 版的 heroImage），容易改一处漏一处，这里收敛为单一来源。
 *
 * 注意 heroImage：内容集合的 image() 校验会把 frontmatter 里的字符串路径
 * 转成 ImageMetadata 对象，所以运行时拿到的是对象；仍保留 string 是为了
 * 兼容未经 image() 处理的调用方（见 PostLayout 的解析逻辑）。
 */
export interface BlogPostData {
	title: string;
	description: string;
	pubDate: Date;
	/** 只在真正更新过时写入，缺省视为等于 pubDate（见 utils/posts.ts） */
	updatedDate?: Date;
	heroImage?: string | ImageMetadata;
	tags: string[];
	categories: string[];
	draft: boolean;
	author: string;
	/** 置顶：列表页优先展示 */
	pin: boolean;
	/** 多篇置顶之间的排序，越小越靠前 */
	pinOrder: number;
}

/** 内容集合中的一篇文章（含 id / body 等集合字段） */
export type BlogPost = CollectionEntry<'blog'> & { data: BlogPostData };