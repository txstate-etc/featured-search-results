import { error } from '@sveltejs/kit';

/** @type {import('./$types').PageLoad} */
export function load({ params }) {
	// Fetch `ResultSchema` record using (api)/result/[id]/GET
	if (params.id === 'hello-world') {
		return {}
	}
	throw error(404, 'Not found');
}
