import { Result, type ResultDocument } from '$lib/models/result.js'

/** @type {import('./$types').RequestHandler} */
export async function GET () {
  const results = await Result.find() as ResultDocument[]
  const output = `${
    results.map(r => `<a href="${r.url}">${r.entries.map(e => e.keywords.join(' ')).join(', ')}</a>`).join('<br>')
  }`
  return new Response(output, { headers: { 'Content-Type': 'text/html' } })
}
