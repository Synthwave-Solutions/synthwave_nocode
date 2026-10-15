// Runs every Code node of both workflows end to end against mocked
// DataForSEO, Claude and website responses. Usage: node test/run-tests.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

// Executes a Code node the way n8n does ("Run once for all items").
async function runCode(file, { input, nodes, http }) {
	const source = readFileSync(join(root, 'src/code', `${file}.js`), 'utf8');
	const wrap = (items) => items.map((json) => ({ json }));
	const $ = (name) => {
		if (!(name in nodes)) throw new Error(`Node '${name}' hasn't been executed`);
		const items = wrap(nodes[name]);
		return { all: () => items, first: () => items[0], item: items[0] };
	};
	const $input = { all: () => wrap(input), first: () => wrap(input)[0] };
	const fn = new AsyncFunction('$', '$input', source);
	const result = await fn.call({ helpers: { httpRequest: http || (async () => { throw new Error('no http'); }) } }, $, $input);
	return result.map((i) => i.json);
}

const labsItem = (keyword, volume, kd, intent = 'informational', cpc = 1) => ({
	keyword,
	keyword_info: { search_volume: volume, cpc, competition: 0.2 },
	keyword_properties: { keyword_difficulty: kd },
	search_intent_info: { main_intent: intent },
});
const dfs = (items) => ({ status_code: 20000, tasks: [{ status_code: 20000, result: [{ items }] }] });
const claude = (text) => ({ content: [{ type: 'text', text }] });

// ---------------------------------------------------------------- workflow 1
const form = {
	'Seed keywords': 'n8n automation\nworkflow automatisering',
	'Website domain': 'https://www.synthwave.solutions/',
	Country: 'Netherlands',
	Language: 'Dutch',
	'Max keyword difficulty (0-100)': 30,
	'Min monthly searches': 20,
	'Keywords to check in Google': 3,
	'Known competitors (optional)': 'zapier.com',
	CLAUDE_MODEL: 'claude-sonnet-5-5',
	SHEET_ID: 'sheet',
	BUSINESS_DESCRIPTION: 'Automation agency',
};

const seeds = await runCode('kr-prepare-seeds', { input: [form], nodes: {} });
assert.equal(seeds.length, 2);
assert.equal(seeds[0].domain, 'synthwave.solutions');
assert.deepEqual(seeds[0].competitors, ['zapier.com']);

const wf1 = {
	'Prepare seeds': seeds,
	'DataForSEO: Keyword suggestions': [
		dfs([
			labsItem('n8n automation', 900, 45),
			labsItem('hoe werkt n8n automation', 70, 12),
			labsItem('n8n automation voorbeelden', 110, 18, 'commercial', 3),
			labsItem('zapier vs n8n automation', 400, 10),
		]),
		dfs([labsItem('workflow automatisering mkb', 150, 22, 'commercial', 4)]),
	],
	'DataForSEO: Related keywords': [dfs([{ keyword_data: labsItem('wat is n8n automation', 50, 8) }]), dfs([])],
	'DataForSEO: Keyword ideas': [dfs([labsItem('pizza recept', 50000, 5), labsItem('n8n automation', 900, 45)])],
	'DataForSEO: Your striking-distance keywords': [
		dfs([
			{
				keyword_data: labsItem('n8n consultant', 90, 55, 'commercial', 6),
				ranked_serp_element: { serp_item: { rank_group: 7, url: 'https://synthwave.solutions/n8n' } },
			},
		]),
	],
};

