import type { ResultDocument } from '$lib/models/result.js'
import { apiBase, type SearchResponse } from '$lib/util/globals.js'
import { isBlank } from 'txstate-utils'

/** @type {import('./$types').PageLoad} */
export async function load ({ fetch, url }) {
  const query = (url.searchParams.get('q') ?? undefined)?.trim()
  const search = isBlank(query) ? JSON.stringify({}) : JSON.stringify(query)
  const matches: SearchResponse<ResultDocument> = await (
    await fetch(`${apiBase}/advanced/results?q=${search}&sort=title&n=0&p=1`)
  )?.json()
  if (matches) {
    return {
      query,
      results: matches.results,
      count: matches.count,
      lastpage: matches.lastpage,
      transform: matches.query
    }
  }
  return {
    query,
    results: undefined,
    count: 0,
    lastpage: 1,
    transform: undefined
  }
}
