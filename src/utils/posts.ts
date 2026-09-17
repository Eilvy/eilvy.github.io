import { getCollection } from 'astro:content';
import type { BlogPost } from '../types/blog';

export type { BlogPost };

/**
 * 文章的有效更新时间。
 * 约定：从未更新过的文章，更新时间等于创建时间（pubDate）。
 */
export function getUpdatedDate(post: BlogPost): Date {
	return post.data.updatedDate ?? post.data.pubDate;
}

/** 是否发生过真实更新（updatedDate 与 pubDate 不同） */
export function isUpdated(post: BlogPost): boolean {
	const { pubDate, updatedDate } = post.data;
	return !!updatedDate && updatedDate.valueOf() !== pubDate.valueOf();
}

/**
 * 统一排序规则：
 * 1. 置顶文章优先，置顶之间按 pinOrder 升序；
 * 2. 其余按「有效更新时间」倒序（最新更新的排前面）。
 */
export function sortPosts(posts: BlogPost[]): BlogPost[] {
	return [...posts].sort((a, b) => {
		const aPin = a.data.pin;
		const bPin = b.data.pin;

		if (aPin && bPin) {
			return (a.data.pinOrder ?? 999) - (b.data.pinOrder ?? 999);
		}
		if (aPin) return -1;
		if (bPin) return 1;

		return getUpdatedDate(b).valueOf() - getUpdatedDate(a).valueOf();
	});
}

/** 取已发布（非草稿）文章，并按上述规则排好序 */
export async function getSortedPosts(): Promise<BlogPost[]> {
	const posts = await getCollection('blog');
	return sortPosts(posts.filter((post) => !post.data.draft));
}

/** 汇总文章用到的全部标签（去重） */
export function collectTags(posts: BlogPost[]): string[] {
	const tags = new Set<string>();
	posts.forEach((post) => {
		post.data.tags.forEach((tag) => tags.add(tag));
	});
	return Array.from(tags);
}