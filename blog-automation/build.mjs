// Builds the importable n8n workflow files in ./workflows from the Code-node
// sources in ./src/code. Edit the .js files, then run: node build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const code = (name) => readFileSync(join(root, 'src/code', `${name}.js`), 'utf8');

// Stable ids so rebuilding does not create noisy diffs.
let counter = 0;
const id = (prefix) => `${prefix}-${String(++counter).padStart(4, '0')}-4000-8000-000000000000`;

const DATAFORSEO = { httpBasicAuth: { id: 'dataforseo', name: 'DataForSEO' } };
const ANTHROPIC = { anthropicApi: { id: 'anthropic', name: 'Anthropic' } };
const GOOGLE_SHEETS = { googleSheetsOAuth2Api: { id: 'google-sheets', name: 'Google Sheets' } };

const codeNode = (name, file, position, extra = {}) => ({
	parameters: { jsCode: code(file) },
	name,
	type: 'n8n-nodes-base.code',
	typeVersion: 2,
	position,
	...extra,
});

const dataforseoNode = (name, endpoint, jsonBody, position, extra = {}, options = {}) => ({
	parameters: {
		method: 'POST',
		url: `https://api.dataforseo.com/v3/${endpoint}`,
		authentication: 'genericCredentialType',
		genericAuthType: 'httpBasicAuth',
		sendBody: true,
		specifyBody: 'json',
		jsonBody,
		options: { timeout: 120000, ...options },
	},
	name,
	type: 'n8n-nodes-base.httpRequest',
	typeVersion: 4.2,
	position,
	credentials: DATAFORSEO,
	retryOnFail: true,
	waitBetweenTries: 3000,
	...extra,
});

const claudeNode = (name, position) => ({
	parameters: {
		method: 'POST',
		url: 'https://api.anthropic.com/v1/messages',
		authentication: 'predefinedCredentialType',
		nodeCredentialType: 'anthropicApi',
		sendHeaders: true,
		headerParameters: { parameters: [{ name: 'anthropic-version', value: '2023-06-01' }] },
		sendBody: true,
		specifyBody: 'json',
		jsonBody: '={{ JSON.stringify($json.anthropic_body) }}',
		options: { timeout: 600000 },
	},
	name,
	type: 'n8n-nodes-base.httpRequest',
	typeVersion: 4.2,
	position,
	credentials: ANTHROPIC,
	retryOnFail: true,
	maxTries: 3,
	waitBetweenTries: 5000,
});

const sheetNode = (name, operation, sheetName, position, matchingColumns = []) => ({
	parameters: {
		operation,
		documentId: { __rl: true, mode: 'id', value: "={{ $('Config').first().json.SHEET_ID }}" },
		sheetName: { __rl: true, mode: 'name', value: sheetName },
		...(operation === 'read'
			? {}
			: { columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns, schema: [] } }),
		options: {},
	},
	name,
	type: 'n8n-nodes-base.googleSheets',
	typeVersion: 4.5,
	position,
	credentials: GOOGLE_SHEETS,
});

const configNode = (position, values) => ({
	parameters: {
		mode: 'manual',
		duplicateItem: false,
		assignments: {
			assignments: values.map(([name, value, type = 'string']) => ({ id: id('cfg'), name, value, type })),
		},
		includeOtherFields: true,
		include: 'all',
		options: {},
	},
	name: 'Config',
	type: 'n8n-nodes-base.set',
	typeVersion: 3.4,
	position,
});

const sticky = (content, position, width, height, color = 7) => ({
	parameters: { content, width, height, color },
	name: `Note ${++counter}`,
	type: 'n8n-nodes-base.stickyNote',
	typeVersion: 1,
	position,
});

const chain = (...names) =>
	names.slice(0, -1).reduce((connections, name, index) => {
		connections[name] = { main: [[{ node: names[index + 1], type: 'main', index: 0 }]] };
		return connections;
	}, {});

const finish = (workflow) => ({
	...workflow,
	nodes: workflow.nodes.map((node) => ({ id: id('node'), ...node })),
	pinData: {},
	settings: { executionOrder: 'v1', saveManualExecutions: true },
	active: false,
	tags: [],
});

// ---------------------------------------------------------------------------
// 01 – Keyword research: seeds -> low-hanging fruit + questions -> backlog
// ---------------------------------------------------------------------------
const loc = "location_name: $('Prepare seeds').first().json.location_name, language_name: $('Prepare seeds').first().json.language_name";

