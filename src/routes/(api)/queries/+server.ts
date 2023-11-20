import { Query } from '$lib/models/query.js'
import { error, json } from '@sveltejs/kit'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, locals }) {
  if (!locals.isEditor) throw error(403)
  const query = (url.searchParams.get('q') ?? undefined)?.trim()
  const ret = (await Query.getAllQueries()).filter(q => (!query || (query && q.query.includes(query)))).map((query) => query.basic())
  return json(ret)
}
