import { Query, type QueryDocument } from '$lib/models/query.js'
import { error, json } from '@sveltejs/kit'

function resultFilter (search: string, query: QueryDocument): boolean {
  for (const word of query.query.split(' ')) {
    if (search.includes(word)) return true
  }
  return false
}

/** @type {import('./$types').RequestHandler} */
export async function GET ({ params, locals }) {
  if (!locals.isEditor) throw error(403)
  const matches = (await Query.getAllQueries()).filter(q => resultFilter(params.search, q)).map((query) => query.basic())
  return json(matches)
}
