import { json } from '@sveltejs/kit'
import { Result } from '$lib/models/result.js'
import { Query } from '$lib/models/query.js'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, setHeaders }) {
  const query = url.searchParams.get('q') ?? undefined
  if (!query?.length || query.length < 3 || query.length > 1024) return json([])
  const asyoutype = !!url.searchParams.get('asyoutype')
  /* I think we should make `asyoutype` a number parameter that indicates which word in query
     is the selection word in the input being typed to. We could then update `findByQueryCompletion`'s
     call stack to match with the corresponding word in query being the one that gets the `startsWith()`
     evaluation on matching. */
  const results = (asyoutype) ? await Result.findByQueryCompletion(query) : await Result.findByQuery(query)
  const ret = results.map(result => result.basic())
  if (!asyoutype) Query.record(query, results)
  return json(ret)
}
