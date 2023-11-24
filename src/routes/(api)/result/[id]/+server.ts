import { Result, type RawJsonResult, type ResultDocument, type TemplateResult } from '$lib/models/result.js'
import { error, json } from '@sveltejs/kit'
import { ValidationChecks } from '$lib/util'
import type { Feedback } from '@txstate-mws/svelte-forms'
import { VALIDATE_ONLY } from '$lib/util/globals.js'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ params, locals }) {
  if (!locals.isEditor) throw error(403)
  const result = await Result.findById(params.id)
  return json({ result: result.full(), messages: [] })
}

/** @type {import('./$types').RequestHandler} */
export async function PUT ({ params, url, request, locals }) {
  if (!locals.isEditor) throw error(403)
  const body: RawJsonResult | TemplateResult = await request.json()
  if (!body) throw error(400, 'PUT body was not parseable JSON.')

  const isValidation = url.searchParams.has(VALIDATE_ONLY)
  const messages: Feedback[] = []
  const result = await Result.findById(params.id) as ResultDocument | undefined
  messages.push(...ValidationChecks.ifFails(!!result, 404, `Result ${params.id} does not exist.`, 'id', isValidation))
  if (!result) return json({ result: undefined, messages })

  result.fromPartialJson(body)
  messages.push(...result.valid())
  if (!isValidation) {
    if (messages.length === 0) {
      await result.save()
      return json({ result: result.full(), messages })
    }
  }
  return json({ result: result.full(), messages })
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE ({ params, locals }) {
  if (!locals.isEditor) throw error(403)
  await Result.findByIdAndRemove(params.id)
  return json({ ok: true })
}
