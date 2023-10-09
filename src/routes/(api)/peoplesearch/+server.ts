import { json } from '@sveltejs/kit'
import db from 'mysql2-async/db'
import { getPeopleDef, getWhereClause, getSortClause, getLimitClause } from '$lib/util/helpers'

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url }) {
  const q = url.searchParams.get('q') ?? undefined
  let n = parseInt(url.searchParams.get('n') ?? '0', 10)
  let p = parseInt(url.searchParams.get('p') ?? '0', 10)
  const sort = url.searchParams.get('sort') ?? undefined
  const response = { count: 0, lastpage: 1, results: [] as any[] }
  if (!q) return json(response) // Handle empty request.
  n = (n > 0) ? n : 10 // Normalize the n results returned/page. default = 10
  p = (p > 0) ? p : 1 // Normalize the p page number requested. default = 1

  const peopleDef = getPeopleDef()
  const whereClause = getWhereClause(peopleDef, q)
  const countSQL = 'select count(*) from people_search' + whereClause.sql
  const listingSQL = `select * from people_search ${whereClause.sql} ${getSortClause(peopleDef, sort)} ${getLimitClause(p, n)}`
  const [hitCount, people] = await Promise.all([
    db.getval<number>(countSQL, whereClause.binds),
    db.getall(listingSQL, whereClause.binds)
  ])
  // eslint-disable-next-line no-return-assign
  people.forEach(person => { delete person.plid && Object.keys(person).forEach(property => person[property] = (person[property] ? person[property].toString() : '')) })
  response.count = hitCount ?? 0
  response.lastpage = Math.ceil(response.count / n)
  response.results = people
  return json(response)
}
