// Merges every DataForSEO keyword source, dedupes, scores and picks the
// low-hanging fruit: keywords with real demand and low difficulty, plus
// keywords the site already ranks 4-20 for ("striking distance").
const cfg = $('Prepare seeds').first().json;

const QUESTION_START =
	// English, Dutch, French and German question openers.
	/^(what|how|why|when|where|which|who|whom|whose|can|could|does|do|did|is|are|was|should|will|would|wat|hoe|waarom|wanneer|waar|welke|wie|kan|kun|kunnen|mag|moet|moeten|zijn|wordt|heb|hebben|hoeveel|comment|pourquoi|quand|quel|quelle|warum|wann|welche|wo)\b/i;

const INTENT_WEIGHT = {
	informational: 1,
	commercial: 1.3,
	transactional: 1.15,
	navigational: 0.3,
};

function resultItems(nodeName) {
	try {
		return $(nodeName)
			.all()
			.flatMap((item) => item.json.tasks || [])
			.flatMap((task) => task.result || [])
			.flatMap((result) => result.items || []);
	} catch (error) {
		// Node did not run or errored (e.g. no domain for ranked keywords).
		return [];
	}
}

const rows = new Map();

function upsert(data, source, extra = {}) {
	if (!data || !data.keyword) return;
	const keyword = String(data.keyword).trim().toLowerCase();
	const info = data.keyword_info || {};
	const row = rows.get(keyword) || {
		keyword,
		search_volume: null,
		keyword_difficulty: null,
		cpc: null,
		competition: null,
		intent: 'unknown',
		current_position: null,
		current_url: '',
		sources: new Set(),
	};
	row.search_volume ??= info.search_volume ?? null;
	row.cpc ??= info.cpc ?? null;
	row.competition ??= info.competition ?? null;
	row.keyword_difficulty ??= data.keyword_properties?.keyword_difficulty ?? null;
	if (row.intent === 'unknown' && data.search_intent_info?.main_intent) {
		row.intent = data.search_intent_info.main_intent;
	}
	row.sources.add(source);
	Object.assign(row, extra);
	rows.set(keyword, row);
}

resultItems('DataForSEO: Keyword suggestions').forEach((i) => upsert(i, 'suggestions'));
resultItems('DataForSEO: Related keywords').forEach((i) => upsert(i.keyword_data, 'related'));
resultItems('DataForSEO: Keyword ideas').forEach((i) => upsert(i, 'ideas'));
resultItems('DataForSEO: Your striking-distance keywords').forEach((i) => {
	const serpItem = i.ranked_serp_element?.serp_item || {};
	upsert(i.keyword_data, 'your-rankings', {
		current_position: serpItem.rank_group ?? null,
		current_url: serpItem.url || '',
	});
});

// Relevance: keep keywords that share a meaningful word with a seed,
// or that the site already ranks for.
const seedTokens = new Set(
	cfg.seeds.flatMap((s) => s.split(/\s+/)).filter((t) => t.length >= 3),
);
const isRelevant = (row) =>
	row.current_position !== null ||
	row.keyword.split(/\s+/).some((t) => seedTokens.has(t));

const brandBlocklist = cfg.competitors.map((c) => c.split('.')[0]).filter((c) => c.length >= 3);
const isCompetitorBranded = (row) => brandBlocklist.some((b) => row.keyword.includes(b));

const scored = [...rows.values()]
	.filter((row) => isRelevant(row) && !isCompetitorBranded(row))
	.map((row) => {
		const volume = row.search_volume ?? 0;
		const kdKnown = row.keyword_difficulty !== null;
		const kd = kdKnown ? row.keyword_difficulty : 50;
		const cpc = row.cpc ?? 0;
		const striking = row.current_position !== null && row.current_position >= 4 && row.current_position <= 20;
		const isQuestion = QUESTION_START.test(row.keyword) || row.keyword.includes('?');
		// Already ranking 4-20 means Google trusts the page for this topic, so
		// difficulty matters less and the upside is bigger.
		const difficultyFactor = Math.pow((100 - kd) / 100, 2);
		const opportunity =
			Math.sqrt(volume) *
			(striking ? Math.max(difficultyFactor, 0.5) : difficultyFactor) *
			(INTENT_WEIGHT[row.intent] ?? 1) *
			(1 + Math.min(cpc, 10) / 10) *
			(striking ? 2 : 1) *
			(isQuestion ? 1.1 : 1);
		const lowHangingFruit =
			striking || (kdKnown && kd <= cfg.max_kd && volume >= cfg.min_volume);
		return {
			...row,
			sources: [...row.sources].join(', '),
			is_question: isQuestion,
			striking_distance: striking,
			low_hanging_fruit: lowHangingFruit,
			opportunity_score: Math.round(opportunity * 10) / 10,
		};
	})
	.sort((a, b) => b.opportunity_score - a.opportunity_score);

const questions = scored.filter((r) => r.is_question);
const candidates = scored.filter((r) => r.low_hanging_fruit);

if (!candidates.length) {
	throw new Error(
		`No low-hanging fruit found among ${scored.length} relevant keywords. ` +
			'Try broader seeds, a higher max keyword difficulty or a lower minimum volume.',
	);
}

// Questions from the dataset that belong to a candidate keyword.
const relatedQuestions = (keyword) => {
	const tokens = keyword.split(/\s+/).filter((t) => t.length >= 3 && !QUESTION_START.test(t));
	return questions
		.filter((q) => q.keyword !== keyword && tokens.length && tokens.every((t) => q.keyword.includes(t)))
		.slice(0, 8)
		.map((q) => q.keyword);
};

const summary = {
	total_keywords: rows.size,
	relevant_keywords: scored.length,
	low_hanging_fruit: candidates.length,
	question_keywords: questions.length,
};

return candidates.slice(0, cfg.serp_checks).map((row) => ({
	json: { ...row, related_questions: relatedQuestions(row.keyword), summary },
}));
