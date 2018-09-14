require('should')
var db = require('../../lib/db')
var Result = require('../../models/result')
var axios = require('axios')

var api_path = 'http://'+process.env.API_HOST
var get = async function(endpoint) {
  return await axios.get(api_path+endpoint)
}
var post = async function(endpoint, payload) {
  return await axios.post(api_path+endpoint, payload)
}
var hold_until_service_up = async function(endpoint) {
  for (var i = 0; i < 100; i++) {
    try {
      await get(endpoint)
      break
    } catch (e) {
      // keep trying until we get to 100
    }
  }
}

describe('integration', function() {
  describe('api', function() {
    describe('result', function() {
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
        await Result.remove()
        await db.disconnect()
        await hold_until_service_up('/results')
      })
      it('should accept our result', async function() {
        (await post('/result', result)).status.should.equal(200)
      })
    })
  })
})
