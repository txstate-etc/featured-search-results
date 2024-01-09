import { Query, type QueryDocument } from '$lib/models/query.js'
import { error, json } from '@sveltejs/kit'
import { isBlank } from 'txstate-utils'

function resultFilter (search: string, query: QueryDocument): boolean {
  /* TODO: Move filtering to the model and add an advanced search option. */
  const searchRegex = new RegExp(search, 'i')
  for (const word of query.query.split(' ')) {
    if (searchRegex.test(word)) return true
  }
  return false
}


/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, params, locals }) {
  if (!locals.isEditor) throw error(403)
  const query = url.searchParams.get('q') ?? undefined
  const page = url.searchParams.get('p') ?? undefined
  const size = url.searchParams.get('n') ?? undefined
  const sorts = url.searchParams.get('s') ?? undefined

  if (!query || isBlank(query)) {
    const results = (await Query.getAllQueries()).map((query) => query.basic())
    return json({ matches: results, total: results.length })
  }

  const result = await Query.searchAllQueries(query)
  return json({ matches: result.matches, total: result.total })
  // const matches = (await Query.getAllQueries()).filter(q => resultFilter(query, q)).map((query) => query.basic())
  // return json({ matches, total: matches.length })
}
