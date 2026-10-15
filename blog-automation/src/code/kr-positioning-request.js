// Builds one Claude request that clusters the candidates and decides how we
// position each article so it is different from what already ranks.
const cfg = $('Prepare seeds').first().json;
const keywords = $input.all().map((i) => i.json);

const compact = keywords.map((k) => ({
	keyword: k.keyword,
	volume: k.search_volume,
	kd: k.keyword_difficulty,
	intent: k.intent,
	opportunity: k.opportunity_score,
	we_rank: k.current_position,
	serp_strength: k.serp_strength,
	competitors: k.top_competitors.map((c) => `${c.rank}. ${c.domain} — ${c.title}`),
	people_also_ask: k.people_also_ask,
	related_questions: k.related_questions,
}));

const system = `You are a senior SEO content strategist. You turn keyword data into a content plan a small team can execute.
Rules:
- Use only the data provided. Never invent search volumes or rankings.
- Group keywords that would be answered by the same article into one cluster (same search intent = same page).
- For every keyword, decide how we position ourselves so the article is clearly different from and better than the current top results (a unique angle, format, data, or experience the competitors lack).
- Write titles, angles and questions in ${cfg.language_name}.
- Answer with JSON only, no prose and no code fences.`;

const user = `Business: ${cfg.business || 'not provided'}
Website: ${cfg.domain || 'not provided'}
Market: ${cfg.location_name} / ${cfg.language_name}

Candidate low-hanging-fruit keywords with live SERP data:
${JSON.stringify(compact, null, 1)}

Return this JSON shape:
{
  "clusters": [
    { "name": "string", "pillar_keyword": "string", "keywords": ["string"], "why_we_can_win": "string" }
  ],
  "keywords": [
    {
      "keyword": "exact keyword from the input",
      "cluster": "cluster name",
      "priority": 1,
      "content_type": "how-to guide | listicle | comparison | explainer | checklist | case study | glossary",
      "suggested_title": "string, max 60 characters",
      "angle": "one sentence: the unique angle we take",
      "differentiator": "one sentence: what we add that the top 5 results do not",
      "questions_to_answer": ["the 4-8 most important questions the article must answer, using people_also_ask and related_questions"]
    }
  ]
}
priority: 1 = write first (high opportunity, weak SERP, strong business fit), 3 = later.
Include every input keyword exactly once in "keywords".`;

return [
	{
		json: {
			anthropic_body: {
				model: cfg.claude_model,
				max_tokens: 8000,
				system,
				messages: [{ role: 'user', content: user }],
			},
		},
	},
];
