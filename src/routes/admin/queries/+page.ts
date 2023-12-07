import { apiBase } from '$lib/util/globals.js'
import { isBlank } from 'txstate-utils'

/** @type {import('./$types').PageLoad} */
export async function load ({ fetch, url, depends }) {
  const query = (url.searchParams.get('q') ?? '').trim()
  const reloadHandle: string = `queries:search:${query}`
  depends(reloadHandle)
  const matches = isBlank(query)
    ? await (await fetch(`${apiBase}/queries`))?.json()
    : await (await fetch(`${apiBase}/queries/${query}`))?.json()
  if (matches) return { query, results: matches, reloadHandle }
  return { query, results: undefined, reloadHandle }
}
