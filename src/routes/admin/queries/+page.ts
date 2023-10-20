import { apiBase } from '$lib/util/globals.js'
import { error } from '@sveltejs/kit'
import { isBlank } from 'txstate-utils'

/** @type {import('./$types').PageLoad} */
export async function load ({ url }) {
  /* TODO: We need to update the queries api and model to accept a filtering query for matching.
  const query = (url.searchParams.get('q') ?? undefined)?.trim()
  if (isBlank(query)) return undefined
  console.log('app/queries - q:', query)
  const resp = await fetch(`${apiBase}/queries?q=${query}`) */
  console.log('app/queries - preFetch')
  const resp = await fetch(`${apiBase}/queries`)
  console.log('app/queries - resp:', JSON.stringify(resp)) // TODO: Remove-Me
  if (resp) return await resp.json()
  // throw error(404, { message: query ?? '' })
  throw error(404, { message: 'Not Found' })
}
