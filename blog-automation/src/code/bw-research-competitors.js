// Reads the pages that currently rank: their headings (what we must cover
// and beat) and the sources they cite (candidates for our external links).
const cfg = $('Config').first().json;
const topic = $('Crawl sitemap (internal links)').first().json;
const serp = $input.first().json.tasks?.[0]?.result?.[0]?.items || [];

const siteHost = new URL(cfg.SITE_URL).hostname.replace(/^www\./, '');
const hostOf = (url) => {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch (error) {
		return '';
	}
};

const organic = serp
	.filter((i) => i.type === 'organic' && hostOf(i.url) !== siteHost)
	.slice(0, 10)
	.map((i) => ({ rank: i.rank_group, url: i.url, domain: hostOf(i.url), title: i.title, description: i.description || '' }));

const peopleAlsoAsk = serp
	.filter((i) => i.type === 'people_also_ask')
	.flatMap((i) => i.items || [])
	.map((q) => q.title)
	.filter(Boolean);

const competitorDomains = new Set(organic.map((o) => o.domain));
// Sites we never cite: social, UGC, aggregators, link shorteners, and the
// pages we are competing with.
const NEVER_CITE = /(facebook|instagram|twitter|x\.com|linkedin|pinterest|tiktok|youtube|reddit|quora|medium|amazon|bol\.com|bit\.ly|google\.|goo\.gl|t\.co|wa\.me)/i;
const AUTHORITY = /\.(gov|edu|ac\.[a-z]{2}|europa\.eu)$|(wikipedia\.org|who\.int|oecd\.org|cbs\.nl|rijksoverheid\.nl|kvk\.nl|belastingdienst\.nl|statista\.com|mckinsey\.com|gartner\.com|hbr\.org|forrester\.com|nature\.com|ncbi\.nlm\.nih\.gov|w3\.org|developer\.mozilla\.org|developers\.google\.com|github\.com)$/i;

const strip = (html) =>
	String(html)
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;|&#160;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ')
		.trim();

const competitorPages = [];
const externalCandidates = new Map();

const pagesToRead = organic.slice(0, Number(cfg.COMPETITOR_PAGES_TO_READ) || 5);
await Promise.all(
	pagesToRead.map(async (page) => {
		let html = '';
		try {
			html = await this.helpers.httpRequest({
				url: page.url,
				timeout: 20000,
				json: false,
				headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BlogAutomationBot/1.0)' },
			});
		} catch (error) {
			competitorPages.push({ ...page, headings: [], word_count: null, note: 'could not be fetched' });
			return;
		}
		const body = String(html)
			.replace(/<script[\s\S]*?<\/script>/gi, '')
			.replace(/<style[\s\S]*?<\/style>/gi, '')
			.replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, '');
		const headings = [...body.matchAll(/<(h2|h3)[^>]*>([\s\S]*?)<\/\1>/gi)]
			.map((m) => `${m[1].toUpperCase()}: ${strip(m[2])}`)
			.filter((h) => h.length > 4)
			.slice(0, 30);
		const wordCount = strip(body).split(' ').length;

		for (const m of body.matchAll(/<a[^>]+href=["'](https?:\/\/[^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
			const url = m[1];
			const domain = hostOf(url);
			if (!domain || domain === page.domain || domain === siteHost) continue;
			if (competitorDomains.has(domain) || NEVER_CITE.test(domain)) continue;
			const anchor = strip(m[2]).slice(0, 120);
			if (anchor.length < 3) continue;
			const existing = externalCandidates.get(url) || { url, domain, anchor, cited_by: 0, authority: AUTHORITY.test(domain) };
			existing.cited_by += 1;
			externalCandidates.set(url, existing);
		}

		competitorPages.push({ ...page, headings, word_count: wordCount });
	}),
);

// Authority sources and sources cited by several competitors first.
const externalSources = [...externalCandidates.values()]
	.sort((a, b) => Number(b.authority) - Number(a.authority) || b.cited_by - a.cited_by)
	.slice(0, 25);

const wordCounts = competitorPages.map((p) => p.word_count).filter(Boolean);
const medianWords = wordCounts.length ? wordCounts.sort((a, b) => a - b)[Math.floor(wordCounts.length / 2)] : null;

return [
	{
		json: {
			...topic,
			questions: [...new Set([...(topic.questions || []), ...peopleAlsoAsk])].slice(0, 12),
			serp_results: organic,
			competitor_pages: competitorPages.sort((a, b) => a.rank - b.rank),
			competitor_median_words: medianWords,
			external_sources: externalSources,
		},
	},
];
