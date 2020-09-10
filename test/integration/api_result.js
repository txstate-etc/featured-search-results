/* global before, describe, it, should */
require('should')
const db = require('txstate-node-utils/lib/db')
const util = require('txstate-node-utils/lib/util')
const Result = require('../../models/result')
const Query = require('../../models/query')
const Counter = require('../../models/counter')
const axios = require('axios')
const https = require('https')
const moment = require('moment')

const agent = new https.Agent({
  rejectUnauthorized: false
})
const client = axios.create({ httpsAgent: agent, baseURL: 'https://' + process.env.API_HOST })
const get = async function (endpoint, skipSecret = false) {
  const headers = {}
  if (!skipSecret) headers['X-Secret-Key'] = process.env.FEATURED_SECRET
  return (await client.get(endpoint, { headers: headers })).data
}
const post = async function (endpoint, payload, skipSecret = false) {
  const headers = {}
  if (!skipSecret) headers['X-Secret-Key'] = process.env.FEATURED_SECRET
  return client.post(endpoint, payload, { headers: headers })
}
const holdUntilServiceUp = async function (endpoint) {
  for (var i = 0; i < 100; i++) {
    try {
      await get(endpoint)
      break
    } catch (e) {
      // keep trying until we get to 100
      await util.sleep(50)
    }
  }
}

