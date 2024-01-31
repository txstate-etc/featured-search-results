import { error, json } from '@sveltejs/kit'
import { Result, type ResultDocument, type RawJsonResult, type ResultFull, type TemplateResult, type DuplicateMatching, findDuplicateMatchings, matchModesToString } from '$lib/models/result.js'
import { MessageType, type Feedback } from '@txstate-mws/svelte-forms'
import { VALIDATE_ONLY, appURL } from '$lib/util/globals.js'

/** @type {import('./$types').RequestHandler} */
export async function POST ({ url, locals, request }) {
  if (!locals.isEditor) throw error(403)
  const body: RawJsonResult | TemplateResult = await request.json()
  if (!body) throw error(400, 'POST body was not parseable JSON.')

  const isValidation = url.searchParams.has(VALIDATE_ONLY)
  const messages: Feedback[] = []
  const postedResult = new Result()
  postedResult.fromPartialJson(body)
  const existingUrls: ResultDocument[] | undefined = await Result.findByUrl(postedResult.url)
  if (existingUrls?.length) {
    messages.push(...existingUrls.map(r => {
      return { type: MessageType.WARNING, path: 'url', message: `URL is equivalent to [${r.title}](${appURL}/results/${r.id})'s URL.` }
    }))
    if (!postedResult.hasTag('duplicate-url')) postedResult.tags.push('duplicate-url')
  } else postedResult.tags = postedResult.tags.filter((t: string) => t !== 'duplicate-url')
  const existingTitles: ResultDocument[] | undefined = await Result.find({ title: postedResult.title })
  if (existingTitles?.length) {
    messages.push(...existingTitles.map(r => {
      return { type: MessageType.WARNING, path: 'title', message: `This Title is a duplicate to [${r.title}](${appURL}/results/${r.id})'s Title.` }
    }))
    if (!postedResult.hasTag('duplicate-title')) postedResult.tags.push('duplicate-title')
  } else postedResult.tags = postedResult.tags.filter((t: string) => t !== 'duplicate-title')
  const dupMatchings: DuplicateMatching[] = findDuplicateMatchings(postedResult.entries)
  if (dupMatchings.length) {
    messages.push(...dupMatchings.map<Feedback>(dup => {
      return { type: MessageType.ERROR, path: `entries.${dup.index}.keywords`, message: `Duplicate Terms for ${matchModesToString.get(dup.mode)} Type.` }
    }))
    if (!postedResult.hasTag('duplicate-match-phrase')) postedResult.tags.push('duplicate-match-phrase')
  } else postedResult.tags = postedResult.tags.filter((t: string) => t !== 'duplicate-match-phrase')
  if (!existingUrls?.length && !existingTitles?.length && !dupMatchings.length) postedResult.tags = postedResult.tags.filter((t: string) => t !== 'duplicate')
  else if (!postedResult.hasTag('duplicate')) postedResult.tags.push('duplicate')
  messages.push(...postedResult.getValidationFeedback())
  if (!isValidation) {
    const errorMessages = messages.filter(m => m.type === MessageType.ERROR)
    if (errorMessages.length === 0) {
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
