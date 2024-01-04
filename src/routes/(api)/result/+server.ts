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
  const existingResultUrls: ResultDocument[] | undefined = await Result.findByUrl(postedResult.url)
  if (existingResultUrls?.length) {
    messages.push({ type: MessageType.ERROR, path: 'url', message: 'This URL is equivalent to existing Result records.' })
    messages.push(...existingResultUrls.map(r => {
      return { type: MessageType.WARNING, path: `equivalent.url.${r.id}.${r.title}`, message: `URL is equivalent to ${r.title}'s URL.` }
    }))
  }
  const existingResultTitles: ResultDocument[] | undefined = await Result.find({ title: postedResult.title })
  if (existingResultTitles?.length) {
    messages.push({ type: MessageType.ERROR, path: 'title', message: 'This Title is the same as existing Result records.' })
    messages.push(...existingResultTitles.map(r => {
      return { type: MessageType.WARNING, path: `equivalent.title.${r.id}.${r.title}`, message: `Title is the same as ${r.title}'s Title.` }
    }))
  }
  messages.push(...postedResult.valid())
  if (!isValidation) {
    // if (messages.some(message => [MessageType.ERROR, MessageType.SYSTEM].includes(message.type as MessageType))) {
    if (messages.length === 0) {
      try {
        const saved = await postedResult.save()
        messages.push({ type: MessageType.SUCCESS, path: `save.${saved.id}.${saved.title}`, message: `'${postedResult.title}' saved successfully.` })
        return json({ result: postedResult.full(), messages })
      } catch (e: any) {
        messages.push({ type: MessageType.ERROR, path: 'save', message: `An error occurred while saving the Result.\r${JSON.stringify(e)}` })
      }
    }
  }
  const respResult: Partial<ResultFull> = postedResult.full()
  delete respResult.id
  return json({ result: respResult, messages })
}
