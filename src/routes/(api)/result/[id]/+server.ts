import { Result, type RawJsonResult, type ResultDocument, type TemplateResult } from '$lib/models/result.js'
import { error, json } from '@sveltejs/kit'
import { ValidationChecks, idFromUrl } from '$lib/util'
import type { Feedback } from '@txstate-mws/svelte-forms'
import { VALIDATE_ONLY } from '$lib/util/globals.js'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, locals }) {
  if (!locals.isEditor) throw error(403)
  const id = idFromUrl(url)
  const result = await Result.getWithQueries(id!)
  return json(result.full())
}

/** @type {import('./$types').RequestHandler} */
export async function PUT ({ url, request, locals }) {
  if (!locals.isEditor) throw error(403)
  const body: RawJsonResult | TemplateResult = await request.json()
  if (!body) throw error(400, 'PUT body was not parseable JSON.')

  const isValidation = url.searchParams.has(VALIDATE_ONLY)
  const messages: Feedback[] = []
  const id = idFromUrl(url)
  const result = await Result.findById(id) as ResultDocument | undefined
  messages.push(...ValidationChecks.isTrue(!result, 404, `Result ${id} does not exist.`, 'id', isValidation))
  if (!result) return json({ messages })

  result.fromPartialJson(body)
  messages.push(...result.valid())
  if (!isValidation) {
    if (messages.length === 0) {
      await result.save()
      return json(result.full())
    }
    // Perserve our non-feedback API contract with existing clients.
    throw error(400, 'Result did not validate.')
  } else if (messages.length > 0) console.table(messages) // TODO: Remove this server side table print of the messages.
  return json({ result: result.full(), messages })
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE ({ url, request, locals }) {
  if (!locals.isEditor) throw error(403)
  const id = idFromUrl(url)
  await Result.findByIdAndRemove(id)
  return json({ ok: true })
}
