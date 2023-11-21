import { Counter } from '$lib/models/counter.js'
import { error, json } from '@sveltejs/kit'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ params, locals, cookies }) {
  if (!locals.isEditor) throw error(403)
  const cookiename = 'sfr_counter_' + params.id
  let voted = cookies.get(cookiename)
  if (voted !== 'true') voted = 'false'
  const count = await Counter.get(params.id)
  cookies.set(cookiename, voted, { sameSite: 'none', secure: true, httpOnly: true, maxAge: 365 * 24 * 60 * 60 * 1000 })
  return json({ count })
}

/** @type {import('./$types').RequestHandler} */
export async function POST ({ params, request, locals, cookies }) {
  if (!locals.isEditor) throw error(403)
  const cookiename = 'sfr_counter_' + params.id
  if (cookies.get(cookiename) !== 'false') {
    const count = await Counter.get(params.id)
    return json({ count })
  }
  const count = await Counter.increment(params.id)
  cookies.set(cookiename, 'true', { sameSite: 'none', secure: true, httpOnly: true, maxAge: 365 * 24 * 60 * 60 * 1000 })
  return json({ count })
}
