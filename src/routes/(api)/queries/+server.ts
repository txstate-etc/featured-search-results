import { Query } from '$lib/models/query.js'
import { getPagingParams } from '$lib/util/helpers.js'
import { error, json } from '@sveltejs/kit'
import { isBlank } from 'txstate-utils'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, locals }) {
  if (!locals.isEditor) throw error(403)
  const query = url.searchParams.get('q') ?? undefined
  const pagination = getPagingParams(url.searchParams)

  if (!query || isBlank(query)) {
    // TODO: Add pagination passing/handling to getAllQueries(), or just call the below with an empty query - might need to modify to do so, haven't tested.
    const results = (await Query.getAllQueries()).map((query) => query.basic())
    return json({ matches: results, total: results.length, search: '', pagination, meta: undefined })
  }

  const result = await Query.searchAllQueries(query, pagination)
  return json(result)
}
