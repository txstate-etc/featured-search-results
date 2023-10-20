import { apiBase } from '$lib/util/globals.js'
import { error } from '@sveltejs/kit'
import { isBlank } from 'txstate-utils'

/** @type {import('./$types').PageLoad} */
export async function load ({ url }) {
  console.log('app/queries - preFetch') // TODO: Remove-Me
  const resp = await (await fetch(`${apiBase}/queries`))?.json()
  console.log('app/queries - resp:', JSON.stringify(resp)) // TODO: Remove-Me
  if (resp) return resp
  throw error(404, { message: 'Not Found' })
  /* TODO: We need to update the queries api and model to accept a filtering query for matching
     and then replace the above with the commented out code below.

  const query = (url.searchParams.get('q') ?? '').trim()
  if (isBlank(query)) return undefined
  console.log('app/queries - q:', query) // TODO: Remove-Me
  const resp = await (await fetch(`${apiBase}/queries?q=${query}`))?.json()
  console.log('app/queries - resp:', JSON.stringify(resp)) // TODO: Remove-Me
  if (resp) return { query, results: resp }
  throw error(404, { message: query ?? '' })

  */
}