const candidates = await runCode('kr-score', { input: [{}], nodes: wf1 });
const names = candidates.map((c) => c.keyword);
assert.equal(candidates.length, 3, 'limited to "Keywords to check in Google"');
assert.ok(!names.includes('pizza recept'), 'irrelevant keyword removed');
assert.ok(!names.includes('zapier vs n8n automation'), 'competitor-branded keyword removed');
assert.ok(!names.includes('n8n automation'), 'KD 45 is above max_kd and not striking distance');
assert.ok(names.includes('n8n consultant'), 'striking-distance keyword kept despite high KD');
assert.ok(candidates.every((c) => c.low_hanging_fruit));
assert.equal(candidates.find((c) => c.keyword === 'n8n consultant').current_position, 7);
const allScored = await runCode('kr-score', { input: [{}], nodes: { ...wf1, 'Prepare seeds': seeds.map((s) => ({ ...s, serp_checks: 30 })) } });
assert.ok(allScored.find((c) => c.keyword === 'n8n automation voorbeelden').related_questions.length === 0);
assert.ok(allScored.find((c) => c.keyword === 'wat is n8n automation').is_question);
console.log('✓ keyword scoring:', names.join(', '));

const serpResponse = (domains) =>
	dfs([
		...domains.map((domain, i) => ({ type: 'organic', rank_group: i + 1, domain, url: `https://${domain}/page`, title: `Result ${i + 1}` })),
		{ type: 'people_also_ask', items: [{ title: 'Is n8n gratis?' }, { title: 'Wat kost n8n?' }] },
		{ type: 'related_searches', items: ['n8n self hosted', 'n8n vs make'] },
	]);
const withSerp = await runCode('kr-serp-insights', {
	input: [
		serpResponse(['reddit.com', 'www.quora.com', 'n8n.io']),
		serpResponse(['n8n.io', 'synthwave.solutions']),
		serpResponse(['make.com']),
	],
	nodes: { ...wf1, 'Score low-hanging fruit': candidates },
});
assert.equal(withSerp[0].serp_strength, 'weak');
assert.deepEqual(withSerp[0].people_also_ask, ['Is n8n gratis?', 'Wat kost n8n?']);
assert.equal(withSerp[1].current_position, 2, 'own ranking detected in the SERP');
assert.ok(withSerp[1].top_competitors.every((c) => c.domain !== 'synthwave.solutions'));
console.log('✓ SERP insights');

const request = await runCode('kr-positioning-request', { input: withSerp, nodes: wf1 });
assert.equal(request[0].anthropic_body.model, 'claude-sonnet-5-5');
assert.match(request[0].anthropic_body.messages[0].content, /Is n8n gratis\?/);

const plan = {
	clusters: [{ name: 'n8n basics', pillar_keyword: candidates[0].keyword, keywords: names, why_we_can_win: 'Forums rank' }],
	keywords: [{ keyword: candidates[0].keyword, cluster: 'n8n basics', priority: 1, suggested_title: 'Titel', angle: 'A', differentiator: 'D', questions_to_answer: ['Q1', 'Q2'] }],
};
const rows = await runCode('kr-to-rows', {
	input: [claude(`Here you go:\n${JSON.stringify(plan)}`)],
	nodes: { ...wf1, 'Add SERP insights': withSerp },
});
assert.equal(rows.length, 3);
assert.equal(rows[0].status, 'ready');
assert.equal(rows[0].priority, 1);
assert.equal(rows[0].questions_to_answer, 'Q1 | Q2');
assert.equal(rows[0].why_we_can_win, 'Forums rank');
assert.ok(rows.every((r) => Object.values(r).every((v) => typeof v !== 'object')), 'rows are flat for Google Sheets');
await assert.rejects(runCode('kr-to-rows', { input: [claude('sorry')], nodes: { ...wf1, 'Add SERP insights': withSerp } }), /valid JSON/);
console.log('✓ positioning + sheet rows');

// ---------------------------------------------------------------- workflow 2
const config = {
	SITE_URL: 'https://synthwave.solutions',
	SITEMAP_URL: 'https://synthwave.solutions/sitemap_index.xml',
	BUSINESS_DESCRIPTION: 'Automation agency',
	BRAND_VOICE: 'Friendly',
	LANGUAGE: 'Dutch',
	LOCATION_NAME: 'Netherlands',
	TARGET_WORDS: 100,
	MAX_INTERNAL_LINKS: 3,
	MAX_EXTERNAL_LINKS: 2,
	CLAUDE_MODEL: 'claude-sonnet-5-5',
	KEYWORD_OVERRIDE: '',
};

