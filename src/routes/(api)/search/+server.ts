import { json } from '@sveltejs/kit'
import { Result, Query } from '$lib/models'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, setHeaders }) {
  const query = url.searchParams.get('q') ?? undefined
  if (!query?.length || query.length < 3 || query.length > 1024) return json([])
  const asyoutype = !!url.searchParams.get('asyoutype')
  const results = await Result.findByQuery(query)
  const ret = results.map(result => result.basic())
  if (!asyoutype) Query.record(query, results)
  return json(ret)
}
