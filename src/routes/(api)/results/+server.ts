import { Result, type ResultDocument } from '$lib/models/result.js'
import { getMongoStages, getResultsDef } from '$lib/util/helpers.js'
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

function resultFilter (search: string, result: ResultDocument): boolean {
  /* TODO: Move filtering to the model and add an advanced search option. */
  const searchRegex = new RegExp(search, 'i')
  if (searchRegex.test(result.title)) return true
  if (result.tags) { for (const tag of result.tags) { if (searchRegex.test(tag)) return true } }
  if (result.entries) {
    for (const entry of result.entries) {
      if (searchRegex.test(entry.mode) || searchRegex.test(entry.priority.toString())) return true
      for (const word of entry.keywords) {
        if (searchRegex.test(word)) return true
      }
    }
  }
  const parsedURL = new URL(result.url)
  for (const part of parsedURL.pathname.split('/')) {
    if (isNotBlank(part) && searchRegex.test(part.trim())) return true
  }
  for (const part of parsedURL.hostname.split('.')) {
    if (isNotBlank(part) && searchRegex.test(part.trim())) return true
  }
  return false
}

const resultsDef = getResultsDef()

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, params, locals }) {
  if (!locals.isEditor) throw error(403)
  // Would need to replace params.sort below with our actual search which we'd get from url.searchParams.get('q')
  // const results = await Result.find() as ResultDocument[]
  // const matches = results.filter(r => resultFilter(params.search, r)).map(result => result.full())
  const query = url.searchParams.get('q') ?? undefined
  const page = url.searchParams.get('p') ?? undefined
  const size = url.searchParams.get('n') ?? undefined
  const sorts = url.searchParams.get('s') ?? undefined

  if (!query || isBlank(query)) {
    const results = await Result.find() as ResultDocument[]
    const ret = results.map(result => result.full())
    return json({ matches: ret, total: results.length })
  }

  const searchStages = getMongoStages(resultsDef, query, sorts ? JSON.parse(sorts) : [])
  if (size) searchStages.push({ $limit: Number(size) })
  if (page) {
    const skip = Number(page) * (Number(size) ?? 0)
    searchStages.push({ $skip: skip })
  }
  console.log(JSON.stringify(searchStages))
  const matches = (await Result.aggregate<{ docs: ResultDocument[], totalMatches: number }>(searchStages))[0] as unknown as { docs: ResultDocument[], totalMatches: number }
  return json({ matches: matches.docs.map(result => Result.castAggResult(result).full()), total: matches.totalMatches })
}
