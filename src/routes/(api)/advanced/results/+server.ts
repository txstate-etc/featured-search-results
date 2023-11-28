import { Result, type ResultDocument, type ResultDocumentWithQueries } from '$lib/models/result.js'
import { DEFAULT_PAGINATION_SIZE } from '$lib/util/globals.js'
import { error, json } from '@sveltejs/kit'

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
const pagesize = DEFAULT_PAGINATION_SIZE.toString()

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, params, locals }) {
  if (!locals.isEditor) throw error(403)
  const q = url.searchParams.get('q') ?? '{}'
  // let n = parseInt(url.searchParams.get('n') ?? pagesize, 10)
  // let p = parseInt(url.searchParams.get('p') ?? '0', 10)
  const sort = url.searchParams.get('sort') ?? undefined
  const response = { count: 0, lastpage: 1, results: [] as any[] }
  /*
  if (!params.search) return json(response) // Handle empty request.
  n = (n > 0) ? n : DEFAULT_PAGINATION_SIZE // Normalize the n results returned/page.
  p = (p > 0) ? p : 1 // Normalize the p page number requested. default = 1
  const matches = (await Result.findAdvanced(params.search, sort, n, p)).map(result => { return result.fullWithCount() })
  */
  console.log('as-is: ', q)
  console.log('parsed: ', JSON.parse(q))
  if (q === undefined || q === '{}') return json(response) // Handle empty request.
  const filter = q ? JSON.parse(q) : {}
  // const matches = (await Result.find(filter) as ResultDocumentWithQueries[]).map(result => { return result.fullWithCount() })
  const matches = await Result.find(filter)
  console.log('matches: ', matches)
  return json(matches)
}
