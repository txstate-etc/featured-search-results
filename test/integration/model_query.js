require('should')
const moment = require('moment')
const db = require('txstate-node-utils/lib/db')
const Query = require('../../models/query')

describe('integration', function() {
  describe('model', function() {
    describe('query', function() {
      const query = new Query()
      before(async function () {
        await db.connect()
        await Query.deleteMany()
        query.query = 'texas state university'
        for (i = 12; i > 0; i--) query.hits.push(moment().subtract(i, 'month'))
      })
      it('should save successfully', function () {
        return query.save()
      })
      it('should retrieve one record after saving', async function () {
        (await Query.find()).length.should.equal(1)
      })
      it('should delete hits older than 6 months upon calling cleanup', async function () {
        await Query.cleanup()
        const expires = moment().subtract(6, 'month')
        const queries = await Query.find()
        queries.length.should.be.greaterThan(0)
        for (const query of queries) {
          query.hits.length.should.be.greaterThan(0)
          query.hits.length.should.be.lessThan(8)
          for (const hit of query.hits) {
            moment(hit).isAfter(expires).should.be.true()
          }
        }
      })
      it('should remove entries that have no hits in the last 6 months upon calling cleanup', async function () {
        const oldquery = new Query()
        oldquery.query = 'bobcats'
        oldquery.hits.push(moment().subtract(8,'month'))
        await oldquery.save()
        let queries = await Query.find()
        queries.length.should.equal(2)
        await Query.cleanup();
        queries = await Query.find()
        queries.length.should.equal(1)
      })
      after(function() {
        return db.disconnect()
      })
    })
  })
})
