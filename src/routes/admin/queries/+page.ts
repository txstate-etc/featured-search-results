import { apiBase } from '$lib/util/globals.js'

/** @type {import('./$types').PageLoad} */
export async function load ({ fetch, url, depends }) {
  const query = (url.searchParams.get('q') ?? '').trim()
  const reloadHandle: string = `queries:search:${query}`
  depends(reloadHandle)
  const result = await (await fetch(`${apiBase}/queries?q=${query}`))?.json()
  if (result) return { query, results: result.matches, total: result.total, reloadHandle }
  return { query, results: undefined, reloadHandle }
}
