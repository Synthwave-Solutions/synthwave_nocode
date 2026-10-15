// Reads the live Google results for each candidate and adds what we need to
// position ourselves: who ranks, what people also ask, and how beatable the
// SERP looks (forums/UGC in the top 10 = weak SERP).
const cfg = $('Prepare seeds').first().json;
const candidates = $('Score low-hanging fruit').all();

const UGC_DOMAINS = [
	'reddit.com',
	'quora.com',
	'medium.com',
	'linkedin.com',
	'facebook.com',
	'pinterest.com',
	'tiktok.com',
	'stackexchange.com',
	'stackoverflow.com',
	'tweakers.net',
	'zhihu.com',
];
const isUgc = (domain) =>
	UGC_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`)) || /forum|community|discuss/.test(domain);

return $input.all().map((item, index) => {
	const candidate = candidates[index].json;
	const result = item.json.tasks?.[0]?.result?.[0] || {};
	const serpItems = result.items || [];

	const organic = serpItems
		.filter((i) => i.type === 'organic')
		.slice(0, 10)
		.map((i) => ({
			rank: i.rank_group,
			domain: (i.domain || '').replace(/^www\./, ''),
			url: i.url,
			title: i.title,
		}));

	const peopleAlsoAsk = serpItems
		.filter((i) => i.type === 'people_also_ask')
		.flatMap((i) => i.items || [])
		.map((q) => q.title)
		.filter(Boolean);

	const relatedSearches = serpItems
		.filter((i) => i.type === 'related_searches')
		.flatMap((i) => i.items || [])
		.filter((s) => typeof s === 'string');

	const features = [...new Set(serpItems.map((i) => i.type).filter((t) => t !== 'organic'))];
	const ugcCount = organic.filter((o) => isUgc(o.domain)).length;
	const ours = cfg.domain ? organic.find((o) => o.domain === cfg.domain || o.domain.endsWith(`.${cfg.domain}`)) : null;

	const kd = candidate.keyword_difficulty ?? 50;
	let serpStrength = 'medium';
	if (ugcCount >= 2 || kd <= 15) serpStrength = 'weak';
	if (ugcCount === 0 && kd >= 45) serpStrength = 'strong';

	return {
		json: {
			...candidate,
			current_position: ours ? ours.rank : candidate.current_position,
			current_url: ours ? ours.url : candidate.current_url,
			serp_strength: serpStrength,
			weak_serp_signals: ugcCount ? `${ugcCount} forum/UGC results in top 10` : '',
			serp_features: features,
			top_competitors: organic.filter((o) => o.domain !== cfg.domain).slice(0, 5),
			people_also_ask: [...new Set(peopleAlsoAsk)].slice(0, 8),
			related_searches: relatedSearches.slice(0, 8),
		},
	};
});
