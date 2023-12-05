import { Cache } from 'txstate-utils'
import { authenticator } from '$lib/util/auth.js'
import { mongoConnect } from '$lib/util/mongo.js'
import { motion } from '$lib/util/motion.js'
import { building } from '$app/environment'
import { base } from '$app/paths'

if (!building) await mongoConnect()

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
const validAuthReferers = new Set([...validOrigins, 'duosecurity.com'])

/** @type {import('@sveltejs/kit').Handle} */
export async function handle ({ event, resolve }) {
  const unifiedJwt = event.url.searchParams.get('unifiedJwt')
  // if we are coming back from unified auth, unified auth will have set
  // both 'requestedUrl' and 'unifiedJwt' as parameters
  if (unifiedJwt) {
    // redirect the browser to wherever it was going when the login process began,
    // but do it in HTML after a 200 because browsers don't look at the redirect chain
    // properly when evaluating whether to send a SameSite Strict cookie
    const requestedUrl = event.url.searchParams.get('requestedUrl')
    // TODO: We may need to look into sanitizing the requestedUrl as one of ours (log if not so we can get an alert to broken routing).
    /* Test if unifiedJwt is from an authorized jwt provider to make sure jwt is coming from a trusted source.
       Otherwise we're open to someone sending us an intercepted token that could still be valid. */
    const referer = event.request.headers.get('referer')
    console.log('hooks.server - referer: ', referer)
    if (referer) {
      const referrerDomain = new URL(referer).hostname.split('.').slice(-2).join('.')
      if (validAuthReferers.has(referrerDomain) || event.url.hostname === 'localhost') {
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
    }
  }

  const token = event.cookies.get('token')
  if (token?.length) {
    const payload = await authenticator.get(token)
    if (payload?.sub?.length) {
      event.locals.login = payload.sub
      event.locals.isEditor = (await editorGroupCache.get()).has(payload.sub)
    }
  }

  if (event.request.method === 'OPTIONS' && (
    event.url.pathname.endsWith('/search') ||
    event.url.pathname.endsWith('/peoplesearch') ||
    event.url.pathname.endsWith('/counter')
  )) {
    const parsedOrigin = new URL(event.request.headers.get('origin') ?? '')
    const originParts = parsedOrigin.hostname.split('.')
    if (!validOrigins.has(originParts.slice(-2).join('.'))) return new Response()

    return new Response(null, {
      headers: {
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }

  const response = await resolve(event)
  return response
}
