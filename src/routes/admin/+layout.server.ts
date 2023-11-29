import { error, redirect } from '@sveltejs/kit'
import { base } from '$app/paths'
import { apiBase, appBase, PUBLIC_AUTH_REDIRECT_URL, type ClientAuth } from '$lib/util/globals.js'

/** @type {import('./$types').LayoutServerLoad} */
export const load = async (input) => {
  // if we are coming back from unified auth, unified auth will have set
  // both 'requestedUrl' and 'unifiedJwt' as parameters
  const requestedUrl = input.url.searchParams.get('requestedUrl')
  const token = input.url.searchParams.get('unifiedJwt')
  if (requestedUrl?.length && token?.length) {
    console.log('layout.server - setting token in cookie:', JSON.stringify(token))
    // set the token unified auth gave us in a local cookie
    input.cookies.set('token', token, { sameSite: 'strict', path: base ?? '/', httpOnly: true })
    // redirect the browser to wherever it was going when the login process began
    throw redirect(302, requestedUrl)
  }

  // regular page load, let's find out whether we're authenticated and who we are
  let login: string | undefined
  let isEditor: boolean | undefined
  try {
    const resp = await input.fetch(`${apiBase}/self`)
    ;({ login, isEditor } = await resp.json() as ClientAuth)
  } catch (e: any) {
    if (![401, 403].includes(e.status)) throw e
  }
  if (!login) {
    // we are not authenticated, redirect to unified auth to begin login process
    const authRedirect = new URL(PUBLIC_AUTH_REDIRECT_URL)
    authRedirect.searchParams.set('returnUrl', input.url.origin + appBase)
    authRedirect.searchParams.set('requestedUrl', input.url.href)
    throw redirect(302, authRedirect.toString())
  }
  // if we are authenticated, but not in the correct AD group, throw a 403
  if (!isEditor) throw error(403, 'You are not authorized to use this system.')

  // return auth details for use in the page
  return { login, isEditor }
}
