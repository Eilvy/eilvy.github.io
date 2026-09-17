import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			// 可选：仅在真正更新过内容时才写。
			// 缺省时视为「更新时间 = 创建时间」，见 src/utils/posts.ts 的 getUpdatedDate()
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			tags: z.array(z.string()).default([]),
			categories: z.array(z.string()).default([]),
			draft: z.boolean().default(false),
			author: z.string().default('eilvy'),
			pin: z.boolean().default(false),
			pinOrder: z.number().default(999),
		}),
});

export const collections = { blog };
