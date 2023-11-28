import { apiBase } from '$lib/util/globals.js'
import { error } from '@sveltejs/kit'
import { isBlank } from 'txstate-utils'

/** @type {import('./$types').PageLoad} */
export async function load ({ fetch, url }) {
  const query = (url.searchParams.get('q') ?? undefined)?.trim()
  const search = isBlank(query) ? JSON.stringify({}) : JSON.stringify(query)
  const matches = await (await fetch(`${apiBase}/advanced/results?q=${search}&sort=title&n=0&p=1`))?.json()
  if (matches) return { query, results: matches }
  return { query, results: undefined }
}
