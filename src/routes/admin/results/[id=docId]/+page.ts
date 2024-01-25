import { error } from '@sveltejs/kit'
import { apiBase } from '$lib/util/globals.js'
import type { ResultEntry } from '$lib/models/result.js'

/** @type {import('./$types').PageLoad} */
export async function load ({ fetch, params }) {
  const result = await (await fetch(`${apiBase}/result/${params.id}`))?.json()
  if (result) {
    // Sort entries by terms before sending to editor.
    result.result.entries.sort((a: ResultEntry, b: ResultEntry) => {
      if (a.keyphrase < b.keyphrase) return -1
      if (a.keyphrase > b.keyphrase) return 1
      return 0
    })
    // API PUT and POST operations both call result.fromPartialJson(input) which sorts entries by priority before
    // savign so we can be confident there aren't side effects from sorting entries however user want on the form.
    return { result: result.result }
  }
  throw error(404, 'Not Found')
}
