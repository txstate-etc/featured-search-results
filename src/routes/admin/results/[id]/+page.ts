import { error } from '@sveltejs/kit'
import type { TemplateResult } from '$lib/models/result.js'
import { apiBase } from '$lib/util/globals.js'

/** @type {import('./$types').PageLoad} */
export async function load ({ params }) {
  console.log('results/[id] - params:', JSON.stringify(params))
  const resp = await fetch(`${apiBase}/result?id=${params.id}`)
  console.log('results/[id] - resp:', JSON.stringify(resp))
  if (resp) return await resp.json() as TemplateResult
  throw error(404, 'Not Found')
}
