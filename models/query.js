const mongoose = require('mongoose')
const moment = require('moment')
const Schema = mongoose.Schema

const QuerySchema = new Schema({
  query: String,
  hits: [Date],
  results: [{
    title: String,
    url: String
  }]
})

QuerySchema.index({'query': 1})

// we always push later dates on the end of hits, so hits[0] is the minimum and the 
// only index we need - luckily mongo supports this with dot notation
QuerySchema.index({'hits.0': 1})

QuerySchema.methods.basic = function () {
  return {
    query: this.query,
    hits: this.hits.length,
    lasthit: this.hits[this.hits.length-1],
    results: this.results
  }
}

QuerySchema.statics.record = async function (query, results) {
  const Query = this
  return await Query.findOneAndUpdate({ query: query }, {$set: {results: results}, $push: {hits: new Date()}}, {upsert: true})
}

QuerySchema.statics.cleanup = async function () {
  const Query = this
  const expires = moment().subtract(6, 'month')
  await Query.update(
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
