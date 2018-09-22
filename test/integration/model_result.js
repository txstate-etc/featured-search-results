require('should')
var db = require('node-api-utils').db
var Result = require('../../models/result')

describe('integration', function() {
  describe('model', function() {
    describe('result', function() {
      var result = new Result()
      before(async function () {
        await db.connect()
        await Result.remove()
        result.fromJson({
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
        })
      })
      it('should save successfully', function () {
        return result.save()
      })
      it('should retrieve one record after saving', async function () {
        (await Result.find()).length.should.equal(1)
      })
      it('should not get anything from database when no matching words are present', async function() {
        (await Result.getByQuery(['oklahoma'])).length.should.equal(0)
      })
      it('should not get anything from database when one of three matching words is present', async function() {
        (await Result.getByQuery(['texas'])).length.should.equal(0)
      })
      it('should not get anything from database when two of three matching words are present', async function() {
        (await Result.getByQuery(['university','state'])).length.should.equal(0)
      })
      it('should not get anything from database when two words are present and only one matches', async function() {
        (await Result.getByQuery(['oklahoma','state'])).length.should.equal(0)
      })
      it('should not get anything from database when three words are present and only two match', async function() {
        (await Result.getByQuery(['university','state','oklahoma'])).length.should.equal(0)
      })
      it('should be case insensitive', async function() {
        (await Result.findByQuery('bObCAt VILLagE')).length.should.equal(1)
      })
      it('should return results when query words are given as lower case', async function() {
        (await Result.findByQuery('bobcat village')).length.should.equal(1)
      })
      it('should not return results when mode is exact and query has an extra word', async function() {
        (await Result.findByQuery('bobcat village apartments')).length.should.equal(0)
      })
      it('should return results when mode is phrase and query is an exact match', async function() {
        (await Result.findByQuery('texas state homepage')).length.should.equal(1)
      })
      it('should not return results when mode is phrase and words are missing from the query', async function() {
        (await Result.findByQuery('homepage')).length.should.equal(0)
      })
      it('should return results when mode is phrase and query has an extra word at the end', async function() {
        (await Result.findByQuery('texas state homepage links')).length.should.equal(1)
      })
      it('should return results when mode is phrase and query has an extra word at the beginning', async function() {
        (await Result.findByQuery('show texas state homepage')).length.should.equal(1)
      })
      it('should return results when mode is phrase and query has an extra word inserted', async function() {
        (await Result.findByQuery('texas state full homepage')).length.should.equal(1)
      })
      it('should return results when mode is phrase and query has an extra word inserted in two places', async function() {
        (await Result.findByQuery('texas bobcats state full homepage')).length.should.equal(1)
      })
      it('should not return results when mode is phrase and query is out of order', async function() {
        (await Result.findByQuery('texas homepage state')).length.should.equal(0)
      })
      it('should return results when mode is keyword and query is out of order', async function() {
        (await Result.findByQuery('texas university state')).length.should.equal(1)
      })
      it('should return results when mode is keyword and query is out of order with extra words', async function() {
        (await Result.findByQuery('show texas full university bobcats state')).length.should.equal(1)
      })
      after(function() {
        return db.disconnect()
      })
    })
  })
})
