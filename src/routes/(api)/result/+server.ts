import { error, json } from '@sveltejs/kit'
import { Result, type ResultDocument, type RawJsonResult, type ResultFull, type TemplateResult } from '$lib/models/result.js'
import { MessageType, type Feedback } from '@txstate-mws/svelte-forms'
import { VALIDATE_ONLY } from '$lib/util/globals.js'

/** @type {import('./$types').RequestHandler} */
export async function POST ({ url, locals, request }) {
  if (!locals.isEditor) throw error(403)
  const body: RawJsonResult | TemplateResult = await request.json()
  if (!body) throw error(400, 'POST body was not parseable JSON.')

  const isValidation = url.searchParams.has(VALIDATE_ONLY)
  const messages: Feedback[] = []
  const postedResult = new Result()
  postedResult.fromPartialJson(body)
  /* We have a potential problem here with the `Result.currencyTest` and URL Equivalencies.
     If we save a Result and the user keeps the response as the state in whatever editor, then step away for about 10 min, by then
     currency test may have updated the associated result.id to have a result.url.hostname ending in 'txst.edu' - if the
     url.hostname that was POSTed ended with 'txstate.edu' and can be updated to 'txst.edu'. Then the user makes udates and
     submit the form with the response data they previously recieved and create an equivalent/duplicate Result record that can
     make it problematic to edit and update Result records for the associated URL later.

     With all the ways URLs can have inobvious equivalencies we can also help our humans by detecting existing equivalent URLs for
     them so they don't get confused by inexplainable matchings when equivalent Result records with different matching rules cause
     different matching results than what our human editors are looking at. We can also alert them to these equivalences so they
     can go fix them. */
  const existingResults: ResultDocument[] | undefined = await Result.findByUrl(postedResult.url)
  if (existingResults && existingResults.length > 0) {
    messages.push({ type: MessageType.ERROR, path: 'url', message: 'This URL is equivalent to existing Result records.' })
    messages.push(...existingResults.map(r => {
      return { type: MessageType.WARNING, path: `equivalent.${r.id}.${r.title}`, message: `URL is equivalent to ${r.title}'s URL.` }
    }))
  }
  messages.push(...postedResult.valid())
  if (!isValidation) {
    // if (messages.some(message => [MessageType.ERROR, MessageType.SYSTEM].includes(message.type as MessageType))) {
    if (messages.length === 0) {
      await postedResult.save()
      return json({ result: postedResult.full(), messages })
    }
  }
  const respResult: Partial<ResultFull> = postedResult.full()
  delete respResult.id
  return json({ result: respResult, messages })
}
