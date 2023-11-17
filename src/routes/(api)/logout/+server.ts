import { base } from '$app/paths'
import { PUBLIC_AUTH_REDIRECT_URL, appURL } from '$lib/util/globals.js'

let logoutUrl: URL | undefined

/** @type {import('./$types').RequestHandler} */
export async function GET ({ cookies }) {
  if (logoutUrl == null) {
    logoutUrl = new URL(PUBLIC_AUTH_REDIRECT_URL)
    logoutUrl.search = ''
    logoutUrl.pathname = '/logout'
    // In case we ever decide to have Unified Auth redirect back to the app to let it reinitiate login process on logout.
    logoutUrl.searchParams.set('returnUrl', appURL)
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
