import { json } from '@sveltejs/kit'
import { Result } from '$lib/models/result.js'
import { Query } from '$lib/models/query.js'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, setHeaders }) {
  const query = (url.searchParams.get('q') as string) ?? undefined
  if (!query?.length || query.length > 1024) return json([])
  const asyoutype = !!url.searchParams.get('asyoutype')
  // We don't want to flood the api with `asyoutype` requests, so limit by lower length if such.
  if (asyoutype && query.length < 3) return json([])
  /* I think we should make `asyoutype` a number parameter that indicates which word in query
     is the selection word in the input being typed to. We could then update `findByQuery`'s
     call stack to match with the corresponding word in query being the one that gets the `startsWith()`
     evaluation on matching. We could default to current behavior if there are no words to correspond
     with the number or a non-numeric value is passed. */
  const results = await Result.findByQuery(query)
  const ret = results.map(result => result.basic())
  if (!asyoutype) Query.record(query, results)
  return json(ret)
}
