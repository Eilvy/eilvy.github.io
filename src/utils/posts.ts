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
 * 统一排序规则（依次比较，先满足者胜出）：
 *
 * 1. 置顶优先；同为置顶按 pinOrder 升序
 * 2. 「有效更新时间」倒序（最新更新的排前面）
 * 3. 创建时间倒序（同一天更新时，较新的文章在前）
 * 4. id 升序（兜底）
 *
 * ── 为什么需要 3、4 两个次级键 ──
 * 只按更新时间排序时，同一天更新的文章会「相等」。
 * 相等时 JS 的 sort 是稳定的，会保留集合返回顺序 ——
 * 那依赖 getCollection 的遍历顺序，并非有意的规则；
 * 一旦内容组织方式变化（如增删文件、改文件名）就可能整体调换。
 * 实测本仓库就存在这种情况：[k8s] Service 与 OSI 网络链路两篇的
 * updatedDate 都是 2026-09-18，谁在前纯属巧合。
 *
 * 加上 3、4 之后比较成为**全序**：任意两篇都有确定的先后，
 * 排序结果不依赖输入顺序，也不会随构建环境变化。
 */
export function sortPosts(posts: BlogPost[]): BlogPost[] {
	return [...posts].sort((a, b) => {
		const aPin = a.data.pin;
		const bPin = b.data.pin;

		// 1. 置顶优先
		if (aPin !== bPin) return aPin ? -1 : 1;
		if (aPin && bPin) {
			const byPinOrder = (a.data.pinOrder ?? 999) - (b.data.pinOrder ?? 999);
			// pinOrder 也相同时不直接返回 0，继续走下面的通用规则兜底
			if (byPinOrder !== 0) return byPinOrder;
		}

		// 2. 有效更新时间倒序
		const byUpdated = getUpdatedDate(b).valueOf() - getUpdatedDate(a).valueOf();
		if (byUpdated !== 0) return byUpdated;

		// 3. 创建时间倒序
		const byPub = b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
		if (byPub !== 0) return byPub;

		// 4. id 兜底，保证全序
		return a.id.localeCompare(b.id);
	});
}

/** 取已发布（非草稿）文章，并按上述规则排好序 */
export async function getSortedPosts(): Promise<BlogPost[]> {
	const posts = await getCollection('blog');
	return sortPosts(posts.filter((post) => !post.data.draft));
}

/** 汇总文章用到的全部标签（去重，保持首次出现的顺序） */
export function collectTags(posts: BlogPost[]): string[] {
	const tags = new Set<string>();
	posts.forEach((post) => {
		post.data.tags.forEach((tag) => tags.add(tag));
	});
	return Array.from(tags);
}

/**
 * 由标签名生成标签页 URL。
 *
 * 必须编码：标签名可能含空格（如 `Stable Diffusion`）或非 ASCII
 * （如 `数据结构`）。直接拼进 href 会得到含原始空格的非法 URL ——
 * 浏览器虽会自动编码、看起来能用，但严格来说不合法，
 * 某些爬虫/工具可能处理不一致。
 */
export function tagUrl(name: string): string {
	return `/tags/${encodeURIComponent(name.toLowerCase())}/`;
}

export interface TagStat {
	/** 标签原文（保留原始大小写，如 k8s / Network） */
	name: string;
	/** 该标签下的文章数 */
	count: number;
}

/**
 * 统计每个标签的文章数，按「文章数倒序 → 名称升序」排列。
 *
 * 供 /tags/ 索引页使用：读者可以先看哪些标签内容多。
 * 名称升序作为次级键，保证同数量时顺序确定（不依赖输入顺序）。
 */
export function collectTagStats(posts: BlogPost[]): TagStat[] {
	const map = new Map<string, TagStat>();

	posts.forEach((post) => {
		post.data.tags.forEach((name) => {
			// 用统一的小写形式做 key，避免 K8s / k8s 被算成两个标签
			const key = name.toLowerCase();
			const hit = map.get(key);
			if (hit) {
				hit.count += 1;
			} else {
				map.set(key, { name, count: 1 });
			}
		});
	});

	return Array.from(map.values()).sort(
		(a, b) => b.count - a.count || a.name.localeCompare(b.name)
	);
}