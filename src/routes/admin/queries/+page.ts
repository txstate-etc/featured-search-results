import { apiBase } from '$lib/util/globals.js'
import { isBlank } from 'txstate-utils'

/** @type {import('./$types').PageLoad} */
export async function load ({ fetch, url }) {
  const query = (url.searchParams.get('q') ?? undefined)?.trim()
  if (isBlank(query)) return undefined
  const resp = await (await fetch(`${apiBase}/queries?q=${query}`))?.json()
  if (resp) return { query, results: resp }
  return { query, results: undefined }
  /* TODO:
     We need to update the queries api and model to accept a filtering query for matching
     and then replace the above with the commented out code below.

  const query = (url.searchParams.get('q') ?? '').trim()
  if (isBlank(query)) return undefined
  console.log('app/queries - q:', query) // TODO: Remove-Me
  const resp = await (await fetch(`${apiBase}/queries?q=${query}`))?.json()
  console.log('app/queries - resp:', JSON.stringify(resp)) // TODO: Remove-Me
  if (resp) return { query, results: resp }
  return { query, results: undefined }
  */
}
