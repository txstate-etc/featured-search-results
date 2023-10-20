import { apiBase } from '$lib/util/globals.js'
import { error } from '@sveltejs/kit'
import { isBlank } from 'txstate-utils'

/** @type {import('./$types').PageLoad} */
export async function load ({ url }) {
  const query = (url.searchParams.get('q') ?? undefined)?.trim()
  if (isBlank(query)) return undefined
  console.log('app/results - q:', query) // TODO: Remove-me
  const resp = await fetch(`${apiBase}/adminsearch?q=${query}`)
  console.log('app/results - resp:', JSON.stringify(resp)) // TODO: Remove-me
  if (resp) return await resp.json()
  throw error(404, { message: query ?? '' })
}
