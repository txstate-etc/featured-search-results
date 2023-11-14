import { Result, type ResultDocument } from '$lib/models/result.js'
import { error, json } from '@sveltejs/kit'
import { ValidationChecks, idFromUrl, paramFromUrl } from '$lib/util'
import type { Feedback } from '@txstate-mws/svelte-forms'
import { VALIDATE_ONLY } from '$lib/util/globals.js'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, locals }) {
  if (!locals.isEditor) throw error(401)
  const id = idFromUrl(url)
  const result = await Result.getWithQueries(id!)
  return json(result.full())
}

/** @type {import('./$types').RequestHandler} */
export async function PUT ({ url, request, locals }) {
  const isValidation = url.searchParams.has(VALIDATE_ONLY)
  const messages: Feedback[] = []
  messages.push(...ValidationChecks.isEditor(!!locals.isEditor, isValidation))

  const body = await request.json()
  if (!body) throw error(400, { message: 'PUT body was not parseable JSON.' })

  const id = idFromUrl(url)
  const result = await Result.findById(id) as ResultDocument | undefined
  messages.push(...ValidationChecks.isTrue(!result, 404, 'That result id does not exist.', isValidation))
  // Above would have thrown error if not just validating. Go ahead and return messages if no result.
  if (!result) return json({ messages })

  result.fromJson(body)
  // I need to replace the following check with separate validation checks for each field if not handled elsewhere.
  messages.push(...(await result.valid()))
  if (!isValidation) {
    await result.save()
    return json(result.full())
  }
  return json({ result: result.full(), messages })
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE ({ url, request, locals }) {
  if (!locals.isEditor) throw error(401)
  const id = idFromUrl(url)
  await Result.findByIdAndRemove(id)
  return json({ ok: true })
}
