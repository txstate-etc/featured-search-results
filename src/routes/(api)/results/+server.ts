import { Result } from '$lib/models/result.js'
import { error, json } from '@sveltejs/kit'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ locals }) {
  if (!locals.isEditor) throw error(403)
  const ret = (await Result.getAllWithQueries()).map(result => { return result.fullWithCount() })
  return json(ret)
}
