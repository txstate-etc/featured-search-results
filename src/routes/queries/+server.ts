import { Query } from '$lib/models'
import { error, json } from '@sveltejs/kit'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, locals }) {
  if (!locals.isEditor) throw error(401)
  const ret = (await Query.getAllQueries()).map((query) => query.basic())
  return json(ret)
}
