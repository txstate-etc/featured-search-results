import { Result, type ResultDocument } from '$lib/models/result.js'
import { type AdvancedSearchResult, getPagingParams } from '$lib/util/helpers.js'
import { error, json } from '@sveltejs/kit'
import { isBlank } from 'txstate-utils'

/* Need to defined a matching function for query to select Results.
    Should tags found in query match?
    Should mode found in query match?
    Should document level priority found in query match?
    Should url found in query match? Whole URL or partial/path?
    Should title found in query match? Whole or partial?
    Should we have an advanced syntax for matching so we can ask things like:
      hits > 10
      broken since 2021-01-01
      broken after 2021-01-01
      priority >= 50 */

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, locals }) {
  if (!locals.isEditor) throw error(403)
  // Would need to replace params.sort below with our actual search which we'd get from url.searchParams.get('q')
  // const results = await Result.find() as ResultDocument[]
  // const matches = results.filter(r => resultFilter(params.search, r)).map(result => result.full())
  const query = url.searchParams.get('q') ?? undefined
  const pagination = getPagingParams(url.searchParams)

  if (!query || isBlank(query)) {
    // TODO: Add pagination passing/handling to find(), or just call the below with an empty query - might need to modify to do so, haven't tested.
    const matches = await Result.find() as ResultDocument[]
    const result: AdvancedSearchResult = {
      matches: matches.map(result => result.full()),
      total: matches.length,
      search: '',
      pagination,
      meta: undefined
    }
    return json(result)
  }

  const result = await Result.searchAllResults(query, pagination)
  return json(result)
}
