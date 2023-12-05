import { Result, type ResultDocument } from '$lib/models/result.js'
import { error, json } from '@sveltejs/kit'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ locals }) {
  if (!locals.isEditor) throw error(403)
  const results = await Result.find() as ResultDocument[]
  const ret = results.map(result => result.full())
  return json(ret)
}
