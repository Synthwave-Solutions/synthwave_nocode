// Step 2 of writing: parse the plan, drop any link Claude invented, and ask
// for the full article in Markdown.
const cfg = $('Config').first().json;
const r = $('Research competitors').first().json;

const text = ($input.first().json.content || [])
	.filter((block) => block.type === 'text')
	.map((block) => block.text)
	.join('');
let plan;
try {
	plan = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
} catch (error) {
	throw new Error(`Outline was not valid JSON. Raw answer starts with: ${text.slice(0, 300)}`);
}

const norm = (u) => String(u || '').trim().replace(/\/+$/, '').toLowerCase();
const internalUrls = new Set(r.internal_pages.map((p) => norm(p.url)));
const externalUrls = new Set(r.external_sources.map((s) => norm(s.url)));

plan.internal_links = (plan.internal_links || []).filter((l) => internalUrls.has(norm(l.url)));
plan.external_links = (plan.external_links || []).filter((l) => externalUrls.has(norm(l.url)));
plan.slug = String(plan.slug || r.keyword)
	.toLowerCase()
	.normalize('NFKD')
	.replace(/[̀-ͯ]/g, '')
	.replace(/[^a-z0-9]+/g, '-')
	.replace(/^-|-$/g, '');

const system = `You are an expert writer for ${cfg.SITE_URL}. Business: ${cfg.BUSINESS_DESCRIPTION}
Brand voice: ${cfg.BRAND_VOICE}
Write in ${r.language_name}.
Rules:
- Follow the outline exactly. Output GitHub-flavoured Markdown only, starting with "# " + the title. No front matter, no code fences around the whole article.
- Open with a 2-3 sentence direct answer to the search intent (featured-snippet style), then a "Key takeaways" bullet list.
- Use the primary keyword in the first 100 words and in at least one H2; use secondary keywords naturally. Never keyword-stuff.
- Place every planned internal and external link exactly once, in its planned section, as [anchor](url). Do not add any other links.
- Insert every planned diagram in its section as a fenced code block with the language "mermaid", preceded by a one-line caption in italics.
- Add at least one Markdown table where a comparison or checklist helps the reader.
- Never invent statistics, studies, quotes or customer names. If a claim needs a number you do not have, write it qualitatively.
- End with an FAQ section (H2) using the planned questions as H3s with short direct answers, then a closing paragraph with the call to action.
- Short paragraphs (max 3 sentences), concrete examples, active voice.`;

const user = `Primary keyword: ${r.keyword}
Target length: about ${cfg.TARGET_WORDS} words.
Angle: ${r.angle}
Differentiator: ${r.differentiator}

Plan:
${JSON.stringify(plan, null, 1)}`;

return [
	{
		json: {
			plan,
			anthropic_body: {
				model: cfg.CLAUDE_MODEL,
				max_tokens: 16000,
				system,
				messages: [{ role: 'user', content: user }],
			},
		},
	},
];
