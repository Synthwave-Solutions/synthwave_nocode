// Picks the next keyword from the backlog: status "ready", best priority
// first, then highest opportunity score. KEYWORD_OVERRIDE forces a keyword.
const cfg = $('Config').first().json;
const rows = $input.all().map((i) => i.json);

const override = String(cfg.KEYWORD_OVERRIDE || '').trim().toLowerCase();
const ready = rows.filter((r) =>
	override ? String(r.keyword).trim().toLowerCase() === override : String(r.status).trim().toLowerCase() === 'ready',
);

if (!ready.length) {
	// Nothing to write: stop quietly instead of failing the scheduled run.
	return [];
}

ready.sort(
	(a, b) =>
		(Number(a.priority) || 3) - (Number(b.priority) || 3) ||
		(Number(b.opportunity_score) || 0) - (Number(a.opportunity_score) || 0),
);

const pick = ready[0];
const split = (value) =>
	String(value || '')
		.split('|')
		.map((s) => s.trim())
		.filter(Boolean);

return [
	{
		json: {
			...pick,
			keyword: String(pick.keyword).trim(),
			questions: [...new Set([...split(pick.questions_to_answer), ...split(pick.people_also_ask)])],
			competitor_urls: split(pick.top_competitors),
			location_name: pick.location || cfg.LOCATION_NAME,
			language_name: pick.language || cfg.LANGUAGE,
		},
	},
];
