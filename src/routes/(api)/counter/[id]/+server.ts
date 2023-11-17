import { Counter } from '$lib/models/counter.js'
import { error, json } from '@sveltejs/kit'
import { idFromUrl } from '$lib/util'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, locals, cookies }) {
  if (!locals.isEditor) throw error(403)
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
  if (!locals.isEditor) throw error(403)
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
