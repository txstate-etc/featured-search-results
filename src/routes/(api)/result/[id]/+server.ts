import { Result, type ResultDocument } from '$lib/models'
import { error, json } from '@sveltejs/kit'
import { idFromUrl } from '$lib/util'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, locals }) {
  if (!locals.isEditor) throw error(401)
  const id = idFromUrl(url)
  const result = await Result.getWithQueries(id)
  return json(result.full())
}

/** @type {import('./$types').RequestHandler} */
export async function PUT ({ url, request, locals }) {
  if (!locals.isEditor) throw error(401)
  const body = await request.json()
  if (!body) throw error(400, { message: 'POST body was not parseable JSON.' })
  const id = idFromUrl(url)
  const result = await Result.findById(id) as ResultDocument | undefined
  if (!result) throw error(404, { message: 'That result id does not exist.' })
  result.fromJson(body)
  if (!result.valid()) throw error(400, { message: 'Result did not validate.' })
  await result.save()
  return json(result.full())
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE ({ url, request, locals }) {
  if (!locals.isEditor) throw error(401)
  const id = idFromUrl(url)
  await Result.findByIdAndRemove(id)
  return json({ ok: true })
}
