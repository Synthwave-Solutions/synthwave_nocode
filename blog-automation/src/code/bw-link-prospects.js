// Turns the backlinks of the best-ranking competitor page into an outreach
// list: sites that already link to this topic and may link to our article.
const r = $('Research competitors').first().json;
const post = $('Finalize draft').first().json;

let backlinks = [];
try {
	backlinks = $('DataForSEO: Competitor backlinks')
		.all()
		.flatMap((i) => i.json.tasks || [])
		.flatMap((t) => t.result || [])
		.flatMap((res) => res.items || []);
} catch (error) {
	backlinks = [];
}

if (!backlinks.length) return [];

return backlinks.slice(0, 50).map((b) => ({
	json: {
		keyword: r.keyword,
		our_post_slug: post.slug,
		competitor_url: b.url_to,
		linking_page: b.url_from,
		linking_domain: b.domain_from,
		linking_page_title: b.page_from_title || '',
		anchor: b.anchor || '',
		domain_rank: b.domain_from_rank ?? '',
		dofollow: b.dofollow ? 'yes' : 'no',
		outreach_status: 'todo',
		found_at: new Date().toISOString(),
	},
}));
