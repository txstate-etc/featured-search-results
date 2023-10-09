import { base } from '$app/paths'

const logoutUrl = new URL(process.env.PUBLIC_AUTH_REDIRECT_URL!)
logoutUrl.search = ''
logoutUrl.pathname = '/logout'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ cookies }) {
  const outUrl = new URL(logoutUrl)
  outUrl.searchParams.set('unifiedJwt', cookies.get('token') ?? '')
  return new Response('OK', {
    status: 302,
    headers: {
      'Set-Cookie': `token=deleted; path=${base || '/'}; expires=Thu, 01 Jan 1970 00:00:00 GMT`,
      Location: outUrl.toString()
    }
  })
}
