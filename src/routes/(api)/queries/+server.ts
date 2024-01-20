import { Query } from '$lib/models/query.js'
import { DEFAULT_PAGINATION_SIZE } from '$lib/util/globals.js'
import { getPagingParams, type AdvancedSearchResult } from '$lib/util/helpers.js'
import { error, json } from '@sveltejs/kit'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, locals }) {
  if (!locals.isEditor) throw error(403)
  const search = url.searchParams.get('q') ?? ''
  const pagination = getPagingParams(url.searchParams, DEFAULT_PAGINATION_SIZE)
  const result: AdvancedSearchResult = await Query.searchAllQueries(search, pagination)
  return json(result)
}
