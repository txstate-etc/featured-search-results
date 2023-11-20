import { error, json } from '@sveltejs/kit'
import { Result, type ResultDocument, type RawJsonResult, type ResultFull, type TemplateResult } from '$lib/models/result.js'
import type { Feedback } from '@txstate-mws/svelte-forms'
import { VALIDATE_ONLY, apiBase, type ClientAuth } from '$lib/util/globals.js'

/** @type {import('./$types').RequestHandler} */
export async function POST ({ url, locals, request }) {
  if (!locals.isEditor) throw error(403)
  const body: RawJsonResult | TemplateResult = await request.json()
  if (!body) throw error(400, 'POST body was not parseable JSON.')

  const isValidation = url.searchParams.has(VALIDATE_ONLY)
  const messages: Feedback[] = []
  const postedResult = new Result()
  postedResult.fromPartialJson(body)
  /* We have a potential problem here with the `Result.currencyTest`.
     If we save a Result and the user keeps the response as the state in whatever editor, then step away for about 10 min, by then
     currency test has updated the associated result.id to have a result.url.hostname ending in of 'txst.edu' - if the
     url.hostname that was posted ended with 'txstate.edu' and can be updated to 'txst.edu'. Then the user makes udates and
     submit the form with the response data they previously recieved. Result.findOne won't find the url from our previous response
     so we'll also need to search for the alternatve conversion URL. Alternatively we could update all our urls from the start
     but what happens if we have a servie we're creating a Result for that isn't yet updated to use the new txst.edu domain? */
  let existingResult = await Result.findOne({ url: postedResult.url }) as ResultDocument | undefined
  if (!existingResult && postedResult.url?.length > 9) { // (http://a.b).length === 10
    const parsedUrl = new URL(postedResult.url)
    if (parsedUrl.hostname.endsWith('txstate.edu')) {
      parsedUrl.hostname = parsedUrl.hostname.replace(/txstate\.edu$/, 'txst.edu')
      existingResult = await Result.findOne({ url: parsedUrl.toString() }) as ResultDocument | undefined
    } else if (parsedUrl.hostname.endsWith('txst.edu')) { // This problem cuts both ways.
      parsedUrl.hostname = parsedUrl.hostname.replace(/txst\.edu$/, 'txstate.edu')
      existingResult = await Result.findOne({ url: parsedUrl.toString() }) as ResultDocument | undefined
    }
  }
  const result = existingResult ?? postedResult
  if (existingResult) {
    result.tags = postedResult.tags.length > 0 ? postedResult.tags : result.tags
    result.title = postedResult.title ?? result.title
    result.setEntries(postedResult.entries)
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
  // If just validating `postedResult.id` gets thrown away and a new one generated on the next POST - don't pass it back.
  if (respResult.id === postedResult.id) delete respResult.id
  return json({ result: respResult, messages })
}
