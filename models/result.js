var mongoose = require('mongoose')
var Schema = mongoose.Schema
var helpers = require('../lib/helpers')
var util = require('node-api-utils').util
const moment = require('moment')
const axios = require('axios')

var ResultSchema = new Schema({
  url: String,
  title: String,
  currency: {
    broken: Boolean,
    tested: Date,
    brokensince: Date
  },
  entries: [{
    keywords: [String],
    mode: {
      type: String,
      enum: ['keyword', 'phrase', 'exact']
    }
  }],
  tags: [String]
})
ResultSchema.virtual('queries', {
  ref: 'Query',
  localField: '_id',
  foreignField: 'results'
})

ResultSchema.index({'entries.keywords': 1})
ResultSchema.index({'currency.tested': 1})

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
    brokensince: this.currency.brokensince,
    entries: this.outentries(),
    tags: this.tags
  }
  return info
}

ResultSchema.methods.fullWithCount = function () {
  const info = this.full()
  info.count = this.queries.length
  return info
}

ResultSchema.methods.match = function (words, wordset, wordsjoined) {
  // given a query string, determine whether this entry is a match
  // after accounting for mode
  if (!wordset) wordset = new Set(words)
  if (util.isBlank(wordsjoined)) wordsjoined = words.join(' ')
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

ResultSchema.statics.getAllWithQueries = async function() {
  return await this.find().populate('queries')
}

ResultSchema.statics.getByQuery = async function (words) {
  return await this.find({'entries': {$elemMatch: {'keywords': {$not: {$elemMatch: {$nin : words}}}}}})
}

ResultSchema.statics.findByQuery = async function (query) {
  var words = helpers.querysplit(query)
  var results = await this.getByQuery(words)
  var wordset = new Set(words)
  var wordsjoined = words.join(' ')
  return results.filter(result => result.match(words, wordset, wordsjoined))
}

ResultSchema.methods.currencyTest = async function () {
  const result = this
  try {
    await axios.get(result.url, {timeout: 5000})
    result.currency.broken = false
    result.currency.brokensince = null
  } catch (e) {
    if (!result.currency.broken) result.currency.brokensince = moment()
    result.currency.broken = true
  }
  result.currency.tested = moment()
  try {
    await result.save()
  } catch (e) {
    console.log(e)
  }
}

ResultSchema.statics.currencyTestAll = async function() {
  const results = await this.find({
    $or: [{
      'currency.tested': {$lte: moment().subtract(1,'day')}
    },{
      'currency.tested': {$exists: false}
    }]
  })
  await Promise.all(results.map((result) => result.currencyTest()))
}

ResultSchema.statics.currencyTestLoop = async function() {
  const Result = this
  try {
    await this.currencyTestAll()
  } catch (e) {
    console.log(e)
  }
  setTimeout(function () { Result.currencyTestLoop() }, 600000)
}

module.exports = mongoose.model('Result', ResultSchema)