describe('integration', function () {
  describe('api', function () {
    describe('result', function () {
      var id
      var result = {
        url: 'http://txstate.edu',
        title: 'Texas State University Homepage',
        entries: [
          {
            keyphrase: 'Bobcat Village',
            mode: 'exact'
          }, {
            keyphrase: 'Texas State Homepage',
            mode: 'phrase'
          }
        ],
        tags: ['marketing']
      }
      before(async function () {
        await db.connect()
        await Result.deleteMany()
        await Query.deleteMany()
        await Counter.deleteMany()
        await db.disconnect()
        await holdUntilServiceUp('/results')
      })
      it('should return 401 instead of accepting our result if X-Secret-Key header is absent', async function () {
        await post('/result', result, true).should.be.rejectedWith({ response: { status: 401 } })
      })
      it('should accept our result', async function () {
        (await post('/result', result)).status.should.equal(200)
      })
      it('should merge results when trying to post a result with an identical url', async function () {
        const another = { ...result, entries: [{ keyphrase: 'Texas State University', mode: 'keyword' }, { keyphrase: 'bobcat village', mode: 'exact' }] }
        const final = (await post('/result', another)).data
        final.entries.length.should.equal(3)
        final.entries[2].keyphrase.should.equal('texas state university')
      })
      it('should return one result on /results', async function () {
        var results = (await get('/results'))
        results.length.should.equal(1)
        id = results[0].id
      })
      it('should not require a secret to perform a search', async function () {
        // eslint-disable-next-line no-unused-expressions
        (await get('/search', true)).should.be.an.Array
      })
      it('should be case insensitive', async function () {
        (await get('/search?q=bObCAt VILLagE')).length.should.equal(1)
      })
      it('should return results when query words are given as lower case', async function () {
        (await get('/search?q=bobcat village')).length.should.equal(1)
      })
      it('should not return results when mode is exact and query has an extra word', async function () {
        (await get('/search?q=bobcat village apartments')).length.should.equal(0)
      })
      it('should return results when mode is phrase and query is an exact match', async function () {
        (await get('/search?q=texas state homepage')).length.should.equal(1)
      })
      it('should not return results when mode is phrase and words are missing from the query', async function () {
        (await get('/search?q=homepage')).length.should.equal(0)
      })
      it('should return results when mode is phrase and query has an extra word at the end', async function () {
        (await get('/search?q=texas state homepage links')).length.should.equal(1)
      })
      it('should return results when mode is phrase and query has an extra word at the beginning', async function () {
        (await get('/search?q=show texas state homepage')).length.should.equal(1)
      })
      it('should return results when mode is phrase and query has an extra word inserted', async function () {
        (await get('/search?q=texas state full homepage')).length.should.equal(1)
      })
      it('should return results when mode is phrase and query has an extra word inserted in two places', async function () {
        (await get('/search?q=texas bobcats state full homepage')).length.should.equal(1)
      })
      it('should not return results when mode is phrase and query is out of order', async function () {
        (await get('/search?q=texas homepage state')).length.should.equal(0)
      })
      it('should return results when mode is keyword and query is out of order', async function () {
        (await get('/search?q=texas university state')).length.should.equal(1)
      })
      it('should return results when mode is keyword and query is out of order with extra words', async function () {
        (await get('/search?q=show texas full university bobcats state')).length.should.equal(1)
      })
      it('should be able to retrieve a record by id', async function () {
        (await get('/result/' + id)).id.should.equal(id)
      })
      it('should not return an id in the search results', async function () {
        should.not.exist((await get('/search?q=bobcat village'))[0].id)
      })
      it('should return 3 entries in the full info', async function () {
        (await get('/result/' + id)).entries.length.should.equal(3)
      })
      it('should have recorded our queries while searching', async function () {
        const queries = await get('/queries')
        queries.length.should.be.greaterThan(0)
        for (const query of queries) {
          query.hits.should.be.greaterThan(0)
          moment(query.lasthit).isAfter(moment().subtract(1, 'hour')).should.be.true()
          if (query.query === 'texas university state') {
            query.results.length.should.equal(1)
            query.results[0].url.should.equal('http://txstate.edu')
            query.results[0].title.should.equal('Texas State University Homepage')
          }
        }
      })
      it('should return a query count with each entry in a result', async function () {
        const result = (await get('/results'))[0]
        for (const entry of result.entries) {
          entry.count.should.be.greaterThan(0)
        }
      })
    })
    // ======================================================================================================
    describe('peoplesearch', async function() {
      it('should not return a result if nothing is passed', async function () {
        (await get('/peoplesearch'))//.length.should.equal(0)
      })
      it('should convert decimals to integers when given decimal num', async function () {
        const result = (await get('/peoplesearch?q=lastname beginswith P&num=2.8'))//.find a way to count the resultset size as 2.
        /*for (const entry of result.entries) {
          entry
        }*/
      })
      /*it('should convert binaries to base 10 when given a binary num', async function() {
        (await get('/peoplesearch?q=lastname beginswith P&num=0b11'))//.find a way to count the resultset size as 2.
      })
      it('should convert octals to base 10 when given octal num', async function() {
        (await get('/peoplesearch?q=lastname beginswith P&num=0o7'))//.find a way to count the resultset size as 2.
      })
      it('should convert hexadecimals to base 10 when given hexidecimal num', async function() {
        (await get('/peoplesearch?q=lastname beginswith P&num=0xf'))//.find a way to count the resultset size as 2.
      })
      it('should default to all results when given non-numeric num', async function() {
        (await get('/peoplesearch?q=lastname beginswith P&num=a17'))//.find a way to count the resultset size as 10.
      })
      it('should default to all results when given num <= 0', async function() {
        (await get('/peoplesearch?q=lastname beginswith P&num=-1'))//.find a way to count the resultset size as 10.
      })
      it('should default to lastname when given an invalid sort', async function() {
        (await get('/peoplesearch?q=lastname beginswith P&sort=fwirstname'))//.find a way to test for lastname sorted. Perhaps use a known lastname group.
      })
      it('should handle non-valid terms gracefully', async function() {
        (await get('/peoplesearch?q=lorstname beginswith P'))//.find a way to test how it handles non-valid terms in q
      })
      it('should handle non-valid likeOps gracefully', async function() {
        (await get('/peoplesearch?q=nor lastname beginswith P'))//.find a way to test how it handles non-valid likeOps in q
      })
      it('should handle non-valid wildCardOps gracefully', async function() {
        (await get('/peoplesearch?q=lastname begornswith P'))//.find a way to test how it handles non-valid wildCardOps in q
      })*/
      

    })
     // ======================================================================================================
    /*describe('counter', function () {
      let currentcount
      it('should return a count', async function () {
        const result = await client.get('/counter/test')
        currentcount = result.data.count
        currentcount.should.be.type('number')
      })
      it('should be able to increment the count with the cookie given by the GET endpoint', async function () {
        const result = await client.post('/counter/test', {}, { headers: { Cookie: 'sfr_counter_test=false' } })
        result.data.count.should.equal(currentcount + 1)
        const savedresult = await client.get('/counter/test')
        savedresult.data.count.should.equal(currentcount + 1)
      })
      it('should not be able to increment the count without the cookie given by the GET endpoint', async function () {
        const result = await client.post('/counter/test', {})
        result.data.count.should.equal(currentcount + 1)
      })
      it('should not be able to increment the count with the cookie given by the POST endpoint', async function () {
        const result = await client.post('/counter/test', {}, { headers: { Cookie: 'sfr_counter_test=true' } })
        result.data.count.should.equal(currentcount + 1)
      })
    })*/
  })
})
