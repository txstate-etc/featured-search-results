import { error, json } from '@sveltejs/kit'
import type { TemplateResult } from '$lib/models/result.js'
import { apiBase } from '$lib/util/globals.js'

/** @type {import('./$types').PageLoad} */
export async function load ({ fetch, params }) {
  const resp = await (await fetch(`${apiBase}/result/${params.id}`))?.json()
  if (resp) return resp.result
  throw error(404, 'Not Found')
}
