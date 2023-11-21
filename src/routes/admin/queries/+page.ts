import { apiBase } from '$lib/util/globals.js'
import { isBlank } from 'txstate-utils'

/** @type {import('./$types').PageLoad} */
export async function load ({ fetch, url }) {
  const query = (url.searchParams.get('q') ?? '').trim()
  const matches = isBlank(query)
    ? await (await fetch(`${apiBase}/queries`))?.json()
    : await (await fetch(`${apiBase}/queries/${query}`))?.json()
  if (matches) return { query, results: matches }
  return { query, results: undefined }
}
