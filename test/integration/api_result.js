require('should')
const db = require('node-api-utils').db
const util = require('node-api-utils').util
const Result = require('../../models/result')
const Query = require('../../models/query')
const axios = require('axios')
const https = require('https')
const moment = require('moment')

const agent = new https.Agent({
  rejectUnauthorized: false
})
const api_path = 'https://'+process.env.API_HOST
const get = async function(endpoint, skipSecret = false) {
  const headers = {}
  if (!skipSecret) headers['X-Secret-Key'] = process.env.FEATURED_SECRET
  return (await axios.get(api_path+endpoint, {httpsAgent: agent, headers: headers})).data
}
const post = async function(endpoint, payload, skipSecret = false) {
  const headers = {}
  if (!skipSecret) headers['X-Secret-Key'] = process.env.FEATURED_SECRET
  return await axios.post(api_path+endpoint, payload, {httpsAgent: agent, headers: headers})
}
const hold_until_service_up = async function(endpoint) {
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

describe('integration', function() {
  describe('api', function() {
    describe('result', function() {
      var id;
      var result = {
        url: "http://txstate.edu",
        title: "Texas State University Homepage",
        entries: [
          {
            keyphrase: "Bobcat Village",
            mode: "exact"
          },{
            keyphrase: "Texas State Homepage",
            mode: "phrase"
          },{
            keyphrase: "Texas State University",
            mode: "keyword"
          }
        ],
        tags: ["marketing"]
      }
      before(async function () {
        await db.connect()
        await Result.deleteMany()
        await Query.deleteMany()
        await db.disconnect()
        await hold_until_service_up('/results')
      })
      it('should return 401 instead of accepting our result if X-Secret-Key header is absent', async function () {
        await post('/result', result, true).should.be.rejectedWith({response: {status: 401}})
      })
      it('should accept our result', async function() {
        (await post('/result', result)).status.should.equal(200)
      })
      it('should return one result on /results', async function() {
        var results = (await get('/results'))
        results.length.should.equal(1)
        id = results[0].id
      })
      it('should not require a secret to perform a search', async function() {
        (await get('/search', true)).should.be.an.Array
      })
      it('should be case insensitive', async function() {
        (await get('/search?q=bObCAt VILLagE')).length.should.equal(1)
      })
      it('should return results when query words are given as lower case', async function() {
        (await get('/search?q=bobcat village')).length.should.equal(1)
      })
      it('should not return results when mode is exact and query has an extra word', async function() {
        (await get('/search?q=bobcat village apartments')).length.should.equal(0)
      })
      it('should return results when mode is phrase and query is an exact match', async function() {
        (await get('/search?q=texas state homepage')).length.should.equal(1)
      })
      it('should not return results when mode is phrase and words are missing from the query', async function() {
        (await get('/search?q=homepage')).length.should.equal(0)
      })
      it('should return results when mode is phrase and query has an extra word at the end', async function() {
        (await get('/search?q=texas state homepage links')).length.should.equal(1)
      })
      it('should return results when mode is phrase and query has an extra word at the beginning', async function() {
        (await get('/search?q=show texas state homepage')).length.should.equal(1)
      })
      it('should return results when mode is phrase and query has an extra word inserted', async function() {
        (await get('/search?q=texas state full homepage')).length.should.equal(1)
      })
      it('should return results when mode is phrase and query has an extra word inserted in two places', async function() {
        (await get('/search?q=texas bobcats state full homepage')).length.should.equal(1)
      })
      it('should not return results when mode is phrase and query is out of order', async function() {
        (await get('/search?q=texas homepage state')).length.should.equal(0)
      })
      it('should return results when mode is keyword and query is out of order', async function() {
        (await get('/search?q=texas university state')).length.should.equal(1)
      })
      it('should return results when mode is keyword and query is out of order with extra words', async function() {
        (await get('/search?q=show texas full university bobcats state')).length.should.equal(1)
      })
      it('should be able to retrieve a record by id', async function() {
        (await get('/result/'+id)).id.should.equal(id)
      })
      it('should not return an id in the search results', async function () {
        should.not.exist((await get('/search?q=bobcat village'))[0].id)
      })
      it('should return 3 entries in the full info', async function () {
        (await get('/result/'+id)).entries.length.should.equal(3)
      })
      it('should have recorded our queries while searching', async function () {
        const queries = await get('/queries')
        queries.length.should.be.greaterThan(0)
        for (const query of queries) {
          query.hits.should.be.greaterThan(0)
          moment(query.lasthit).isAfter(moment().subtract(1,'hour')).should.be.true()
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
  })
})
