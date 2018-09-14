require('should')
var db = require('../../lib/db')
var Result = require('../../models/result')

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
      })
      it('should accept our result', function() {
        true.should.be.true()
      })
    })
  })
})
