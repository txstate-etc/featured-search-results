import { Result } from '$lib/models/result.js'
import { DEFAULT_PAGINATION_SIZE } from '$lib/util/globals.js'
import { type AdvancedSearchResult, getPagingParams } from '$lib/util/helpers.js'
import { error, json } from '@sveltejs/kit'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, locals }) {
  if (!locals.isEditor) throw error(403)
  const search = url.searchParams.get('q') ?? ''
  const pagination = getPagingParams(url.searchParams, DEFAULT_PAGINATION_SIZE)
  const result: AdvancedSearchResult = await Result.searchAllResults(search, pagination)
  return json(result)
}
