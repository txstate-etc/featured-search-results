import { Result, type RawJsonResult, type ResultDocument, type TemplateResult } from '$lib/models/result.js'
import { error, json } from '@sveltejs/kit'
import { MessageType, type Feedback } from '@txstate-mws/svelte-forms'
import { VALIDATE_ONLY } from '$lib/util/globals.js'
import { isBlank } from 'txstate-utils'

/** Returns the associcated `Feedback MessageType` from common HTML status codes and ranges. */
function statusToMessageType (status: number) {
  if (status === 200) return MessageType.SUCCESS
  if ([401, 403, 404].includes(status)) return MessageType.SYSTEM
  if (status > 200 && status < 300) return MessageType.WARNING
  return MessageType.ERROR
}

/** A set of common checks that handle the difference between validation only checks and
 * full blown throw an error checks. If they're not `validationOnly` then errors will be
 * thrown before a value can be returned. If they ARE `validationOnly` then an array of
 * Feedback messages will be returned, or an empty array if the check passed.
 * Usefull for making sure our checks are consistent - where these are used - and for
 * reducing code clutter where we optionally want to throw errors or return feedback.
 * @note Mongoose should be centralizing our document properties validation and formatting.
 * Hence these checks are more for whether the API was provided everything it needs to
 * interact with Mongoose. */
const ValidationChecks = {
  ifFails: (condition: boolean, status: number, message: string, path: string, validationOnly: boolean = false) => {
    if (!condition) {
      if (!validationOnly) throw error(status, { message })
      const type = statusToMessageType(status)
      return [{ type, path, message }]
    } return []
  },
  /** Careful with isEditor. If `validationOnly` this will return a message but not throw 403.
   * It's up to the caller to inspect returned messages and throw 403 if Not Authorized. */
  isEditor: (verified: boolean, validationOnly: boolean = false) => {
    return ValidationChecks.ifFails(verified, 403, 'Not Authorized', '', validationOnly)
  },
  isBlank: (param: any, name: string, validationOnly: boolean = false) => {
    return ValidationChecks.ifFails(!isBlank(param[name]), 400, `Posted request must contain a non-empty ${name}.`, name, validationOnly)
  }
}

/** @type {import('./$types').RequestHandler} */
export async function GET ({ params, locals }) {
  if (!locals.isEditor) throw error(403)
  const result = await Result.findById(params.id)
  if (!result) throw error(404)
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
  await Result.findByIdAndDelete(params.id)
  return json({ ok: true })
}