const backlog = [
	{ ...rows[0], status: 'drafted', priority: 1 },
	{ ...rows[1], status: 'ready', priority: 2, opportunity_score: 5 },
	{ ...rows[2], status: 'ready', priority: 2, opportunity_score: 9 },
];
const picked = await runCode('bw-pick-keyword', { input: backlog, nodes: { Config: [config] } });
assert.equal(picked[0].keyword, rows[2].keyword, 'same priority -> higher opportunity first');
assert.deepEqual(await runCode('bw-pick-keyword', { input: [{ ...rows[0], status: 'drafted' }], nodes: { Config: [config] } }), []);
const forced = await runCode('bw-pick-keyword', { input: backlog, nodes: { Config: [{ ...config, KEYWORD_OVERRIDE: rows[0].keyword }] } });
assert.equal(forced[0].keyword, rows[0].keyword);
console.log('✓ pick next keyword');

const site = {
	'https://synthwave.solutions/sitemap_index.xml':
		'<sitemapindex><sitemap><loc>https://synthwave.solutions/post-sitemap.xml</loc></sitemap><sitemap><loc>https://synthwave.solutions/page-sitemap.xml</loc></sitemap></sitemapindex>',
	'https://synthwave.solutions/post-sitemap.xml':
		'<urlset><url><loc>https://synthwave.solutions/blog/n8n-consultant-inhuren/</loc></url><url><loc><![CDATA[https://synthwave.solutions/blog/wat-is-n8n/]]></loc></url><url><loc>https://synthwave.solutions/tag/n8n/</loc></url></urlset>',
	'https://synthwave.solutions/page-sitemap.xml':
		'<urlset><url><loc>https://synthwave.solutions/</loc></url><url><loc>https://synthwave.solutions/contact/</loc></url><url><loc>https://other.com/x</loc></url></urlset>',
	'https://synthwave.solutions/blog/wat-is-n8n/':
		'<html><head><title>Wat is n8n? &amp; waarom</title><meta name="description" content="Uitleg over n8n"></head></html>',
};
const competitorHtml = (n) =>
	`<html><nav><a href="https://nav.com/x">nav link</a></nav><body><h2>Wat is n8n</h2><h3>Voordelen ${n}</h3><p>${'woord '.repeat(800)}</p>
	<a href="https://www.cbs.nl/stats">CBS cijfers</a><a href="https://reddit.com/r/n8n">reddit</a><a href="https://make.com/x">make</a>
	<a href="https://docs.n8n.io/hosting/">n8n docs</a></body></html>`;
const pages = {
	...site,
	'https://make.com/page': competitorHtml(1),
	'https://zapier.com/page': competitorHtml(2),
};
const http = async (options) => {
	const url = options.url;
	if (url.startsWith('https://mermaid.ink/svg/')) {
		const code = Buffer.from(url.split('/svg/')[1], 'base64url').toString();
		const statusCode = code.includes('BROKEN') ? 400 : 200;
		return options.returnFullResponse ? { statusCode, body: '<svg/>' } : '<svg/>';
	}
	if (url === 'https://www.cbs.nl/stats') return { statusCode: 403 };
	if (url === 'https://docs.n8n.io/hosting/') return { statusCode: 404 };
	if (url in pages) return options.returnFullResponse ? { statusCode: 200, body: pages[url] } : pages[url];
	throw new Error(`ENOTFOUND ${url}`);
};

const crawled = await runCode('bw-crawl-sitemap', { input: picked, nodes: { Config: [config] }, http });
const inventory = crawled[0].internal_pages;
assert.deepEqual(
	inventory.map((p) => p.url).sort(),
	[
		'https://synthwave.solutions/',
		'https://synthwave.solutions/blog/n8n-consultant-inhuren/',
		'https://synthwave.solutions/blog/wat-is-n8n/',
		'https://synthwave.solutions/contact/',
	],
	'sitemap index followed, tag pages and other hosts excluded',
);
assert.equal(inventory.find((p) => p.url.endsWith('wat-is-n8n/')).title, "Wat is n8n? & waarom");
assert.equal(inventory.find((p) => p.url.endsWith('wat-is-n8n/')).description, 'Uitleg over n8n');
console.log('✓ sitemap crawl:', inventory.length, 'internal pages');

