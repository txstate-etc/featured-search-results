import { error } from '@sveltejs/kit'
import { apiBase } from '$lib/util/globals.js'

/** @type {import('./$types').PageLoad} */
export async function load ({ fetch, params }) {
  const result = await (await fetch(`${apiBase}/result/${params.id}`))?.json()
  if (result) return { result: result.result }
  throw error(404, 'Not Found')
}
