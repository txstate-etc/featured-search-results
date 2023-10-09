import { json } from '@sveltejs/kit'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ locals }) {
  return json({ login: locals.login, isEditor: locals.isEditor })
}
