// Combines Claude's plan with the SERP data into flat rows for the
// "Keywords" sheet (the backlog the blog writer workflow picks from).
const cfg = $('Prepare seeds').first().json;
const keywords = $('Add SERP insights').all().map((i) => i.json);

const text = ($input.first().json.content || [])
	.filter((block) => block.type === 'text')
	.map((block) => block.text)
	.join('');
const jsonText = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);

let plan = { clusters: [], keywords: [] };
try {
	plan = JSON.parse(jsonText);
} catch (error) {
	throw new Error(`Claude did not return valid JSON. Raw answer starts with: ${text.slice(0, 300)}`);
}

const planByKeyword = new Map(
	(plan.keywords || []).map((k) => [String(k.keyword).trim().toLowerCase(), k]),
);
const clusterWhy = new Map((plan.clusters || []).map((c) => [c.name, c.why_we_can_win]));
const list = (values) => (values || []).filter(Boolean).join(' | ');

return keywords.map((k) => {
	const p = planByKeyword.get(k.keyword) || {};
	return {
		json: {
			keyword: k.keyword,
			cluster: p.cluster || '',
			priority: p.priority ?? 3,
			opportunity_score: k.opportunity_score,
			search_volume: k.search_volume ?? 'unknown',
			keyword_difficulty: k.keyword_difficulty ?? 'unknown',
			cpc: k.cpc ?? '',
			intent: k.intent,
			current_position: k.current_position ?? '',
			current_url: k.current_url || '',
			serp_strength: k.serp_strength,
			weak_serp_signals: k.weak_serp_signals,
			top_competitors: list(k.top_competitors.map((c) => c.url)),
			people_also_ask: list(k.people_also_ask),
			questions_to_answer: list(p.questions_to_answer || k.related_questions),
			angle: p.angle || '',
			differentiator: p.differentiator || '',
			why_we_can_win: clusterWhy.get(p.cluster) || '',
			suggested_title: p.suggested_title || '',
			content_type: p.content_type || '',
			status: 'ready',
			location: cfg.location_name,
			language: cfg.language_name,
			researched_at: cfg.researched_at,
			post_slug: '',
		},
	};
});
