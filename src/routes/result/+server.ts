import { error, json } from '@sveltejs/kit'
import { isBlank } from 'txstate-utils'
import { Result, type ResultDocument } from '$lib/models'

/** @type {import('./$types').RequestHandler} */
export async function POST ({ locals, request }) {
  if (!locals.isEditor) throw error(401)
  const body = await request.json()
  if (!body) throw error(400, { message: 'POST body was not parseable JSON.' })
  if (isBlank(body.url)) throw error(400, { message: 'Posted result must contain a URL.' })

  let result = null
  const newresult = new Result()
  newresult.fromJson(body)
  const oldresult = await Result.findOne({ url: body.url }) as ResultDocument | undefined
  if (oldresult) {
    result = oldresult
    if (!isBlank(newresult.title)) result.title = body.title
    for (const entry of newresult.entries) {
      if (!result.hasEntry(entry)) result.entries.push(entry)
    }
    for (const tag of newresult.tags) {
      if (!result.hasTag(tag)) result.tags.push(tag)
    }
  } else {
    result = newresult
  }
  if (!result.valid()) throw error(400, { message: 'Result did not validate.' })
  await result.save()
  return json(result.full())
}
