import { apiBase } from '$lib/util/globals.js'
import { error } from '@sveltejs/kit'
import { isBlank } from 'txstate-utils'

/** @type {import('./$types').PageLoad} */
export async function load ({ fetch, url, depends }) {
  const query = (url.searchParams.get('q') ?? undefined)?.trim()
  const reloadHandle: string = `results:search:${query}`
  depends(reloadHandle)
  // TODO: Get rid of the below split and just pass the query as q to the api.
  const result = await (await fetch(`${apiBase}/results?q=${query}`))?.json()
  if (result) return { query, results: result.matches, total: result.total, reloadHandle }
  return { query, results: undefined, total: 0, reloadHandle }
}
