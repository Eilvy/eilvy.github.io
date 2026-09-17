import rss from '@astrojs/rss';
import { getSortedPosts } from '../utils/posts';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';

export async function GET(context: any) {
	// 置顶优先，其余按「有效更新时间」倒序，与站点页面保持一致
	const posts = await getSortedPosts();

	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			link: `/blog/${post.id}/`,
			// RSS 的 pubDate 表达「本条目最后变化时间」，
			// 因此优先取 updatedDate，没有更新过则回落到 pubDate
			pubDate: post.data.updatedDate ?? post.data.pubDate,
			author: post.data.author,
			categories: post.data.categories,
		})),
		customData: `
			<language>zh-cn</language>
			<copyright>© ${new Date().getFullYear()} eilvy. All rights reserved.</copyright>
		`,
	});
}