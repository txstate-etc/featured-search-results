import { apiBase } from '$lib/util/globals.js'
import { error } from '@sveltejs/kit'
import { isBlank } from 'txstate-utils'

/** @type {import('./$types').PageLoad} */
export async function load ({ fetch, url, depends }) {
  const query = (url.searchParams.get('q') ?? undefined)?.trim()
  const reloadHandle: string = `results:search:${query}`
  depends(reloadHandle)
  const matches = isBlank(query)
    ? await (await fetch(`${apiBase}/results`))?.json()
    : await (await fetch(`${apiBase}/results/${query}`))?.json()
  if (matches) return { query, results: matches, reloadHandle }
  return { query, results: undefined, reloadHandle }
}
