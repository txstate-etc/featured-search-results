import { Result, type RawJsonResult, type ResultDocument, type TemplateResult } from '$lib/models/result.js'
import { error, json } from '@sveltejs/kit'
import { ValidationChecks, idFromUrl } from '$lib/util'
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

  const body: RawJsonResult | TemplateResult = await request.json()
  if (!body) throw error(400, 'PUT body was not parseable JSON.')

  const id = idFromUrl(url)
  const result = await Result.findById(id) as ResultDocument | undefined
  messages.push(...ValidationChecks.isTrue(!result, 404, 'That result id does not exist.', 'id', isValidation))
  // Above would have thrown error if not `isValidation`. Can't proceed if nothing was found - return messages.
  if (!result) return json({ messages })

  result.fromPartialJson(body)
  messages.push(...result.valid())
  if (!isValidation) {
    if (messages.length === 0) {
      await result.save()
      return json(result.full())
    }
    console.table(messages) // TODO: Remove this server side table print of the messages.
    // Perserve our non-validating API contract with callers.
    throw error(400, 'Result did not validate.')
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
