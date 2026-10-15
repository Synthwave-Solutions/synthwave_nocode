// Step 1 of writing: Claude plans the article (outline, link plan, diagrams)
// using only the research gathered so far.
const cfg = $('Config').first().json;
const r = $('Research competitors').first().json;

const internalPages = r.internal_pages
	.map((p) => `- ${p.url} | ${p.title}${p.description ? ` | ${p.description}` : ''}`)
	.join('\n');
const externalSources = r.external_sources
	.map((s) => `- ${s.url} | anchor used by competitors: "${s.anchor}" | cited by ${s.cited_by} | authority: ${s.authority}`)
	.join('\n');
const competitors = r.competitor_pages
	.map((p) => `#${p.rank} ${p.url} (${p.word_count ?? '?'} words)\n${p.headings.map((h) => `   ${h}`).join('\n')}`)
	.join('\n');

const system = `You are a senior SEO editor planning a blog article for ${cfg.SITE_URL}.
Business: ${cfg.BUSINESS_DESCRIPTION}
Write all reader-facing text in ${r.language_name}.
Rules:
- The article must fully satisfy the search intent and be clearly better than the current top results: cover what they cover, then add the angle and differentiator.
- Internal links: choose ONLY from the internal page list, exact URLs. Pick pages a reader of this article would genuinely want next. Use descriptive anchor text, never "click here".
- External links: choose ONLY from the external source list, exact URLs. Prefer authority sources. Never link to a page that competes for this keyword.
- Diagrams: plan 1 or 2 diagrams in Mermaid syntax (flowchart TD/LR, sequenceDiagram, timeline, pie or quadrantChart) that explain a process, decision or comparison from the article. Keep node labels short and in ${r.language_name}; wrap labels with special characters in double quotes.
- Answer with JSON only, no prose and no code fences.`;

const user = `Primary keyword: ${r.keyword}
Search intent: ${r.intent} | Volume: ${r.search_volume} | Difficulty: ${r.keyword_difficulty}
Content type: ${r.content_type || 'decide'}
Suggested title: ${r.suggested_title || 'decide'}
Our angle: ${r.angle || 'decide'}
Our differentiator: ${r.differentiator || 'decide'}
Questions the article must answer:
${r.questions.map((q) => `- ${q}`).join('\n')}

Current top results and their headings:
${competitors}

Median competitor length: ${r.competitor_median_words ?? 'unknown'} words. Target length: ${cfg.TARGET_WORDS} words.

Internal page list (url | title | description):
${internalPages}

External source list:
${externalSources || '(none found — leave external_links empty)'}

Return this JSON shape:
{
  "title": "H1, includes the primary keyword, max 65 characters",
  "seo_title": "max 60 characters",
  "meta_description": "max 155 characters, includes the keyword and a reason to click",
  "slug": "lowercase-hyphenated",
  "secondary_keywords": ["string"],
  "search_intent_summary": "one sentence",
  "outline": [
    { "h2": "string", "h3": ["string"], "notes": "what this section must say", "answers_question": "question it answers or empty" }
  ],
  "internal_links": [ { "url": "exact url from the list", "anchor": "string", "section": "h2 where it goes" } ],
  "external_links": [ { "url": "exact url from the list", "anchor": "string", "section": "h2 where it goes", "why": "what it supports" } ],
  "diagrams": [ { "title": "string", "section": "h2 where it goes", "mermaid": "valid mermaid code" } ],
  "faq": [ { "question": "string", "answer_hint": "string" } ],
  "cta": "one sentence call to action that fits the business",
  "featured_image_prompt": "prompt for an illustrative header image, no text in the image"
}
Use ${cfg.MAX_INTERNAL_LINKS} internal links and up to ${cfg.MAX_EXTERNAL_LINKS} external links.`;

return [
	{
		json: {
			anthropic_body: {
				model: cfg.CLAUDE_MODEL,
				max_tokens: 8000,
				system,
				messages: [{ role: 'user', content: user }],
			},
		},
	},
];
