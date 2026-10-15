// Turns the form submission + Config into one item per seed keyword.
// Every item carries the full settings so downstream nodes can read them.
const input = $input.first().json;

const seeds = [
	...new Set(
		String(input['Seed keywords'] || '')
			.split(/[\n,;]+/)
			.map((s) => s.trim().toLowerCase())
			.filter(Boolean),
	),
].slice(0, 20);

if (!seeds.length) {
	throw new Error('Enter at least one seed keyword (one per line or comma separated).');
}

const domain = String(input['Website domain'] || input.SITE_DOMAIN || '')
	.trim()
	.toLowerCase()
	.replace(/^https?:\/\//, '')
	.replace(/^www\./, '')
	.replace(/\/.*$/, '');

const toNumber = (value, fallback) => {
	const n = Number(value);
	return Number.isFinite(n) && String(value).trim() !== '' ? n : fallback;
};

const settings = {
	seeds,
	domain,
	location_name: input['Country'] || input.DEFAULT_COUNTRY || 'Netherlands',
	language_name: input['Language'] || input.DEFAULT_LANGUAGE || 'Dutch',
	max_kd: toNumber(input['Max keyword difficulty (0-100)'], 30),
	min_volume: toNumber(input['Min monthly searches'], 20),
	serp_checks: Math.min(toNumber(input['Keywords to check in Google'], 10), 30),
	business: input['What do you sell and to whom?'] || input.BUSINESS_DESCRIPTION || '',
	competitors: String(input['Known competitors (optional)'] || '')
		.split(/[\n,;]+/)
		.map((s) => s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''))
		.filter(Boolean),
	claude_model: input.CLAUDE_MODEL,
	sheet_id: input.SHEET_ID,
	researched_at: new Date().toISOString(),
};

return seeds.map((seed) => ({ json: { seed, ...settings } }));
