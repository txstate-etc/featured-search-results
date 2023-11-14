import { base } from '$app/paths'
import { env } from '$env/dynamic/public'


let logoutUrl: URL | undefined

/** @type {import('./$types').RequestHandler} */
export async function GET ({ cookies }) {
  if (logoutUrl == null) {
    logoutUrl = new URL(env.PUBLIC_AUTH_REDIRECT_URL!)
    logoutUrl.search = ''
    logoutUrl.pathname = '/logout'
  }
  const outUrl = new URL(logoutUrl)
  outUrl.searchParams.set('unifiedJwt', cookies.get('token') ?? '')
  return new Response('OK', {
    status: 302,
    headers: {
      'Set-Cookie': `token=deleted; path=${base ?? '/'}; expires=Thu, 01 Jan 1970 00:00:00 GMT`,
      Location: outUrl.toString()
    }
  })
}
