var mongoose = require('mongoose')
var Schema = mongoose.Schema
var helpers = require('../lib/helpers.js')

var ResultSchema = new Schema({
  url: String,
  title: String,
  entries: [{
    keywords: [String],
    mode: {
      type: String,
      enum: ['keyword', 'phrase', 'exact']
    }
  }],
  tags: [String]
})

ResultSchema.index({'entries.keywords': 1})

ResultSchema.methods.basic = function () {
  var info = {
    url: this.url,
    title: this.title
  }
  return info
}

ResultSchema.methods.outentries = function () {
  var outentries = []
  for (var entry of this.entries) {
    outentries.push({
      keyphrase: entry.keywords.join(' '),
      mode: entry.mode
    })
  }
  return outentries
}

ResultSchema.methods.full = function () {
  var info = {
    id: this._id.toString(),
    url: this.url,
    title: this.title,
    entries: this.outentries(),
    tags: this.tags
  }
  return info
}

ResultSchema.methods.match = function (words, wordset, wordsjoined) {
  // given a query string, determine whether this entry is a match
  // after accounting for mode
  if (!wordset) wordset = new Set(words)
  if (helpers.isBlank(wordsjoined)) wordsjoined = words.join(' ')
  for (var entry of this.entries) {
    if (entry.mode == 'exact') {
      if (wordsjoined === entry.keywords.join(' ')) return true
    } else if (entry.mode == 'phrase') {
      var index = 0;
      for (var word of words) {
        if (word == entry.keywords[index]) index++
      }
      if (index == entry.keywords.length) return true
    } else { // entry.mode == 'keyword'
      var count = 0
      for (var keyword of entry.keywords) {
        if (wordset.has(keyword)) count++
      }
      if (count == entry.keywords.length) return true
    }
  }
  return false
}

ResultSchema.methods.fromJson = function (input) {
  var result = this
  result.url = input.url
  result.title = input.title
  result.tags = input.tags
  result.entries = []
  for (var entry of input.entries) {
    var lcmode = entry.mode.toLowerCase()
    var mode = ['keyword','phrase','exact'].includes(lcmode) ? lcmode : 'keyword'
    var keyphrase = entry.keyphrase.toLowerCase()
    var words = helpers.querysplit(keyphrase)
    result.entries.push({
      keywords: words,
      mode: mode
    })
  }
}

ResultSchema.statics.findByQuery = async function (query) {
  var words = helpers.querysplit(query)
  var results = await this.find({'entries': {$not: {$elemMatch: {'keywords': { $elemMatch: {$nin : words}}}}}})
  var wordset = new Set(words)
  var wordsjoined = words.join(' ')
  return results.filter(result => result.match(words, wordset, wordsjoined))
}

module.exports = mongoose.model('Result', ResultSchema)
