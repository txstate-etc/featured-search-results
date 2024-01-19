import { Query } from '$lib/models/query.js'
import { getPagingParams, type AdvancedSearchResult } from '$lib/util/helpers.js'
import { error, json } from '@sveltejs/kit'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, locals }) {
  if (!locals.isEditor) throw error(403)
  const search = url.searchParams.get('q') ?? ''
  const pagination = getPagingParams(url.searchParams)
  const result: AdvancedSearchResult = await Query.searchAllQueries(search, pagination)
  return json(result)
}
