<?xml version="1.0" encoding="UTF-8"?>
<!--
	RSS 的浏览器呈现样式表。

	作用：浏览器直接打开 /rss.xml 时，用它渲染成可读的文章列表，
	而不是抛出一句「This XML file does not appear to have any style
	information associated with it」再把原始 XML 树摊开。

	注意：
	- 只影响「浏览器直接打开」的场景。RSS 阅读器解析的是原始 XML，
	  完全不受这里影响，因此可以放心改样式。
	- 这里是独立于站点的 XML 文档，拿不到站点的主题切换状态，
	  所以用 prefers-color-scheme 跟随系统深浅色，而不是站点的 .dark 类。
	- 配色与站点主色保持一致（对应站点 CSS 变量里的主色 #3b82f6）。
-->
<xsl:stylesheet version="1.0"
	xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

	<xsl:output method="html" encoding="UTF-8" indent="yes"
		doctype-public="-//W3C//DTD HTML 4.01//EN"
		doctype-system="http://www.w3.org/TR/html4/strict.dtd" />

	<xsl:template match="/rss/channel">
		<html lang="zh-CN">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>
					<xsl:value-of select="title" />
				</title>
				<style>
					:root {
						--bg: #ffffff;
						--bg-alt: #f8f9fa;
						--text: #111827;
						--text-light: #6b7280;
						--border: #e5e7eb;
						--primary: #3b82f6;
					}
					@media (prefers-color-scheme: dark) {
						:root {
							--bg: #0f172a;
							--bg-alt: #1e293b;
							--text: #e2e8f0;
							--text-light: #94a3b8;
							--border: #334155;
							--primary: #60a5fa;
						}
					}
					* { box-sizing: border-box; }
					body {
						margin: 0;
						padding: 2.5rem 1.25rem 4rem;
						background: var(--bg);
						color: var(--text);
						font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
							"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
							Roboto, Helvetica, Arial, sans-serif;
						line-height: 1.7;
						-webkit-font-smoothing: antialiased;
					}
					.wrap { max-width: 760px; margin: 0 auto; }
					.feed-head { border-bottom: 1px solid var(--border); padding-bottom: 1.5rem; margin-bottom: 2rem; }
					.feed-head h1 { margin: 0 0 .5rem; font-size: 1.75rem; }
					.feed-head p { margin: 0; color: var(--text-light); }
					.feed-head .links { margin-top: .75rem; font-size: .875rem; }
					.feed-head .links a { color: var(--primary); text-decoration: none; }
					.feed-head .links a:hover { text-decoration: underline; }
					.item { padding: 1.25rem 0; border-bottom: 1px solid var(--border); }
					.item:last-child { border-bottom: none; }
					.item h2 { margin: 0 0 .4rem; font-size: 1.125rem; font-weight: 600; }
					.item h2 a { color: var(--text); text-decoration: none; }
					.item h2 a:hover { color: var(--primary); }
					.item .meta { font-size: .8125rem; color: var(--text-light); }
					.item .desc { margin: .5rem 0 0; color: var(--text-light); font-size: .9375rem; }
					.item .cats { margin-top: .5rem; display: flex; flex-wrap: wrap; gap: .375rem; }
					.item .cat {
						font-size: .75rem; color: var(--text-light);
						background: var(--bg-alt); border: 1px solid var(--border);
						border-radius: 9999px; padding: .1rem .6rem;
					}
					.note {
						margin-top: 3rem; padding: 1rem 1.25rem;
						background: var(--bg-alt); border: 1px solid var(--border);
						border-radius: 10px; font-size: .875rem; color: var(--text-light);
					}
					.note strong { color: var(--text); }
				</style>
			</head>
			<body>
				<div class="wrap">
					<header class="feed-head">
						<h1>
							<xsl:value-of select="title" />
						</h1>
						<p>
							<xsl:value-of select="description" />
						</p>
						<p class="links">
							<a href="{link}">
								<xsl:value-of select="link" />
							</a>
							<xsl:text> · 共 </xsl:text>
							<xsl:value-of select="count(item)" />
							<xsl:text> 篇</xsl:text>
						</p>
					</header>

					<xsl:for-each select="item">
						<article class="item">
							<h2>
								<a href="{link}">
									<xsl:value-of select="title" />
								</a>
							</h2>
							<div class="meta">
								<xsl:value-of select="pubDate" />
								<xsl:if test="author">
									<xsl:text> · </xsl:text>
									<xsl:value-of select="author" />
								</xsl:if>
							</div>
							<p class="desc">
								<xsl:value-of select="description" />
							</p>
							<xsl:if test="category">
								<div class="cats">
									<xsl:for-each select="category">
										<span class="cat">
											<xsl:value-of select="." />
										</span>
									</xsl:for-each>
								</div>
							</xsl:if>
						</article>
					</xsl:for-each>

					<div class="note">
						<strong>这是 RSS 订阅源</strong>（原始 XML 位于
						<a href="/rss.xml">/rss.xml</a>）。
						把地址填入任意 RSS 阅读器即可订阅，如 Feedly、Inoreader、NetNewsWire。
					</div>
				</div>
			</body>
		</html>
	</xsl:template>

</xsl:stylesheet>
