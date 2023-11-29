import { Cache } from 'txstate-utils'
import { Result } from '$lib/models/result.js'
import { Query } from '$lib/models/query.js'
import { authenticator } from '$lib/util/auth.js'
import { loadPeople } from '$lib/util/loadPeople.js'
import reloadPeopleCron from '$lib/util/loadPeople_Cron.js'
import { migrate } from '$lib/util/migrations.js'
import { mongoConnect } from '$lib/util/mongo.js'
import { motion } from '$lib/util/motion.js'
import { building } from '$app/environment'

async function startup () {
  await Promise.all([
    mongoConnect(),
    migrate()
  ])
  try {
    // Toggle this in development if needed to get fresh directory results. Otherwise - don't slam motion with needless requests.
    if (process.env.NODE_ENV !== 'development') {
      console.log('Not in development, loading people...')
      await loadPeople()
    } else console.log('In development, not slamming motion with constant reloads of people directory.')
  } catch (e) {
    console.error(e)
  }
  if (process.env.NODE_ENV !== 'development') {
    console.log('Not in development, activating people directory refresh schedule...')
    reloadPeopleCron.start()
  } else console.log('In development, not running people refresh cron that will slam motion at the same time as SFR Qual does.')
  void Result.currencyTestLoop()
  void Query.cleanupLoop()
}
if (!building) await startup()

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

/** @type {import('@sveltejs/kit').Handle} */
export async function handle ({ event, resolve }) {
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
