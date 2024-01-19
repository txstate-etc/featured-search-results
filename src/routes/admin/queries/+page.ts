import { apiBase } from '$lib/util/globals.js'
import { getPagingParams, stringifyPagingParams, type AdvancedSearchResult } from '$lib/util/helpers.js'

/** @type {import('./$types').PageLoad} */
export async function load ({ fetch, url, depends }) {
  const search = (url.searchParams.get('q') ?? '').trim().toLowerCase()
  const pagination = getPagingParams(url.searchParams)
  const reloadHandle: string = `queries:search:${search}`
  depends(reloadHandle)
  const result: AdvancedSearchResult = await (await fetch(`${apiBase}/queries?q=${search}${stringifyPagingParams(pagination)}`))?.json()
  if (result) return { ...result, reloadHandle }
  return { matches: [], total: 0, search, pagination, meta: undefined, reloadHandle }
}
