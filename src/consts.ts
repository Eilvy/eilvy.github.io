/**
 * 站点级常量。
 *
 * 这些值此前散落在 Header / about 等组件里硬编码（邮箱、GitHub 各写了两处），
 * 改一次要翻好几处；统一收敛到这里，组件只引用常量。
 * MY_TWITTER 原先指向占位链接 twitter.com/yourusername，已移除。
 */

/** 站点标题，用于 <title> 与 RSS 频道名 */
export const SITE_TITLE = 'Eilvy 的博客';

/** 站点描述，用于 meta description 与 RSS 频道描述 */
export const SITE_DESCRIPTION = '分享后端开发、VibeCoding、运维开发等文章';

/** 作者署名，显示在文章元信息与 RSS 条目上 */
export const MY_NAME = 'Eilvy';

/** 联系邮箱（about 页展示用） */
export const MY_EMAIL = 'stellaeil@outlook.com';

/** GitHub 主页 */
export const MY_GITHUB = 'https://github.com/eilvy';

/** 首页「最新文章」展示的条数 */
export const POSTS_PER_PAGE = 6;