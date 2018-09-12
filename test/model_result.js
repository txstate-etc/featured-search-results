require('should')
var Result = require('../models/result')

describe('model', function() {
  describe('result', function() {
    var result = new Result()

    before(function () {
      result.fromJson({
        url: "http://txstate.edu",
        title: "Texas State University Homepage",
        entries: [
          {
            keyphrase: "Texas State",
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
      })
    })
    it('should have the txstate homepage as URL', function() {
      result.url.should.equal("http://txstate.edu")
    })
    it('should have 3 entries', function() {
      result.entries.length.should.equal(3)
    })
    it('should match when query words are given as lower case', function() {
      result.match(['texas','state']).should.be.true()
    })
    it('should enforce exact match on "Texas State"', function() {
      result.match(['texas','state','bobcats']).should.be.false()
    })
    it('should match when mode is phrase and query is an exact match', function() {
      result.match(['texas','state','homepage']).should.be.true()
    })
    it('should match when mode is phrase and query has an extra word at the end', function() {
      result.match(['texas','state','homepage','links']).should.be.true()
    })
    it('should match when mode is phrase and query has an extra word at the beginning', function() {
      result.match(['show','texas','state','homepage']).should.be.true()
    })
    it('should match when mode is phrase and query has an extra word inserted', function() {
      result.match(['texas','state','full','homepage']).should.be.true()
    })
    it('should match when mode is phrase and query has an extra word inserted in two places', function() {
      result.match(['texas','bobcats','state','full','homepage']).should.be.true()
    })
    it('should not match when mode is phrase and query is out of order', function() {
      result.match(['texas','homepage','state']).should.be.false()
    })
    it('should match when mode is keyword and query is out of order', function() {
      result.match(['texas','university','state']).should.be.true()
    })
    it('should match when mode is keyword and query is out of order with extra words', function() {
      result.match(['show','texas','full','university','bobcats','state']).should.be.true()
    })
  })
})
