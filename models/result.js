const mongoose = require('mongoose')
const Schema = mongoose.Schema
const helpers = require('../lib/helpers')
const util = require('txstate-node-utils/lib/util')
const moment = require('moment')
const axios = require('axios')
const { sortby } = require('txstate-utils')

const ResultSchema = new Schema({
  url: String,
  title: String,
  priority: Number,
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
    },
    priority: { type: Number }
  }],
  tags: [String]
})
ResultSchema.virtual('queries', {
  ref: 'Query',
  localField: '_id',
  foreignField: 'results'
})

ResultSchema.index({ 'entries.keywords': 1 })
ResultSchema.index({ 'currency.tested': 1 })

ResultSchema.methods.basic = function () {
  return {
    url: this.url,
    title: this.title
  }
}

ResultSchema.methods.basicPlusId = function () {
  const info = this.basic()
  info.id = this._id.toString()
  return info
}

ResultSchema.methods.outentries = function () {
  const outentries = []
  for (const entry of this.entries) {
    outentries.push({
      keyphrase: entry.keywords.join(' '),
      mode: entry.mode
    })
  }
  return outentries
}

ResultSchema.methods.full = function () {
  const info = this.basicPlusId()
  info.brokensince = this.currency.brokensince
  info.priority = this.priority
  info.entries = this.outentries()
  info.tags = this.tags
  return info
}

ResultSchema.methods.fullWithCount = function () {
  const info = this.full()
  for (const entry of info.entries) entry.count = 0
  for (const query of this.queries) {
    const words = helpers.querysplit(query.query)
    const [wordset, wordsjoined] = wordsProcessed(words)
    for (let i = 0; i < info.entries.length; i++) {
      if (entryMatch(this.entries[i], words, wordset, wordsjoined)) {
        info.entries[i].count += query.hits.length
        break
      }
    }
  }
  return info
}

const wordsProcessed = function (words, wordset, wordsjoined) {
  return [
    wordset || new Set(words),
    wordsjoined || words.join(' ')
  ]
}

const entryMatch = function (entry, words, wordset, wordsjoined) {
  // given a query string, determine whether this entry is a match
  // after accounting for mode
  [wordset, wordsjoined] = wordsProcessed(words, wordset, wordsjoined)
  if (entry.mode === 'exact') {
    if (entry.keywords.length === words.length && entry.keywords.join(' ').startsWith(wordsjoined)) return true
  } else if (entry.mode === 'phrase') {
    let count = 0
    let prefixcount = 0
    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      if (word === entry.keywords[count]) {
        count++
        prefixcount = 0
      } else if (i === words.length - 1 && entry.keywords[count]?.startsWith(word)) prefixcount++
    }
    if (count === entry.keywords.length || (count === entry.keywords.length - 1 && prefixcount === 1)) return true
  } else { // entry.mode == 'keyword'
    let count = 0
    let prefixcount = 0
    for (const keyword of entry.keywords) {
      if (wordset.has(keyword)) count++
      else if (words.some(w => keyword.startsWith(w))) prefixcount++
    }
    if (count === entry.keywords.length || (count === entry.keywords.length - 1 && prefixcount === 1)) return true
  }

  return false
}

ResultSchema.methods.sortedEntries = function () {
  this._sortedEntries ??= sortby([...this.entries], 'priority', true)
  return this._sortedEntries
}

ResultSchema.methods.match = function (words, wordset, wordsjoined) {
  [wordset, wordsjoined] = wordsProcessed(words, wordset, wordsjoined)
  for (const entry of this.sortedEntries()) {
    if (entryMatch(entry, words, wordset, wordsjoined)) return entry.priority ?? 0
  }
  return undefined
}

ResultSchema.methods.fromJson = function (input) {
  const result = this
  result.url = input.url.trim()
  result.title = input.title.trim()
  result.tags = []
  result.entries = []
  for (const entry of input.entries) {
    const lcmode = entry.mode.toLowerCase()
    const mode = ['keyword', 'phrase', 'exact'].includes(lcmode) ? lcmode : 'keyword'
    const words = helpers.querysplit(entry.keyphrase)
    if (words.length > 0) {
      result.entries.push({
        keywords: words,
        mode,
        priority: entry.priority || 1 - (input.priority || 1)
      })
    }
  }
  for (const tag of input.tags || []) {
    if (!util.isBlank(tag)) result.tags.push(tag.toLowerCase().trim())
  }
}

ResultSchema.methods.hasEntry = function (entry) {
  for (const e of this.entries) {
    if (e.keywords.join(' ') === entry.keywords.join(' ') && e.mode === entry.mode) return true
  }
  return false
}

ResultSchema.methods.hasTag = function (tag) {
  return this.tags.includes(tag)
}

ResultSchema.methods.valid = function () {
  if (this.entries.length === 0) return false
  if (util.isBlank(this.title)) return false
  if (util.isBlank(this.url)) return false
  if (!this.url.match(/^(\w+:)?\/\//i)) return false
  return true
}

ResultSchema.statics.getAllWithQueries = async function () {
  return this.find().populate('queries')
}

ResultSchema.statics.getWithQueries = async function (id) {
  return this.findById(id).populate('queries')
}

ResultSchema.statics.getByQuery = async function (words) {
  return await this.find({
    $or: words.map(w => ({
      'entries.keywords': { $regex: '^' + w }
    }))
  })
}

ResultSchema.statics.findByQuery = async function (query) {
  if (util.isBlank(query)) return []
  const words = helpers.querysplit(query)
  const results = await this.getByQuery(words)
  const [wordset, wordsjoined] = wordsProcessed(words)
  for (const r of results) r.priority = r.match(words, wordset, wordsjoined)
  const filteredresults = results.filter(r => r.priority != null)
  return sortby(filteredresults, 'priority', true, 'title')
}

ResultSchema.methods.currencyTest = async function () {
  const result = this
  try {
    await axios.get(result.url, { timeout: 5000 })
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

ResultSchema.statics.currencyTestAll = async function () {
  const results = await this.find({
    $or: [{
      'currency.tested': { $lte: moment().subtract(1, 'day') }
    }, {
      'currency.tested': { $exists: false }
    }]
  })
  await Promise.all(results.map((result) => result.currencyTest()))
}

ResultSchema.statics.currencyTestLoop = async function () {
  const Result = this
  try {
    await this.currencyTestAll()
  } catch (e) {
    console.log(e)
  }
  setTimeout(function () { Result.currencyTestLoop() }, 600000)
}

ResultSchema.statics.migratePriority = async function () {
  const results = await this.find({ priority: { $exists: true } })
  for (const result of results) {
    for (const entry of result.entries) {
      entry.priority = 1 - (result.priority || 1)
    }
    result.priority = undefined
    await result.save()
  }
}

module.exports = mongoose.model('Result', ResultSchema)
