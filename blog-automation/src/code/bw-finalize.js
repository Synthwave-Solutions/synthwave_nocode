// Quality gate for the draft: removes links that are not in the plan or are
// broken, renders each Mermaid diagram to an image, and builds FAQ schema.
const cfg = $('Config').first().json;
const r = $('Research competitors').first().json;
const plan = $('Build article request').first().json.plan;

let markdown = ($input.first().json.content || [])
	.filter((block) => block.type === 'text')
	.map((block) => block.text)
	.join('')
	.trim()
	.replace(/^```(?:markdown|md)?\s*\n([\s\S]*)\n```$/i, '$1');

const issues = [];
const norm = (u) => String(u || '').trim().replace(/\/+$/, '').toLowerCase();
const siteHost = new URL(cfg.SITE_URL).hostname.replace(/^www\./, '');
const internalUrls = new Set(r.internal_pages.map((p) => norm(p.url)));
const plannedExternal = new Set(plan.external_links.map((l) => norm(l.url)));

const isInternal = (url) => {
	try {
		return new URL(url).hostname.replace(/^www\./, '') === siteHost;
	} catch (error) {
		return false;
	}
};

// 1. Links: keep internal links that exist in the sitemap and external links
// from the plan that still resolve. Anything else becomes plain text.
const linkPattern = /(?<!!)\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
const externalStatus = new Map();
for (const [, , url] of markdown.matchAll(linkPattern)) {
	if (isInternal(url) || !plannedExternal.has(norm(url)) || externalStatus.has(url)) continue;
	try {
		const res = await this.helpers.httpRequest({
			url,
			method: 'GET',
			timeout: 12000,
			json: false,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
			headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BlogAutomationBot/1.0)' },
		});
		// 401/403/429 usually means the site blocks bots, not that the page is gone.
		externalStatus.set(url, res.statusCode < 400 || [401, 403, 429].includes(res.statusCode));
	} catch (error) {
		externalStatus.set(url, false);
	}
}

let internalCount = 0;
let externalCount = 0;
markdown = markdown.replace(linkPattern, (match, anchor, url) => {
	if (isInternal(url)) {
		if (internalUrls.has(norm(url))) {
			internalCount++;
			return match;
		}
		issues.push(`Removed internal link not in sitemap: ${url}`);
		return anchor;
	}
	if (externalStatus.get(url)) {
		externalCount++;
		return match;
	}
	issues.push(`Removed external link (not planned or broken): ${url}`);
	return anchor;
});

// 2. Diagrams: render each mermaid block with mermaid.ink. A diagram that
// does not render (syntax error) is removed rather than published broken.
const diagrams = [];
const blocks = [...markdown.matchAll(/```mermaid\s*\n([\s\S]*?)```/g)];
let markdownForCms = markdown;
for (const [index, block] of blocks.entries()) {
	const code = block[1].trim();
	const encoded = Buffer.from(code, 'utf8').toString('base64url');
	const pngUrl = `https://mermaid.ink/img/${encoded}?type=png&bgColor=!white&width=1200`;
	const svgUrl = `https://mermaid.ink/svg/${encoded}`;
	const title = plan.diagrams?.[index]?.title || `${r.keyword} diagram ${index + 1}`;
	let renders = false;
	try {
		const res = await this.helpers.httpRequest({
			url: svgUrl,
			timeout: 20000,
			json: false,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
		});
		renders = res.statusCode === 200;
	} catch (error) {
		renders = false;
	}
	if (renders) {
		diagrams.push({ title, mermaid: code, png_url: pngUrl, svg_url: svgUrl });
		markdownForCms = markdownForCms.replace(block[0], `![${title.replace(/[\[\]]/g, '')}](${pngUrl})`);
	} else {
		issues.push(`Diagram "${title}" did not render and was removed.`);
		markdownForCms = markdownForCms.replace(block[0], '');
		markdown = markdown.replace(block[0], '');
	}
}

// 3. FAQ schema from the "FAQ" H2 section: every H3 is a question.
const faqSection = markdown.split(/\n## /).find((s) => /^(faq|veelgestelde vragen|frequently asked questions|veel gestelde vragen)/i.test(s.trim()));
const faq = faqSection
	? [...faqSection.matchAll(/\n### (.+)\n+([\s\S]*?)(?=\n### |\n## |$)/g)].map((m) => ({
			'@type': 'Question',
			name: m[1].trim(),
			acceptedAnswer: { '@type': 'Answer', text: m[2].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim() },
		}))
	: [];
const faqSchema = faq.length
	? JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq })
	: '';

const wordCount = markdown.replace(/```[\s\S]*?```/g, '').split(/\s+/).filter(Boolean).length;
if (internalCount < 2) issues.push(`Only ${internalCount} internal links made it into the article.`);
if (wordCount < Number(cfg.TARGET_WORDS) * 0.7) issues.push(`Article is short: ${wordCount} words.`);

return [
	{
		json: {
			keyword: r.keyword,
			title: plan.title,
			seo_title: plan.seo_title,
			meta_description: plan.meta_description,
			slug: plan.slug,
			secondary_keywords: (plan.secondary_keywords || []).join(' | '),
			markdown,
			markdown_for_cms: markdownForCms,
			diagram_urls: diagrams.map((d) => d.png_url).join(' | '),
			diagrams_mermaid: diagrams.map((d) => `%% ${d.title}\n${d.mermaid}`).join('\n\n'),
			faq_schema: faqSchema,
			featured_image_prompt: plan.featured_image_prompt || '',
			word_count: wordCount,
			internal_links: internalCount,
			external_links: externalCount,
			issues: issues.join(' | '),
			status: issues.length ? 'needs-review' : 'draft-ready',
			created_at: new Date().toISOString(),
		},
	},
];
