import { apiBase } from '$lib/util/globals.js'
import { error } from '@sveltejs/kit'
import { isBlank } from 'txstate-utils'

/** @type {import('./$types').PageLoad} */
export async function load ({ fetch, url }) {
  const query = (url.searchParams.get('q') ?? undefined)?.trim()
  // if (isBlank(query)) return undefined
  const matches = isBlank(query)
    ? await (await fetch(`${apiBase}/results`))?.json()
    : await (await fetch(`${apiBase}/results/${query}`))?.json()
  if (matches) return { query, results: matches }
  return { query, results: undefined }
}
