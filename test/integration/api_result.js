/* eslint-disable no-unused-expressions */
/* global before, describe, it, should */
require('should')
// Got fed up with should's documentation not matching what's supported and generally being vague. Importing expect from chai.
const expect = require('chai').expect
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
const fDeepEqual = require('fast-deep-equal')
should.Assertion.add('fDeepEqual', function (compare) {
  this.params = { operator: 'to be fast-deep-equal to' }
  fDeepEqual(this.obj, compare)
}) */
should.Assertion.add('sortedOn', function (property) {
  for (let current = 1, previous = 0; current < this.obj.length; previous = current++) {
    this.obj[current][property].should.be.aboveOrEqual(this.obj[previous][property])
  }
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
  while (true) {
    try {
      await get(endpoint)
      break
    } catch (e) {
      // keep trying until we get to 100
      await util.sleep(150)
    }
  }
}

describe('integration', function () {
  describe('api', function () {
    before(async function () {
      this.timeout(30000)
      await db.connect()
      await Result.deleteMany()
      await Query.deleteMany()
      await Counter.deleteMany()
      await db.disconnect()
      await holdUntilServiceUp('/results')
    })

    describe('result', function () {
      let id
      const result = {
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
        const results = (await get('/results'))
        results.length.should.equal(1)
        id = results[0].id
      })
      it('should not require a secret to perform a search', async function () {
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
      it('should return results when mode is phrase and query has a partial word at the end', async function () {
        (await get('/search?q=texas state homepa')).length.should.equal(1)
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
      it('should return results when mode is keyword and query has a partial word at the end', async function () {
        (await get('/search?q=texas state univ')).length.should.equal(1)
      })
      it('should return results when mode is keyword and query has a partial word at the end out of order', async function () {
        (await get('/search?q=texas university sta')).length.should.equal(1)
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
      it('should return links on the /linkcheck endpoint', async function () {
        const { data } = await client.get('/linkcheck')
        const m = data.matchAll(/<a href/g)
        expect(Array.from(m).length).to.be.greaterThan(0)
      })
    })
    // ======================================================================================================
    describe('peoplesearch', async function () {
      const localBase = '/peoplesearch'

      it('should not require a secret to perform a search', async function () {
        (await get(localBase, true)).should.be.an.Array
      })
      it('should not return a result if nothing is passed', async function () {
        (await get(localBase)).count.should.equal(0)
      })
      it('should convert decimals to integers when given decimal n', async function () {
        (await get(`${localBase}?q=last%20beginswith%20pil&n=1.8`)).results.length.should.equal(2)
      })
      it('should convert binaries to base 10 when given a binary n', async function () {
        (await get(`${localBase}?q=last%20beginswith%20pil&n=0b10`)).results.length.should.equal(2)
      })
      it('should convert octals to base 10 when given octal n', async function () {
        (await get(`${localBase}?q=last%20beginswith%20pil&n=0o2`)).results.length.should.equal(2)
      })
      it('should convert hexadecimals to base 10 when given hexidecimal n', async function () {
        (await get(`${localBase}?q=last%20beginswith%20pi&n=0x2`)).results.length.should.equal(2)
      })
      it('should default to all results when given non-numeric n', async function () {
        (await get(`${localBase}?q=last%20beginswith%20pil&n=a17`)).results.length.should.equal(3)
      })
      it('should default to all results in sets of 10 when given n <= 0', async function () {
        (await get(`${localBase}?q=last%20beginswith%20pil&n=-1`)).results.length.should.equal(3)
      })
      it('should not default to lastname when given a valid sort option', async function () {
        (await get(`${localBase}?q=last%20beginswith%20pil&sort=firstname`)).results.should.not.be.sortedOn('lastname')
      })
      it('should default to lastname when given an invalid sort', async function () {
        (await get(`${localBase}?q=last%20beginswith%20pil&sort=fwirstname`)).results.should.be.sortedOn('lastname')
      })
      // No sense in continuing to run sort comparisons when Current doesn't accept a sort in kind to compare against.
      it('should handle non-valid terms gracefully', async function () {
        (await get(`${localBase}?q=lorstname%20beginswith%20pil`)).results.length.should.equal(0)
        // I noticed our current system returns lastpage:0 for this but 1 for no query.
      })
      it('should handle non-valid likeOps gracefully', async function () {
        (await get(`${localBase}?q=nor%20lastname%20beginswith%20pil`)).results.length.should.equal(0)
      })
      it('should handle non-valid wildCardOps gracefully', async function () {
        (await get(`${localBase}?q=lastname%20begornswith%20pil`)).results.length.should.equal(0)
      })
      it('should handle single argument (non-advanced)', async function () {
        (await get(`${localBase}?q=Wing`)).results.length.should.be.greaterThan(0)
      })
      it('should handle searches for q case insensitively', async function () {
        const [me, meToo] = await Promise.all([
          get(`${localBase}?q=Nick Wing`),
          get(`${localBase}?q=nICK wING`)
        ])
        me.should.deepEqual(meToo)
      })
      it('should take a page number p to specify the page offset of results size n to return', async function () {
        const [fullSet, firstHalf, secondHalf] = await Promise.all([
          get(`${localBase}?q=last%20beginswith%20P&p=1&n=6`),
          get(`${localBase}?q=last%20beginswith%20P&p=1&n=3`),
          get(`${localBase}?q=last%20beginswith%20P&p=2&n=3`)
        ])
        fullSet.results.slice(0, 3).should.deepEqual(firstHalf.results)
        fullSet.results.slice(3).should.deepEqual(secondHalf.results)
      })
      it('should return pronouns for a person with them set', async function () {
        const withPronouns = (await get(`${localBase}?q=userid%20begins%20with%20ad13`)).results[0]
        expect(withPronouns.pronouns).to.be.a('string').lengthOf.greaterThan(4)
      })
      it('should not return pronouns for a person without them set', async function () {
        const withoutPronouns = (await get(`${localBase}?q=lastname%20begins%20with%20pill`)).results[0]
        expect(withoutPronouns.pronouns).to.be.a('string').that.is.empty
      })
      it('should return a properly formatted office address when just the building is known', async function () {
        const addressCheckers = await get(`${localBase}?q=address%20is%20ppa`)
        expect(addressCheckers.results).to.be.an('array').lengthOf.greaterThan(0)
      })
      it('should return a properly formatted office address when building and room are known', async function () {
        const addressCheckers = await get(`${localBase}?q=address%20contains%20'%20'%20and%20address%20begins%20with%20ppa`)
        expect(addressCheckers.results).to.be.an('array').lengthOf.greaterThan(0)
      })
      it('should return a properly formatted office address when no office info is known', async function () {
        const addressCheckers = await get(`${localBase}?q=userid%20is%20gc07`)
        expect(addressCheckers.results[0].address).to.be.a('string').that.is.empty
      })
      it('should return results that include staff', async function () {
        const categoriesTest = await get(`${localBase}?q=category%20begins%20with%20STA`)
        expect(categoriesTest.results).to.be.an('array').lengthOf.greaterThan(0)
      })
      it('should return results that include faculty', async function () {
        const categoriesTest = await get(`${localBase}?q=category%20begins%20with%20FA`)
        expect(categoriesTest.results).to.be.an('array').lengthOf.greaterThan(0)
      })
      it('should return results that include retired', async function () {
        const categoriesTest = await get(`${localBase}?q=category%20begins%20with%20RE`)
        expect(categoriesTest.results).to.be.an('array').lengthOf.greaterThan(0)
      })
      it('should not return results that include student', async function () {
        const categoriesTest = await get(`${localBase}?q=category%20begins%20with%20STU`)
        expect(categoriesTest.results).to.be.an('array').that.is.empty
      })
      it('should return results with a phone value for active staff', async function () {
        const categoriesTest = await get(`${localBase}?q=category%20begins%20with%20STA`)
        expect(categoriesTest.results[0].phone).to.be.a('string').that.is.not.empty
      })
      it('should return results without a phone value for someone not likely to have one (retired)', async function () {
        const categoriesTest = await get(`${localBase}?q=category%20begins%20with%20RE`)
        expect(categoriesTest.results[0].phone).to.be.a('string').that.is.empty
      })
      it('should return results without an office address for someone retired', async function () {
        const categoriesTest = await get(`${localBase}?q=category%20begins%20with%20RE`)
        expect(categoriesTest.results[0].address).to.be.a('string').that.is.empty
      })
      it('should return results with the last known title of someone retired if there is still a record', async function () {
        const categoriesTest = await get(`${localBase}?q=last%20beginswith%20pil%20category%20begins%20with%20RE`)
        expect(categoriesTest.results[0].title).to.be.a('string').that.is.not.empty
      })
      it('should return results with the last known department of someone retired if there is still a record', async function () {
        const categoriesTest = await get(`${localBase}?q=last%20beginswith%20pil%20category%20begins%20with%20RE`)
        expect(categoriesTest.results[0].department).to.be.a('string').that.is.not.empty
      })
      it('should be able to sort by first name', async function () {
        const sortTest = await get(`${localBase}?q=last%20beginswith%20P&n=5&sort=firstname`)
        let last = sortTest.results[0]
        for (const person of sortTest.results) {
          expect(person.firstname.localeCompare(last.firstname)).to.be.greaterThan(-1)
          last = person
        }
      })
    })
    // ======================================================================================================
    describe('departments', async function () {
      it('should return a result of departments referenced by name if nothing is passed', async function () {
        const depts = (await get('/departments'))
        depts.count.should.not.equal(0)
        depts.results[0].should.have.property('name')
      })
      it('should not return a result of departments only belonging to retired entries', async function () {
        const depts = (await get('/departments'))
        expect(depts.results).to.not.deep.include({ name: 'Classroom Technology Support' })
      })
    })
    // ======================================================================================================
    describe('counter', function () {
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
    })
  })
})
