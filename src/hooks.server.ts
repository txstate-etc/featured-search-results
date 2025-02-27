import { Cache } from 'txstate-utils'
import { authenticator } from '$lib/util/auth.js'
import { mongoConnect } from '$lib/util/mongo.js'
import { motion } from '$lib/util/motion.js'
import { building } from '$app/environment'
import { base } from '$app/paths'
import { isValidUrl, logEvent, logResponse } from './lib/util/helpers'

if (!building) await mongoConnect()

// Note this cache has a default of 5 minute fresh TTL and 10 minute stale TTL - so if the AD group is updated it
// will take at least 5 minutes to be reflected in the app if the cache had just been refreshed before the update.
const editorGroupCache = new Cache(async () => {
  const { accounts } = await motion.query<{ accounts: { netid: string, canLogin: boolean }[] }>(`
    query getFeaturedSearchEditors ($groupName: StringCI!) {
      accounts (filter: { adGroups: [$groupName] }) {
        netid
        canLogin
      }
    }
  `, { groupName: process.env.EDITOR_GROUP_NAME })
  return new Set(accounts.filter(a => a.canLogin).map(a => a.netid))
})

const validOrigins = new Set(['txstate.edu', 'txst.edu', 'tsus.edu', 'tjctc.org'])
const allowedCorsEndpoints = /^\/(search|peoplesearch|counter|departments)\/?$/

/** @type {import('@sveltejs/kit').Handle} */
export async function handle ({ event, resolve }) {
  // logEvent(event)
  console.log('Event handler called.')
  const unifiedJwt = event.url.searchParams.get('unifiedJwt')
  // if we are coming back from unified auth, unified auth will have set
  // both 'requestedUrl' and 'unifiedJwt' as parameters
  if (unifiedJwt) {
    // redirect the browser to wherever it was going when the login process began,
    // but do it in HTML after a 200 because browsers don't look at the redirect chain
    // properly when evaluating whether to send a SameSite Strict cookie
    const requestedUrl = event.url.searchParams.get('requestedUrl')
    // TODO: We may need to look into sanitizing the requestedUrl as one of ours (log if not so we can get an alert to broken routing).
    return new Response(null, {
      headers: {
        location: requestedUrl ?? '/',
        'set-cookie': `token=${unifiedJwt}; HttpOnly; SameSite=Strict; Path=${base ?? '/'}`,
        'content-type': 'text/html',
        status: '200',
        refresh: `0;URL='${requestedUrl}'`
      }
    })
  }

  const token = event.cookies.get('token')
  if (token?.length) {
    const payload = await authenticator.get(token)
    if (payload?.sub?.length) {
      event.locals.login = payload.sub
      event.locals.isEditor = (await editorGroupCache.get()).has(payload.sub)
    }
  }

  // CORS preflight and simple request origin parsing and response headers.
  const origin = event.request.headers.get('origin')
  const parsedOrigin = isValidUrl(origin) ? new URL(origin as string | URL) : undefined
  const originDomain = parsedOrigin?.hostname.split('.').slice(-2).join('.')
  if (event.request.method === 'OPTIONS' && allowedCorsEndpoints.test(event.url.pathname)) {
    if (!validOrigins.has(originDomain ?? '')) return new Response()

    return new Response(null, {
      headers: {
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Credentials': 'true', // <- Not compatible with 'Access-Control-Allow-Origin': '*'
        'Access-Control-Allow-Origin': origin ?? '*',
        'Access-Control-Max-Age': '60'
      }
    })
  }

  const response = await resolve(event)
  if (validOrigins.has(originDomain ?? '') && allowedCorsEndpoints.test(event.url.pathname)) {
    // It's not enough to send the headers to the preflight request, we also have to send them to the simple request.
    response.headers.set('Access-Control-Allow-Origin', origin ?? '*')
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    // TODO: uncomment when ready to test.
    // response.headers.set('Cache-Control', 'no-cache')
  }
  // logResponse(response)
  console.log('Returning response.')
  return response
}
