const mongoose = require('mongoose')
const moment = require('moment')
const util = require('node-api-utils').util
const Schema = mongoose.Schema

const QuerySchema = new Schema({
  query: String,
  hits: [Date],
  results: [{ type: Schema.Types.ObjectId, ref: 'Result' }],
  hitcount: Number,
  lasthit: [Date]
})

QuerySchema.index({'query': 1})

// we always push later dates on the end of hits, so hits[0] is the minimum and the
// only index we need - luckily mongo supports this with dot notation
QuerySchema.index({'hits.0': 1})

QuerySchema.methods.basic = function () {
  return {
    query: this.query,
    hits: this.hits.length || this.hitcount,
    lasthit: util.isEmpty(this.lasthit) ? this.hits[this.hits.length-1] : this.lasthit[0],
    results: this.results.map((result) => result.basicPlusId())
  }
}

QuerySchema.statics.record = async function (query, results) {
  const Query = this
  if (util.isBlank(query)) return
  return await Query.findOneAndUpdate({ query: query.toLowerCase().trim() }, {$set: {results: results}, $push: {hits: new Date()}}, {upsert: true})
}

QuerySchema.statics.getAllQueries = async function () {
  const Query = this
  const queries = (await Query.aggregate([
    { $project: {
      query: 1,
      results: 1,
      hitcount: { $size: '$hits' },
      lasthit: { $slice: ['$hits', -1] }
    } },
    { $sort: { 'hitcount': -1 } },
    { $limit: 5000 }
  ])).map(q => new Query(q))
  return Query.populate(queries, 'results')
}

QuerySchema.statics.cleanup = async function () {
  const Query = this
  const expires = moment().subtract(6, 'month')
  await Query.updateMany(
    {'hits.0': {$lte: expires}},
    {$pull: {hits: {$lte: expires}}},
    {multi: true}
  )
  await Query.deleteMany({hits:{$eq: []}})
}

QuerySchema.statics.cleanupLoop = async function () {
  const Query = this
  try {
    await Query.cleanup()
  } catch (e) {
    console.log(e)
  }
  setTimeout(Query.cleanupLoop.bind(Query), 27*60*1000)
}

module.exports = mongoose.model('Query', QuerySchema)
