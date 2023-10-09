import { Counter, Result, type ResultDocument } from '$lib/models'
import { error, json } from '@sveltejs/kit'
// import { isBlank } from 'txstate-utils'
import { idFromUrl } from '$lib/util'

/* function idFromUrl (url: URL) {
  const id = (url.searchParams.get('id') ?? undefined)?.trim()
  if (isBlank(id)) throw error(400, { message: 'id is required.' })
  return id
} */

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, locals, cookies }) {
  if (!locals.isEditor) throw error(401)
  const id = idFromUrl(url)
  const cookiename = 'sfr_counter_' + id
  let voted = cookies.get(cookiename)
  if (voted !== 'true') voted = 'false'
  const count = await Counter.get(id)
  cookies.set(cookiename, voted, { sameSite: 'none', secure: true, httpOnly: true, maxAge: 365 * 24 * 60 * 60 * 1000 })
  return json({ count })
}

/** @type {import('./$types').RequestHandler} */
export async function POST ({ url, request, locals, cookies }) {
  if (!locals.isEditor) throw error(401)
  const id = idFromUrl(url)
  const cookiename = 'sfr_counter_' + id
  if (cookies.get(cookiename) !== 'false') {
    const count = await Counter.get(id)
    return json({ count })
  }
  const count = await Counter.increment(id)
  cookies.set(cookiename, 'true', { sameSite: 'none', secure: true, httpOnly: true, maxAge: 365 * 24 * 60 * 60 * 1000 })
  return json({ count })
}
