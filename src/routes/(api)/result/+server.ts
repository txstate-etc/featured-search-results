import { error, json } from '@sveltejs/kit'
import { Result, type ResultDocument, type RawJsonResult, type ResultFull } from '$lib/models/result.js'
import { ValidationChecks } from '$lib/util/helpers.js'
import type { Feedback } from '@txstate-mws/svelte-forms'
import { VALIDATE_ONLY } from '$lib/util/globals.js'

/** @type {import('./$types').RequestHandler} */
export async function POST ({ url, locals, request }) {
  const isValidation = url.searchParams.has(VALIDATE_ONLY)
  const messages: Feedback[] = []
  messages.push(...ValidationChecks.isEditor(!!locals.isEditor, isValidation))

  const body: RawJsonResult = await request.json()
  if (!body) throw error(400, 'POST body was not parseable JSON.')

  // ResultSchema validates this as well but we can't proceed without it.
  messages.push(...ValidationChecks.isBlank(body, 'url', isValidation))

  let result = null
  const newresult = new Result()
  if (isValidation) newresult.fromPartialJson(body)
  else newresult.fromJson(body)
  /* We have a potential problem here with the `Result.currencyTest`.
     If we save and stay on the editor page planning on making updates, then go get some coffee for about 10 mintues, by then
     currency test has updated the associated result.id to have a result.url of 'txst.edu' if our url started with 'txstate.edu'.
     Then we make udates and click save on the form that does the POSTing. Result.findOne won't find our original url so
     we'll also need to search for the alternatve conversion URL. Alternatively we could update all our urls from the start
     but whap happens if we have a servie we're creating a Result for that isn't yet updated to use the new txst.edu url? */
  let oldresult = await Result.findOne({ url: newresult.url }) as ResultDocument | undefined
  if (!oldresult && newresult.url) {
    const urlObj = new URL(newresult.url)
    if (urlObj.hostname.endsWith('txstate.edu')) {
      urlObj.hostname.replace('txstate.edu', 'txst.edu')
      oldresult = await Result.findOne({ url: urlObj.toString() }) as ResultDocument | undefined
    }
  }
  if (oldresult) {
    result = oldresult
    // We're letting mongoose validation check all the things we were checking before so just update to what's
    // coming in and respond with validation results of mongoose.
    result.title = newresult.title
    result.entries = newresult.entries
    result.tags = newresult.tags
  } else {
    result = newresult
  }
  messages.push(...result.valid())

  if (!isValidation && messages.length === 0) {
    await result.save()
    return json(result.full())
  } else if (messages.length > 0) { // TODO: Remove this else block and just retuen below.
    console.table(messages)
  }
  const respResult: Partial<ResultFull> = result.full()
  // If just validating `newresult.id` gets thrown away and a new one generated on the next POST - don't pass it back.
  if (result.id === newresult.id) {
    delete respResult.id
  }
  return json({ result: respResult, messages })
}
