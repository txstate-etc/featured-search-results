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
/* I'm not sure why fast-deep-equal being called here isn't catching what I need it to.
|  It returns false when I run it against the two objects but asserts true? I need to dig into it more.
|  Making use of should's native deepEqual in the mean time.
const fdeepequal = require('fast-deep-equal')
should.Assertion.add('fdequal', function (compare) {
  this.params = { operator: 'to be fast-deep-equal to' }
  fdeepequal(this.obj, compare)
}) */
should.Assertion.add('sortedOn', function (property) {
  const arrayOfProperty = []
  const sorter = []
  this.obj.forEach(value => arrayOfProperty.push(value[property]) && sorter.push(value[property]))
  sorter.sort()
  arrayOfProperty.should.deepEqual(sorter)
})

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
      /*
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
      }) */
    })
    // ======================================================================================================
    describe('peoplesearch', async function () {
      it('should not return a result if nothing is passed', async function () {
        (await get('/peoplesearch')).count.should.equal(0)
      })
      it('should return the same result as current if nothing is passed', async function () {
        const [me, current] = await Promise.all([
          get('/peoplesearch'),
          get('https://secure.its.txstate.edu/iphone/people/jwt.pl')
        ])
        me.should.deepEqual(current)
      })
      it('should convert decimals to integers when given decimal n', async function () {
        (await get('/peoplesearch?q=last%20beginswith%20pil&n=1.8')).results.length.should.equal(2)
      })
      it('should return the same-ish result as current if n is a decimal value', async function () {
        const [me, current] = await Promise.all([
          get('/peoplesearch?q=last%20beginswith%20pil&n=1.8'),
          get('https://secure.its.txstate.edu/iphone/people/jwt.pl?q=last%20beginswith%20pil&n=1.8')
        ])
        // me.should.deepEqual(current)
        // Can't run above since NodeJS version returns nulls instead of empty strings and uses single quotes in places where perl strictly uses double quotes.
        Object.keys(me).should.deepEqual(Object.keys(current))
        me.count.should.equal(current.count)
        me.lastpage.should.equal(current.lastpage - 1)
        /* Current version doesn't round n, it floors n.
        me.results.length.should.equal(current.results.length)
        */
      })
      it('should convert binaries to base 10 when given a binary n', async function () {
        (await get('/peoplesearch?q=last%20beginswith%20pil&n=0b10')).results.length.should.equal(2)
      })
      it('should return the same-ish result as current if n is a binary value', async function () {
        const [me, current] = await Promise.all([
          get('/peoplesearch?q=last%20beginswith%20pil&n=0b10'),
          get('https://secure.its.txstate.edu/iphone/people/jwt.pl?q=last%20beginswith%20pil&n=0b10')
        ])
        Object.keys(me).should.deepEqual(Object.keys(current))
        me.count.should.equal(current.count)
        me.lastpage.should.equal(current.lastpage + 1)
        /* Current version doesn't understand 0b00 syntax. It defaults to 10 results a page. This affects lastpage returned by it.
        me.results.length.should.equal(current.results.length)
        */
      })
      it('should convert octals to base 10 when given octal n', async function () {
        (await get('/peoplesearch?q=last%20beginswith%20pil&n=0o2')).results.length.should.equal(2)
      })
      it('should return the same-ish result as current if n is an octal value', async function () {
        const [me, current] = await Promise.all([
          get('/peoplesearch?q=last%20beginswith%20pil&n=0o2'),
          get('https://secure.its.txstate.edu/iphone/people/jwt.pl?q=last%20beginswith%20pil&n=0o2')
        ])
        Object.keys(me).should.deepEqual(Object.keys(current))
        me.count.should.equal(current.count)
        me.lastpage.should.equal(current.lastpage + 1)
        /* Current version doesn't understand 0b00 syntax. It defaults to 10 results a page. This affects lastpage returned by it.
        me.results.length.should.equal(current.results.length)
        */
      })
      it('should convert hexadecimals to base 10 when given hexidecimal n', async function () {
        (await get('/peoplesearch?q=last%20beginswith%20pi&n=0x2')).results.length.should.equal(2)
      })
      it('should return the same-ish result as current if n is a binary value', async function () {
        const [me, current] = await Promise.all([
          get('/peoplesearch?q=last%20beginswith%20pil&n=0x2'),
          get('https://secure.its.txstate.edu/iphone/people/jwt.pl?q=last%20beginswith%20pil&n=0x2')
        ])
        Object.keys(me).should.deepEqual(Object.keys(current))
        me.count.should.equal(current.count)
        me.lastpage.should.equal(current.lastpage + 1)
        /* Current version doesn't understand 0b00 syntax. It defaults to 10 results a page. This affects lastpage returned by it.
        me.results.length.should.equal(current.results.length)
        */
      })
      it('should default to all results when given non-numeric n', async function () {
        (await get('/peoplesearch?q=last%20beginswith%20pil&n=a17')).results.length.should.equal(3)
      })
      it('should return the same result as current if n is given a non-numeric value', async function () {
        const [me, current] = await Promise.all([
          get('/peoplesearch?q=last%20beginswith%20pil&n=a17'),
          get('https://secure.its.txstate.edu/iphone/people/jwt.pl?q=last%20beginswith%20pil&n=a17')
        ])
        Object.keys(me).should.deepEqual(Object.keys(current))
        me.count.should.equal(current.count)
        me.lastpage.should.equal(current.lastpage)
        me.results.length.should.equal(current.results.length) // Current version defaults to 10 results a page, as does me.
      })
      it('should default to all results when given n <= 0', async function () {
        (await get('/peoplesearch?q=last%20beginswith%20pil&n=-1')).results.length.should.equal(3)
      })
      it('should return the same-ish result as current if n <= 0', async function () {
        const [me, current] = await Promise.all([
          get('/peoplesearch?q=last%20beginswith%20pil&n=-1'),
          get('https://secure.its.txstate.edu/iphone/people/jwt.pl?q=last%20beginswith%20pil&n=-1')
        ])
        Object.keys(me).should.deepEqual(Object.keys(current))
        me.count.should.equal(current.count)
        // Current version doesn't handle negative n and usues negative value to ciel(hitCount/n).
        me.lastpage.should.equal(current.lastpage + 3) // Since 3/-1 is -3 ciel'd to -2 we need to offset to get same-ish of 1.
        // me.results.length.should.equal(current.results.length) // No results returned by current due to negative n passed.
      })
      it('should not default to lastname when given a valid sort option', async function () {
        (await get('/peoplesearch?q=last%20beginswith%20pil&sort=firstname')).results.should.not.be.sortedOn('lastname')
      })
      it('should return the same-ish result as current when given the same sort option', async function () {
        const [me, current] = await Promise.all([
          get('/peoplesearch?q=last%20beginswith%20pil&sort=firstname'),
          get('https://secure.its.txstate.edu/iphone/people/jwt.pl?q=last%20beginswith%20pil&sort=firstname')
        ])
        Object.keys(me).should.deepEqual(Object.keys(current))
        me.count.should.equal(current.count)
        me.lastpage.should.equal(current.lastpage)
        me.results.length.should.equal(current.results.length)
        // Current doesn't accept sort option.
        // me.results.should.be.sortedOn('firstname').should.be.equal(current.results.should.be.sortedOn('firstname'))
      })
      it('should default to lastname when given an invalid sort', async function () {
        (await get('/peoplesearch?q=last%20beginswith%20pil&sort=fwirstname')).results.should.be.sortedOn('lastname')
      })
      // No sense in continuing to run sort comparisons when Current doesn't accept a sort in kind to compare against.
      it('should handle non-valid terms gracefully', async function () {
        (await get('/peoplesearch?q=lorstname%20beginswith%20pil')).results.length.should.equal(0)
        // I noticed our current system returns lastpage:0 for this but 1 for no query.
      })
      it('should return the same result as current when given non-valid terms to search for', async function () {
        const [me, current] = await Promise.all([
          get('/peoplesearch?q=lorst%20beginswith%20pil'),
          get('https://secure.its.txstate.edu/iphone/people/jwt.pl?q=lorst%20beginswith%20pil')
        ])
        Object.keys(me).should.deepEqual(Object.keys(current))
        me.count.should.equal(current.count)
        me.lastpage.should.equal(current.lastpage)
        me.results.length.should.equal(current.results.length)
      })
      it('should handle non-valid likeOps gracefully', async function () {
        (await get('/peoplesearch?q=nor%20lastname%20beginswith%20pil')).results.length.should.equal(0)
      })
      it('should return the same result as current when given non-valid likeOps to search for', async function () {
        const [me, current] = await Promise.all([
          get('/peoplesearch?q=nor%20last%20beginswith%20pil'),
          get('https://secure.its.txstate.edu/iphone/people/jwt.pl?q=nor%20last%20beginswith%20pil')
        ])
        Object.keys(me).should.deepEqual(Object.keys(current))
        me.count.should.equal(current.count)
        me.lastpage.should.equal(current.lastpage)
        me.results.length.should.equal(current.results.length)
      })
      it('should handle non-valid wildCardOps gracefully', async function () {
        (await get('/peoplesearch?q=lastname%20begornswith%20pil')).results.length.should.equal(0)
      })
      it('should return the same result as current when given non-valid wildCardOps to search for', async function () {
        const [me, current] = await Promise.all([
          get('/peoplesearch?q=last%20begornswith%20pil'),
          get('https://secure.its.txstate.edu/iphone/people/jwt.pl?q=last%20begornswith%20pil')
        ])
        Object.keys(me).should.deepEqual(Object.keys(current))
        me.count.should.equal(current.count)
        me.lastpage.should.equal(current.lastpage)
        me.results.length.should.equal(current.results.length)
      })
      it('should handle single argument (non-advanced)', async function () {
        (await get('/peoplesearch?q=Wing')).results.length.should.equal(1)
      })
      it('should return the same result as current when given non-advanced, single word, q to search for', async function () {
        const [me, current] = await Promise.all([
          get('/peoplesearch?q=Wing'),
          get('https://secure.its.txstate.edu/iphone/people/jwt.pl?q=Wing')
        ])
        Object.keys(me).should.deepEqual(Object.keys(current))
        me.count.should.equal(current.count)
        me.lastpage.should.equal(current.lastpage)
        me.results.length.should.equal(current.results.length)
      })
      it('should handle searches for q case insensitively', async function () {
        const [me, meToo] = await Promise.all([
          get('/peoplesearch?q=Nick Wing'),
          get('/peoplesearch?q=nICK wING')
        ])
        me.should.deepEqual(meToo)
      })
      it('should return the same result as current when given non-advanced, multiple word, q to search for', async function () {
        const [me, meToo, current, currentToo] = await Promise.all([
          get('/peoplesearch?q=Nick%20Wing'),
          get('/peoplesearch?q=Wing%20Nick'),
          get('https://secure.its.txstate.edu/iphone/people/jwt.pl?q=Nick%20Wing'),
          get('https://secure.its.txstate.edu/iphone/people/jwt.pl?q=Wing%20Nick')
        ])
        me.should.deepEqual(meToo)
        current.should.deepEqual(currentToo)
        Object.keys(me).should.deepEqual(Object.keys(current))
        me.count.should.equal(current.count)
        me.lastpage.should.equal(current.lastpage)
        me.results.length.should.equal(current.results.length)
      })
    })
    // ======================================================================================================
    /* describe('counter', function () {
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
    }) */
  })
})
