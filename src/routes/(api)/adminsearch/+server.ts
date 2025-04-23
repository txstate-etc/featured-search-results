import { Result } from '$lib/models/result.js'
import { error, json } from '@sveltejs/kit'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, locals }) {
  if (!locals.isEditor) throw error(403)
  const query = url.searchParams.get('q') ?? undefined
  if (!query?.length || query.length > 1024) return json([])
  const results = await Result.findByQuery(query)
  const ret = results.map(result => result.basicPlusId())
  return json(ret)
}
