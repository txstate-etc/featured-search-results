import { error, json } from '@sveltejs/kit'
import { isBlank } from 'txstate-utils'
import { Result, type ResultDocument, type RawJsonResult } from '$lib/models/result.js'
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
  messages.push(...ValidationChecks.isBlank(body, 'url', isValidation))

  let result = null
  const newresult = new Result()
  newresult.fromJson(body)
  /* We have a potential problem here with the `Result.currencyTest`.
     If we save and stay on the editor page planning on making updates, then go get some coffee for about 10 mintues,
     currency test has updated the associated result.id to have a result.url of 'txst.edu' if our url started with 'txstate.edu'.
     Then we make udates and click save on the form that does the POSTing. Result.findOne won't find our original url so
     we'll also need to search for the alternatve conversion URL. Alternatively we could update all our urls from the start
     but whap happens if we have a servie we're creating a Result for that isn't yet updated to use the new txst.edu url?

     Maybe we should provide a findById inspecting body for an id passed in for POST being treated as an upsert? */
  let oldresult = await Result.findOne({ url: newresult.url }) as ResultDocument | undefined
  if (!oldresult && newresult.url.includes('txstate.edu')) {
    oldresult = await Result.findOne({ url: newresult.url.replace(/txstate\.edu/, 'txst.edu') }) as ResultDocument | undefined
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
  // May need to throw a try catch around the following.
  messages.push(...(await result.valid()))

  if (!isValidation) {
    await result.save()
    return json(result.full())
  }
  // Include the full result since this is a post that should be passing an newly minted `id` back to us.
  return json({ result: result.full(), messages })
}
