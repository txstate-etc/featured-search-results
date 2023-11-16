import { error, json } from '@sveltejs/kit'
import { Result, type ResultDocument, type RawJsonResult, type ResultFull, type TemplateResult } from '$lib/models/result.js'
import { ValidationChecks } from '$lib/util/helpers.js'
import type { Feedback } from '@txstate-mws/svelte-forms'
import { VALIDATE_ONLY } from '$lib/util/globals.js'

/** @type {import('./$types').RequestHandler} */
export async function POST ({ url, locals, request }) {
  const isValidation = url.searchParams.has(VALIDATE_ONLY)
  const messages: Feedback[] = []
  messages.push(...ValidationChecks.isEditor(!!locals.isEditor, isValidation))

  const body: RawJsonResult | TemplateResult = await request.json()
  if (!body) throw error(400, 'POST body was not parseable JSON.')

  // ResultSchema validates this as well but we can't proceed without it.
  messages.push(...ValidationChecks.isBlank(body, 'url', isValidation))

  let result = null
  const postedResult = new Result()
  // Getting rid of fromJson's sanitizing of inputs so Mongoose can centralize the validation and formatting for us.
  postedResult.fromPartialJson(body)
  /* We have a potential problem here with the `Result.currencyTest`.
     If we save a Result and the user keeps the response as the state in whatever editor, then step away for about 10 min, by then
     currency test has updated the associated result.id to have a result.url.hostname ending in of 'txst.edu' - if the
     url.hostname that was posted ended with 'txstate.edu' and can be updated to 'txst.edu'. Then the user makes udates and
     submit the form with the response data they previously recieved. Result.findOne won't find the url from our previous response
     so we'll also need to search for the alternatve conversion URL. Alternatively we could update all our urls from the start
     but what happens if we have a servie we're creating a Result for that isn't yet updated to use the new txst.edu domain? */
  let existingResult = await Result.findOne({ url: postedResult.url }) as ResultDocument | undefined
  if (!existingResult && postedResult.url) {
    const parsedUrl = new URL(postedResult.url)
    if (parsedUrl.hostname.endsWith('txstate.edu')) {
      parsedUrl.hostname = parsedUrl.hostname.replace(/txstate\.edu$/, 'txst.edu')
      existingResult = await Result.findOne({ url: parsedUrl.toString() }) as ResultDocument | undefined
    }
  }
  if (existingResult) {
    result = existingResult
    // We're letting mongoose validation check all the things we were checking before so just update to what's
    // coming in and respond with validation results of mongoose.
    result.title = postedResult.title
    result.entries = postedResult.entries
    result.tags = postedResult.tags
  } else {
    result = postedResult
  }
  messages.push(...result.valid())

  if (!isValidation) {
    if (messages.length === 0) {
      await result.save()
      return json(result.full())
    }
    // Perserve our non-feedback API contract with existing clients.
    throw error(400, 'Result did not validate.')
  } else if (messages.length > 0) console.table(messages) // TODO: Remove this server side table print of the messages.
  const respResult: Partial<ResultFull> = result.full()
  // If just validating `newresult.id` gets thrown away and a new one generated on the next POST - don't pass it back.
  if (result.id === postedResult.id) {
    delete respResult.id
  }
  return json({ result: respResult, messages })
}
