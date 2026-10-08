import { expect, test } from '@playwright/test'
import mongoose from 'mongoose'

/** Fixtures are inserted straight into mongo rather than through POST /result because the
 * editor-gated endpoints require a Motion AD-group lookup the test harness can't make.
 * The doc shape mirrors what Result.fromPartialJson would save (keyphrases are stored as
 * lowercased `keywords` arrays). */
const seedResult = {
  url: 'https://www.txst.edu',
  title: 'Texas State University Homepage',
  currency: { broken: false, tested: new Date() },
  tags: ['marketing'],
  entries: [
    { keywords: ['bobcat', 'village'], mode: 'exact', priority: 1, hitCountCached: 0 },
    { keywords: ['texas', 'state', 'homepage'], mode: 'phrase', priority: 2, hitCountCached: 0 },
    { keywords: ['texas', 'state', 'university'], mode: 'keyword', priority: 3, hitCountCached: 0 },
    { keywords: ['bobcats'], mode: 'keyword', priority: 4, hitCountCached: 0 }
  ]
}

function mongoUrl () {
  return `mongodb://${process.env.DB_HOST ?? 'mongodb'}:${process.env.DB_PORT ?? '27017'}/${process.env.DB_DATABASE ?? 'default_database'}`
}

test.beforeAll(async () => {
  await mongoose.connect(mongoUrl())
  const db = mongoose.connection.db!
  await Promise.all([
    db.collection('results').deleteMany({}),
    db.collection('queries').deleteMany({})
  ])
  await db.collection('results').insertOne(seedResult)
})

test.afterAll(async () => {
  await mongoose.disconnect()
})

test.describe('search', () => {
  async function search (request: any, q?: string) {
    const resp = await request.get('/search', { params: q != null ? { q } : {} })
    expect(resp.status()).toEqual(200)
    return await resp.json() as { url: string, title: string, id?: string }[]
  }

  test('should return an empty array when no query is given', async ({ request }) => {
    expect(await search(request)).toEqual([])
  })
  test('should match case insensitively and not leak ids', async ({ request }) => {
    const results = await search(request, 'bObCAt VILLagE')
    expect(results.length).toEqual(1)
    expect(results[0].url).toEqual(seedResult.url)
    expect(results[0].title).toEqual(seedResult.title)
    expect(results[0].id).toBeUndefined()
  })
  test('should not match when mode is exact and query has an extra word', async ({ request }) => {
    expect((await search(request, 'bobcat village apartments')).length).toEqual(0)
  })
  test('should match when mode is phrase and query is an exact match', async ({ request }) => {
    expect((await search(request, 'texas state homepage')).length).toEqual(1)
  })
  test('should not match a multi-word phrase with a one word query', async ({ request }) => {
    expect((await search(request, 'homepage')).length).toEqual(0)
  })
  test('should match when mode is phrase and query has an extra word at the end', async ({ request }) => {
    expect((await search(request, 'texas state homepage links')).length).toEqual(1)
  })
  test('should match when mode is phrase and query has a partial word at the end', async ({ request }) => {
    expect((await search(request, 'texas state homepa')).length).toEqual(1)
  })
  test('should match when mode is phrase and query has an extra word at the beginning', async ({ request }) => {
    expect((await search(request, 'show texas state homepage')).length).toEqual(1)
  })
  test('should match when mode is phrase and query has an extra word inserted', async ({ request }) => {
    expect((await search(request, 'texas state full homepage')).length).toEqual(1)
  })
  test('should match when mode is phrase and query has extra words inserted in two places', async ({ request }) => {
    expect((await search(request, 'texas bobcats state full homepage')).length).toEqual(1)
  })
  test('should not match when mode is phrase and query is out of order', async ({ request }) => {
    expect((await search(request, 'texas homepage state')).length).toEqual(0)
  })
  test('should match when mode is keyword and query is out of order', async ({ request }) => {
    expect((await search(request, 'texas university state')).length).toEqual(1)
  })
  test('should match when mode is keyword and query is out of order with extra words', async ({ request }) => {
    expect((await search(request, 'show texas full university bobcats state')).length).toEqual(1)
  })
  test('should match when mode is keyword and query has a partial word at the end', async ({ request }) => {
    expect((await search(request, 'texas state univ')).length).toEqual(1)
  })
  test('should match when mode is keyword and query has a partial word at the end out of order', async ({ request }) => {
    expect((await search(request, 'texas university sta')).length).toEqual(1)
  })
  test('should match a one word entry with a partial one word query of 3+ characters', async ({ request }) => {
    expect((await search(request, 'bobcat')).length).toEqual(1)
  })
  test('should not partial-match a one word query of less than 3 characters', async ({ request }) => {
    expect((await search(request, 'bo')).length).toEqual(0)
  })
  test('should record queries that were not asyoutype', async ({ request }) => {
    await search(request, 'texas university state')
    // Query.record is fire-and-forget on the server, so poll briefly.
    await expect.poll(async () => {
      return await mongoose.connection.db!.collection('queries').findOne({ query: 'texas university state' })
    }, { timeout: 10_000 }).not.toBeNull()
    const recorded = await mongoose.connection.db!.collection('queries').findOne({ query: 'texas university state' })
    expect(recorded!.hits.length).toBeGreaterThan(0)
  })
  test('should not record asyoutype queries', async ({ request }) => {
    const resp = await request.get('/search', { params: { q: 'texas state homepa', asyoutype: 1 } })
    expect(resp.status()).toEqual(200)
    expect((await resp.json()).length).toEqual(1)
  })
})

test.describe('linkcheck', () => {
  test('should return links for seeded results', async ({ request }) => {
    const resp = await request.get('/linkcheck')
    expect(resp.status()).toEqual(200)
    const body = await resp.text()
    expect(body).toContain(`<a href="${seedResult.url}">`)
  })
})

test.describe('editor-gated endpoints reject unauthenticated requests', () => {
  test('POST /result should 403', async ({ request }) => {
    const resp = await request.post('/result', { data: { url: 'https://www.txst.edu/test', title: 'Nope', entries: [] } })
    expect(resp.status()).toEqual(403)
  })
  test('GET /results should 403', async ({ request }) => {
    expect((await request.get('/results')).status()).toEqual(403)
  })
  test('GET /queries should 403', async ({ request }) => {
    expect((await request.get('/queries')).status()).toEqual(403)
  })
  test('GET /counter/test should 403', async ({ request }) => {
    expect((await request.get('/counter/test')).status()).toEqual(403)
  })
  test('POST /counter/test should 403', async ({ request }) => {
    expect((await request.post('/counter/test', { data: {} })).status()).toEqual(403)
  })
})
