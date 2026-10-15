// Builds the internal-link inventory from the site's sitemap(s): every
// public URL with its title and meta description, so Claude can only link to
// pages that really exist.
const cfg = $('Config').first().json;
const topic = $input.first().json;

const MAX_URLS = Number(cfg.MAX_SITEMAP_URLS) || 400;
const MAX_FETCH_TITLES = Number(cfg.MAX_PAGES_TO_READ) || 60;
const siteHost = new URL(cfg.SITE_URL).hostname.replace(/^www\./, '');
const EXCLUDE = /\/(tag|tags|category|author|page|feed|wp-json|cart|checkout|account|login|privacy|cookie|terms)(\/|$)|\.(jpg|jpeg|png|gif|webp|svg|pdf|xml)$/i;

const get = async (url) =>
	this.helpers.httpRequest({
		url,
		method: 'GET',
		timeout: 15000,
		headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BlogAutomationBot/1.0)' },
		returnFullResponse: false,
		json: false,
	});

const locs = (xml) => [...String(xml).matchAll(/<loc>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1].trim());

const sitemapQueue = [cfg.SITEMAP_URL || new URL('/sitemap.xml', cfg.SITE_URL).href];
const seenSitemaps = new Set();
const pageUrls = new Set();

while (sitemapQueue.length && seenSitemaps.size < 25 && pageUrls.size < MAX_URLS) {
	const sitemapUrl = sitemapQueue.shift();
	if (seenSitemaps.has(sitemapUrl)) continue;
	seenSitemaps.add(sitemapUrl);
	let xml;
	try {
		xml = await get(sitemapUrl);
	} catch (error) {
		continue;
	}
	const isIndex = /<sitemapindex/i.test(xml);
	for (const loc of locs(xml)) {
		if (isIndex) sitemapQueue.push(loc);
		else pageUrls.add(loc);
	}
}

if (!pageUrls.size) {
	throw new Error(`No URLs found in sitemap ${sitemapQueue[0] || cfg.SITEMAP_URL}. Set SITEMAP_URL in Config.`);
}

const pages = [...pageUrls]
	.filter((u) => {
		try {
			return new URL(u).hostname.replace(/^www\./, '') === siteHost && !EXCLUDE.test(new URL(u).pathname);
		} catch (error) {
			return false;
		}
	})
	.slice(0, MAX_URLS)
	.map((url) => {
		const slug = new URL(url).pathname.replace(/\/$/, '').split('/').pop() || 'home';
		return { url, title: slug.replace(/[-_]+/g, ' '), description: '' };
	});

// Read the pages most related to the topic first so their real titles and
// descriptions are known. The rest keep a title derived from the slug.
const topicTokens = String(topic.keyword).toLowerCase().split(/\s+/).filter((t) => t.length >= 3);
const relatedness = (p) => topicTokens.filter((t) => p.url.toLowerCase().includes(t)).length;
const toRead = [...pages].sort((a, b) => relatedness(b) - relatedness(a)).slice(0, MAX_FETCH_TITLES);

const decode = (s) =>
	String(s || '')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;|&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\s+/g, ' ')
		.trim();

for (let i = 0; i < toRead.length; i += 6) {
	await Promise.all(
		toRead.slice(i, i + 6).map(async (page) => {
			try {
				const html = await get(page.url);
				const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
				const description =
					html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ||
					html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1];
				if (title) page.title = decode(title);
				if (description) page.description = decode(description).slice(0, 200);
			} catch (error) {
				// Unreachable page: keep the slug-based title.
			}
		}),
	);
}

return [{ json: { ...topic, internal_pages: pages } }];
