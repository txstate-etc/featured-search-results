import { json } from '@sveltejs/kit'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ locals }) {
  console.log('self/ ', JSON.stringify(locals))
  return json({ login: locals.login, isEditor: locals.isEditor })
}
