import { Result } from '$lib/models'
import { error, json } from '@sveltejs/kit'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, locals }) {
  if (!locals.isEditor) throw error(401)
  const ret = (await Result.getAllWithQueries()).map(result => { return result.fullWithCount() })
  return json(ret)
}
