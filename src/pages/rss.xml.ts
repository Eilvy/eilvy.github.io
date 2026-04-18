import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';

export async function GET(context: any) {
	const posts = await getCollection('blog');
	
	// 过滤掉草稿
	const publishedPosts = posts.filter((post) => !post.data.draft);
	
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: publishedPosts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			link: `/blog/${post.id}/`,
			pubDate: post.data.pubDate,
			author: post.data.author,
			categories: post.data.categories,
		})),
		customData: `
			<language>zh-cn</language>
			<copyright>© ${new Date().getFullYear()} eilvy. All rights reserved.</copyright>
		`,
	});
}