const keywordResearch = finish({
	name: 'SEO 01 – Keyword research (low-hanging fruit + questions)',
	nodes: [
		sticky(
			'## 1. Input\nFill in the form (or open the form URL). Set **SHEET_ID**, **CLAUDE_MODEL** and your business description once in **Config**.',
			[-60, -180], 460, 520, 6,
		),
		{
			parameters: {
				formTitle: 'Keyword research',
				formDescription:
					'Finds low-hanging-fruit keywords and the questions people ask, then saves a prioritised backlog for the blog writer.',
				formFields: {
					values: [
						{ fieldLabel: 'Seed keywords', fieldType: 'textarea', placeholder: 'one per line, e.g. n8n automation', requiredField: true },
						{ fieldLabel: 'Website domain', placeholder: 'synthwave.solutions' },
						{ fieldLabel: 'What do you sell and to whom?', fieldType: 'textarea' },
						{
							fieldLabel: 'Country',
							fieldType: 'dropdown',
							fieldOptions: { values: ['Netherlands', 'Belgium', 'Germany', 'United Kingdom', 'United States'].map((option) => ({ option })) },
							requiredField: true,
						},
						{
							fieldLabel: 'Language',
							fieldType: 'dropdown',
							fieldOptions: { values: ['Dutch', 'English', 'German', 'French'].map((option) => ({ option })) },
							requiredField: true,
						},
						{ fieldLabel: 'Max keyword difficulty (0-100)', fieldType: 'number', placeholder: '30' },
						{ fieldLabel: 'Min monthly searches', fieldType: 'number', placeholder: '20' },
						{ fieldLabel: 'Keywords to check in Google', fieldType: 'number', placeholder: '10' },
						{ fieldLabel: 'Known competitors (optional)', fieldType: 'textarea', placeholder: 'competitor.com' },
					],
				},
				options: {},
			},
			name: 'Keyword research form',
			type: 'n8n-nodes-base.formTrigger',
			typeVersion: 2.2,
			position: [0, 0],
			webhookId: 'b1a7c0de-5e0a-4c1e-9f00-000000000001',
		},
		configNode([220, 0], [
			['SHEET_ID', 'PASTE_YOUR_GOOGLE_SHEET_ID'],
			['CLAUDE_MODEL', 'claude-sonnet-5-5'],
			['BUSINESS_DESCRIPTION', 'Describe your business, your offer and your ideal customer here.'],
			['DEFAULT_COUNTRY', 'Netherlands'],
			['DEFAULT_LANGUAGE', 'Dutch'],
		]),
		codeNode('Prepare seeds', 'kr-prepare-seeds', [440, 0]),
		sticky(
			'## 2. Collect keywords (DataForSEO Labs)\nSuggestions + related keywords per seed, ideas for all seeds together, and the keywords your site already ranks **4-20** for (striking distance).',
			[640, -180], 920, 520, 4,
		),
		dataforseoNode(
			'DataForSEO: Keyword suggestions',
			'dataforseo_labs/google/keyword_suggestions/live',
			'={{ JSON.stringify([{ keyword: $json.seed, location_name: $json.location_name, language_name: $json.language_name, include_seed_keyword: true, limit: 200 }]) }}',
			[700, 0],
		),
		dataforseoNode(
			'DataForSEO: Related keywords',
			'dataforseo_labs/google/related_keywords/live',
			`={{ JSON.stringify([{ keyword: $('Prepare seeds').item.json.seed, ${loc}, depth: 2, limit: 200 }]) }}`,
			[920, 0],
		),
		dataforseoNode(
			'DataForSEO: Keyword ideas',
			'dataforseo_labs/google/keyword_ideas/live',
			`={{ JSON.stringify([{ keywords: $('Prepare seeds').first().json.seeds, ${loc}, limit: 300 }]) }}`,
			[1140, 0],
			{ executeOnce: true },
		),
		dataforseoNode(
			'DataForSEO: Your striking-distance keywords',
			'dataforseo_labs/google/ranked_keywords/live',
			`={{ JSON.stringify([{ target: $('Prepare seeds').first().json.domain, ${loc}, limit: 300, filters: [["ranked_serp_element.serp_item.rank_group", ">=", 4], "and", ["ranked_serp_element.serp_item.rank_group", "<=", 20]], order_by: ["keyword_data.keyword_info.search_volume,desc"] }]) }}`,
			[1360, 0],
			{ executeOnce: true, onError: 'continueRegularOutput', alwaysOutputData: true },
		),
		sticky(
			'## 3. Pick low-hanging fruit + check Google\nScores every keyword (volume, difficulty, intent, CPC, striking distance), keeps the easy wins, then reads the live SERP: People Also Ask, competitors and forum/UGC results (= beatable SERP).',
			[1580, -180], 700, 520, 5,
		),
		codeNode('Score low-hanging fruit', 'kr-score', [1640, 0]),
		dataforseoNode(
			'DataForSEO: Google SERP',
			'serp/google/organic/live/advanced',
			`={{ JSON.stringify([{ keyword: $json.keyword, ${loc}, depth: 10, people_also_ask_click_depth: 1 }]) }}`,
			[1860, 0],
			{},
			// The SERP call fires once per keyword; throttle it a little.
			{ batching: { batch: { batchSize: 5, batchInterval: 1000 } } },
		),
		codeNode('Add SERP insights', 'kr-serp-insights', [2080, 0]),
		sticky(
			'## 4. Position + save\nClaude clusters the keywords and decides the angle that sets us apart from the top results. Rows land in the **Keywords** tab with status `ready`.',
			[2300, -180], 700, 520, 3,
		),
		codeNode('Build positioning request', 'kr-positioning-request', [2360, 0]),
		claudeNode('Claude: Cluster & position', [2580, 0]),
		codeNode('Prepare sheet rows', 'kr-to-rows', [2800, 0]),
		sheetNode('Save to keyword backlog', 'append', 'Keywords', [3020, 0]),
	],
	connections: chain(
		'Keyword research form',
		'Config',
		'Prepare seeds',
		'DataForSEO: Keyword suggestions',
		'DataForSEO: Related keywords',
		'DataForSEO: Keyword ideas',
		'DataForSEO: Your striking-distance keywords',
		'Score low-hanging fruit',
		'DataForSEO: Google SERP',
		'Add SERP insights',
		'Build positioning request',
		'Claude: Cluster & position',
		'Prepare sheet rows',
		'Save to keyword backlog',
	),
});


