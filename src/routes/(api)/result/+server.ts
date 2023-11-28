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
