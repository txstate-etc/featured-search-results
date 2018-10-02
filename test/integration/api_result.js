require('should')
var db = require('node-api-utils').db
var util = require('node-api-utils').util
var Result = require('../../models/result')
var axios = require('axios')
const https = require('https')

const agent = new https.Agent({
  rejectUnauthorized: false
})
var api_path = 'https://'+process.env.API_HOST
var get = async function(endpoint) {
  return (await axios.get(api_path+endpoint, {httpsAgent: agent})).data
}
var post = async function(endpoint, payload) {
  return await axios.post(api_path+endpoint, payload, {httpsAgent: agent})
}
var hold_until_service_up = async function(endpoint) {
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
        await db.disconnect()
        await hold_until_service_up('/results')
      })
      it('should accept our result', async function() {
        (await post('/result', result)).status.should.equal(200)
      })
      it('should return one result on /results', async function() {
        var results = (await get('/results'))
        results.length.should.equal(1)
        id = results[0].id
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
    })
  })
})
