import { Result } from '$lib/models/result.js'
import { error, json } from '@sveltejs/kit'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, locals }) {
  if (!locals.isEditor) throw error(403)
  const query = (url.searchParams.get('q') ?? undefined)?.trim()
  /* Need to defined a matching function for query to select Results.
     Should tags found in query match?
     Should mode found in query match?
     Should priority found in query match?
     Should we have an advanced syntax for matching so we can ask things like:
      hits > 10
      broken since 2021-01-01
      broken after 2021-01-01
      priority > 50
    Should url path be found in query match?
    Should Title be found in query match?
  */
  const ret = (await Result.getAllWithQueries()).map(result => { return result.fullWithCount() })
  return json(ret)
}
