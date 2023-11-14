import { apiBase } from '$lib/util/globals.js'
import { error } from '@sveltejs/kit'
import { isBlank } from 'txstate-utils'

/** @type {import('./$types').PageLoad} */
export async function load ({ fetch, url }) {
  const query = (url.searchParams.get('q') ?? undefined)?.trim()
  if (isBlank(query)) return undefined
  const resp = await (await fetch(`${apiBase}/results?q=${query}`))?.json()
  if (resp) return { query, results: resp }
  return { query, results: undefined }
}
