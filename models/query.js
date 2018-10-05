var mongoose = require('mongoose')
var Schema = mongoose.Schema

var QuerySchema = new Schema({
  query: String,
  hits: [Date],
  results: [{
    title: String,
    url: String
  }]
})

QuerySchema.index({'query': 1})

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

module.exports = mongoose.model('Query', QuerySchema)
