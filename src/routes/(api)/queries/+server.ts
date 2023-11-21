import { Query } from '$lib/models/query.js'
import { error, json } from '@sveltejs/kit'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ locals }) {
  if (!locals.isEditor) throw error(403)
  const ret = (await Query.getAllQueries()).map(query => query.basic())
  return json(ret)
}