const wf2 = { Config: [config], 'Crawl sitemap (internal links)': crawled };
const research = await runCode('bw-research-competitors', {
	input: [serpResponse(['make.com', 'synthwave.solutions', 'zapier.com'])],
	nodes: wf2,
	http,
});
const r = research[0];
assert.deepEqual(r.serp_results.map((o) => o.domain), ['make.com', 'zapier.com'], 'own site excluded from competitors');
assert.ok(r.competitor_pages[0].headings.includes('H2: Wat is n8n'));
const sourceUrls = r.external_sources.map((s) => s.url);
assert.deepEqual(sourceUrls[0], 'https://www.cbs.nl/stats', 'authority source ranked first');
assert.ok(!sourceUrls.some((u) => /reddit|make\.com|nav\.com/.test(u)), 'UGC, competitors and nav links excluded');
assert.ok(r.questions.includes('Is n8n gratis?'));
console.log('✓ competitor research:', sourceUrls.length, 'external source candidates');

wf2['Research competitors'] = research;
const outlineRequest = await runCode('bw-outline-request', { input: [{}], nodes: wf2 });
const outlinePrompt = outlineRequest[0].anthropic_body.messages[0].content;
assert.match(outlinePrompt, /blog\/wat-is-n8n\//);
assert.match(outlinePrompt, /cbs\.nl/);

const outline = {
	title: 'Wat is n8n automation?',
	seo_title: 'Wat is n8n automation',
	meta_description: 'Alles over n8n',
	slug: 'Wat is n8n Automation (gids)',
	secondary_keywords: ['n8n workflows'],
	outline: [{ h2: 'Wat is n8n', h3: [], notes: '', answers_question: '' }],
	internal_links: [
		{ url: 'https://synthwave.solutions/blog/wat-is-n8n', anchor: 'uitleg over n8n', section: 'Wat is n8n' },
		{ url: 'https://synthwave.solutions/made-up/', anchor: 'verzonnen', section: 'Wat is n8n' },
	],
	external_links: [
		{ url: 'https://www.cbs.nl/stats', anchor: 'CBS', section: 'Wat is n8n' },
		{ url: 'https://docs.n8n.io/hosting/', anchor: 'docs', section: 'Wat is n8n' },
		{ url: 'https://invented.com/', anchor: 'nope', section: 'Wat is n8n' },
	],
	diagrams: [{ title: 'Flow', section: 'Wat is n8n', mermaid: 'flowchart TD\nA-->B' }, { title: 'Kapot', mermaid: 'BROKEN' }],
	faq: [],
	cta: 'Plan een call',
	featured_image_prompt: 'robot',
};
const articleRequest = await runCode('bw-article-request', { input: [claude(JSON.stringify(outline))], nodes: wf2 });
const cleanPlan = articleRequest[0].plan;
assert.equal(cleanPlan.slug, 'wat-is-n8n-automation-gids');
assert.deepEqual(cleanPlan.internal_links.map((l) => l.url), ['https://synthwave.solutions/blog/wat-is-n8n']);
assert.deepEqual(cleanPlan.external_links.map((l) => l.url), ['https://www.cbs.nl/stats', 'https://docs.n8n.io/hosting/']);
console.log('✓ outline parsed, invented links dropped before writing');

wf2['Build article request'] = articleRequest;
const article = `\`\`\`markdown
# Wat is n8n automation?

n8n automation is ${'heel '.repeat(60)}handig. Lees de [uitleg over n8n](https://synthwave.solutions/blog/wat-is-n8n/) en [contact](https://synthwave.solutions/contact/).
Volgens het [CBS](https://www.cbs.nl/stats) groeit dit. Zie de [docs](https://docs.n8n.io/hosting/) en [verzonnen](https://synthwave.solutions/made-up/) en [random](https://random.com/).

*Flow*
\`\`\`mermaid
flowchart TD
A-->B
\`\`\`

\`\`\`mermaid
BROKEN
\`\`\`

## Veelgestelde vragen

### Is n8n gratis?
Ja, de [community editie](https://synthwave.solutions/) is gratis.

### Wat kost n8n?
Dat hangt af van je gebruik.
\`\`\``;
const [post] = await runCode('bw-finalize', { input: [claude(article)], nodes: wf2, http });
assert.ok(post.markdown.startsWith('# Wat is n8n automation?'), 'outer markdown fence stripped');
assert.match(post.markdown, /\[uitleg over n8n\]\(https:\/\/synthwave\.solutions\/blog\/wat-is-n8n\/\)/, 'trailing slash variant accepted');
assert.match(post.markdown, /\[CBS\]\(https:\/\/www\.cbs\.nl\/stats\)/, 'bot-blocked (403) source kept');
assert.doesNotMatch(post.markdown, /docs\.n8n\.io|made-up|random\.com/, 'broken, invented and unplanned links removed');
assert.match(post.markdown, /Zie de docs en verzonnen en random\./);
assert.equal(post.internal_links, 3);
assert.equal(post.external_links, 1);
assert.match(post.markdown_for_cms, /!\[Flow\]\(https:\/\/mermaid\.ink\/img\//, 'diagram rendered to an image');
assert.doesNotMatch(post.markdown_for_cms, /```mermaid/);
assert.doesNotMatch(post.markdown, /BROKEN/, 'broken diagram removed');
assert.match(post.markdown, /```mermaid\nflowchart TD/, 'mermaid source kept in markdown');
assert.equal(post.slug, 'wat-is-n8n-automation-gids');
const schema = JSON.parse(post.faq_schema);
assert.equal(schema.mainEntity.length, 2);
assert.equal(schema.mainEntity[0].acceptedAnswer.text, 'Ja, de community editie is gratis.');
assert.equal(post.status, 'needs-review');
assert.match(post.issues, /did not render/);
assert.ok(Object.values(post).every((v) => typeof v !== 'object'), 'post row is flat for Google Sheets');
console.log('✓ finalize: links validated, diagrams rendered, FAQ schema built');

const prospects = await runCode('bw-link-prospects', {
	input: [post],
	nodes: {
		...wf2,
		'Finalize draft': [post],
		'DataForSEO: Competitor backlinks': [
			dfs([{ url_from: 'https://blog.nl/tools', domain_from: 'blog.nl', url_to: 'https://make.com/page', anchor: 'n8n', domain_from_rank: 300, dofollow: true }]),
		],
	},
});
assert.equal(prospects.length, 1);
assert.equal(prospects[0].linking_domain, 'blog.nl');
assert.deepEqual(
	await runCode('bw-link-prospects', { input: [post], nodes: { ...wf2, 'Finalize draft': [post], 'DataForSEO: Competitor backlinks': [{ error: 'no subscription' }] } }),
	[],
);
console.log('✓ backlink prospects');

// ------------------------------------------------------- generated workflows
for (const file of ['01-keyword-research.json', '02-blog-writer.json']) {
	const wf = JSON.parse(readFileSync(join(root, 'workflows', file), 'utf8'));
	const nodeNames = new Set(wf.nodes.map((n) => n.name));
	assert.equal(nodeNames.size, wf.nodes.length, `${file}: node names are unique`);
	for (const [from, { main }] of Object.entries(wf.connections)) {
		assert.ok(nodeNames.has(from), `${file}: connection from unknown node ${from}`);
		main.flat().forEach((c) => assert.ok(nodeNames.has(c.node), `${file}: connection to unknown node ${c.node}`));
	}
	// Every $('Node name') reference must point at a node in the same workflow.
	const references = JSON.stringify(wf.nodes).matchAll(/\$\(\\?['"]([^'"\\]+)\\?['"]\)/g);
	for (const [, name] of references) assert.ok(nodeNames.has(name), `${file}: reference to missing node '${name}'`);
	console.log(`✓ ${file}: ${wf.nodes.length} nodes, connections and node references valid`);
}

console.log('\nAll tests passed.');
