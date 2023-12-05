import { Result, type ResultDocument } from '$lib/models/result.js'
import { DEFAULT_PAGINATION_SIZE } from '$lib/util/globals.js'
import { getMatchClause, getResultsDef } from '$lib/util/helpers.js'
import { error, json } from '@sveltejs/kit'
import { isBlank, isNotBlank } from 'txstate-utils'

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
const pagesize = DEFAULT_PAGINATION_SIZE
const resultDef = getResultsDef()

export interface SearchResponse {
  query: string
  count: number
  lastpage: number
  results: any[]
}

const filterRegex = /^\s*{/m
const emptyRegex = /^\s*{\s*}/m

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, locals }) {
  if (!locals.isEditor) throw error(403)
  const q = url.searchParams.get('q') ?? '{}'
  const sort = url.searchParams.get('sort') ?? undefined
  let n: string | null | number = url.searchParams.get('n')
  let p: string | null | number = url.searchParams.get('p')
  if (isNotBlank(n)) n = (parseInt(n) > 0) ? parseInt(n) : DEFAULT_PAGINATION_SIZE // Normalize the n results returned/page.
  if (isNotBlank(p)) p = (parseInt(p) > 0) ? parseInt(p) : 1 // Normalize the p page number requested. default = 1
  const response: SearchResponse = { query: q, count: 0, lastpage: 1, results: [] as any[] }

  const parsedQuery = JSON.parse(q)
  if (isBlank(q) || emptyRegex.test(q) || emptyRegex.test(parsedQuery)) return json(response) // Handle empty request.

  let matches: ResultDocument[] = []
  if (filterRegex.test(parsedQuery)) {
    console.log('(api)/advanced/results - Searching with parsedQuery: ', parsedQuery)
    matches = await Result.find((parsedQuery)).populate('queries')
  } else {
    // response.query = (await Result.findAdvanced(q, sort, n!, p!) as unknown as { mql: string }).mql
    response.query = getMatchClause(resultDef, q).mql
    console.log('(api)/advanced/results - query: ', response.query)
    // matches = await Result.find(JSON.parse(response.query)).populate('queries')
  }
  // const matches = (await Result.findAdvanced(params.search, sort, n, p)).map(result => { return result.fullWithCount() })
  // const matches = (await Result.find(filter) as ResultDocumentWithQueries[]).map(result => { return result.fullWithCount() })
  console.log('(api)/advanced/results - matches: ', matches)
  response.results = matches
  console.log('(api)/advanced/results - response: ', response)
  return json(response)
}