// ---------------------------------------------------------------------------
// 02 – Blog writer: backlog keyword -> research -> outline -> article
// ---------------------------------------------------------------------------
const blogWriter = finish({
	name: 'SEO 02 – Blog writer (research, links, diagrams, draft)',
	nodes: [
		sticky(
			'## 1. Pick a keyword\nRuns on schedule or manually. Takes the best `ready` keyword from the **Keywords** tab (or `KEYWORD_OVERRIDE` in Config).',
			[-60, -200], 680, 620, 6,
		),
		{
			parameters: {},
			name: 'Run now',
			type: 'n8n-nodes-base.manualTrigger',
			typeVersion: 1,
			position: [0, -40],
		},
		{
			parameters: { rule: { interval: [{ field: 'cronExpression', expression: '45 7 * * 1,4' }] } },
			name: 'Mon + Thu 07:45',
			type: 'n8n-nodes-base.scheduleTrigger',
			typeVersion: 1.2,
			position: [0, 160],
		},
		configNode([220, 60], [
			['SHEET_ID', 'PASTE_YOUR_GOOGLE_SHEET_ID'],
			['SITE_URL', 'https://synthwave.solutions'],
			['SITEMAP_URL', 'https://synthwave.solutions/sitemap.xml'],
			['BUSINESS_DESCRIPTION', 'Describe your business, your offer and your ideal customer here.'],
			['BRAND_VOICE', 'Friendly expert. Plain language, concrete examples, no hype, no jargon without explanation.'],
			['LANGUAGE', 'Dutch'],
			['LOCATION_NAME', 'Netherlands'],
			['TARGET_WORDS', 1800, 'number'],
			['MAX_INTERNAL_LINKS', 5, 'number'],
			['MAX_EXTERNAL_LINKS', 4, 'number'],
			['MAX_SITEMAP_URLS', 400, 'number'],
			['MAX_PAGES_TO_READ', 60, 'number'],
			['COMPETITOR_PAGES_TO_READ', 5, 'number'],
			['CLAUDE_MODEL', 'claude-sonnet-5-5'],
			['KEYWORD_OVERRIDE', ''],
		]),
		sheetNode('Read keyword backlog', 'read', 'Keywords', [440, 60]),
		sticky(
			'## 2. Research (separate from writing)\nInternal-link inventory from your sitemap, live SERP, competitor headings + the sources they cite (external links), and who links to the #1 page (backlink prospects).',
			[640, -200], 920, 620, 4,
		),
		codeNode('Pick next keyword', 'bw-pick-keyword', [700, 60]),
		codeNode('Crawl sitemap (internal links)', 'bw-crawl-sitemap', [920, 60]),
		dataforseoNode(
			'DataForSEO: Google SERP',
			'serp/google/organic/live/advanced',
			'={{ JSON.stringify([{ keyword: $json.keyword, location_name: $json.location_name, language_name: $json.language_name, depth: 10, people_also_ask_click_depth: 2 }]) }}',
			[1140, 60],
		),
		codeNode('Research competitors', 'bw-research-competitors', [1360, 60]),
		dataforseoNode(
			'DataForSEO: Competitor backlinks',
			'backlinks/backlinks/live',
			'={{ JSON.stringify([{ target: $json.serp_results[0] ? $json.serp_results[0].url : "", mode: "one_per_domain", limit: 50, filters: ["dofollow", "=", true], order_by: ["domain_from_rank,desc"] }]) }}',
			[1580, 60],
			{ onError: 'continueRegularOutput', alwaysOutputData: true, retryOnFail: false },
		),
		sticky(
			'## 3. Write\nClaude plans first (outline, internal + external link plan, Mermaid diagrams, FAQ), then writes. Links are restricted to real sitemap pages and researched sources.',
			[1780, -200], 700, 620, 5,
		),
		codeNode('Build outline request', 'bw-outline-request', [1840, 60]),
		claudeNode('Claude: Outline & link plan', [2060, 60]),
		codeNode('Build article request', 'bw-article-request', [2280, 60]),
		claudeNode('Claude: Write article', [2500, 60]),
		sticky(
			'## 4. Quality gate + publish\nRemoves invented/broken links, renders diagrams to images (mermaid.ink), adds FAQ schema, saves to **Posts**, marks the keyword `drafted`, logs backlink prospects. Enable the WordPress node if you publish there.',
			[2700, -200], 920, 860, 3,
		),
		codeNode('Finalize draft', 'bw-finalize', [2760, 60]),
		{
			parameters: { mode: 'markdownToHtml', markdown: '={{ $json.markdown_for_cms }}', destinationKey: 'html', options: {} },
			name: 'Markdown to HTML',
			type: 'n8n-nodes-base.markdown',
			typeVersion: 1,
			position: [2980, 60],
		},
		sheetNode('Save draft to Posts', 'append', 'Posts', [3240, -100]),
		{
			parameters: {
				jsCode:
					"// Marks the keyword as written so the next run picks a new one.\nconst post = $input.first().json;\nreturn [{ json: { keyword: post.keyword, status: 'drafted', post_slug: post.slug } }];\n",
			},
			name: 'Mark keyword drafted',
			type: 'n8n-nodes-base.code',
			typeVersion: 2,
			position: [3240, 80],
		},
		sheetNode('Update keyword status', 'update', 'Keywords', [3460, 80], ['keyword']),
		codeNode('Backlink prospects', 'bw-link-prospects', [3240, 260]),
		sheetNode('Save link prospects', 'append', 'Link prospects', [3460, 260]),
		{
			parameters: {
				title: '={{ $json.title }}',
				additionalFields: {
					content:
						'={{ $json.html }}{{ $json.faq_schema ? \'\\n<script type="application/ld+json">\' + $json.faq_schema + \'</script>\' : \'\' }}',
					slug: '={{ $json.slug }}',
					status: 'draft',
				},
			},
			name: 'Create WordPress draft',
			type: 'n8n-nodes-base.wordpress',
			typeVersion: 1,
			position: [3240, 440],
			credentials: { wordpressApi: { id: 'wordpress', name: 'WordPress' } },
			disabled: true,
		},
	],
	connections: {
		'Run now': { main: [[{ node: 'Config', type: 'main', index: 0 }]] },
		'Mon + Thu 07:45': { main: [[{ node: 'Config', type: 'main', index: 0 }]] },
		...chain(
			'Config',
			'Read keyword backlog',
			'Pick next keyword',
			'Crawl sitemap (internal links)',
			'DataForSEO: Google SERP',
			'Research competitors',
			'DataForSEO: Competitor backlinks',
			'Build outline request',
			'Claude: Outline & link plan',
			'Build article request',
			'Claude: Write article',
			'Finalize draft',
			'Markdown to HTML',
		),
		'Markdown to HTML': {
			main: [
				[
					{ node: 'Save draft to Posts', type: 'main', index: 0 },
					{ node: 'Mark keyword drafted', type: 'main', index: 0 },
					{ node: 'Backlink prospects', type: 'main', index: 0 },
					{ node: 'Create WordPress draft', type: 'main', index: 0 },
				],
			],
		},
		'Mark keyword drafted': { main: [[{ node: 'Update keyword status', type: 'main', index: 0 }]] },
		'Backlink prospects': { main: [[{ node: 'Save link prospects', type: 'main', index: 0 }]] },
	},
});

for (const [file, workflow] of [
	['01-keyword-research.json', keywordResearch],
	['02-blog-writer.json', blogWriter],
]) {
	writeFileSync(join(root, 'workflows', file), `${JSON.stringify(workflow, null, '\t')}\n`);
	console.log(`wrote workflows/${file} (${workflow.nodes.length} nodes)`);
}
