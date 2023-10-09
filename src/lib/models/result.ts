/** In the parlance of Search-Featured-Results a `result` is an associative object that searches
 * can be compared against for correlated url:title pairs to be ranked and returned. The search
 * queries are compared against `result` objects' lists of corresponding `entries` (or "alias"
 * associations) and ranked based on how strongly the `priority` of the associations correlate
 * the query to their parent `result` record.
 *
 * Below we model two primary interface paths for result objects. One is the Mongoose model
 * for storage and efficient retrieval from a Mongo database. These interfaces begin their names
 * with the letter 'I'. The second interface path is for the front end API to be able to recieve
 * and manipulate the result data for API consumers. We do duplicate fields between the two paths
 * and we are fine with that as we want the Mongoose needs decoupled from the front end needs. */

import axios from 'axios'
import { DateTime } from 'luxon'
import { type Model, model, Schema, type Document, type ObjectId } from 'mongoose'
import { isBlank, sortby, eachConcurrent } from 'txstate-utils'
import { querysplit } from '../util/helpers.js'
import type { QueryDocument } from './query.js'

export type ResultModes = 'keyword' | 'phrase' | 'exact'

export interface ResultEntry {
  /** Space delimited list of words to associate with the URL based on the `mode`. */
  keyphrase: string
  mode: ResultModes
  /** Preferably a percentage, expressed as an integer, of how strongly the keywords associate to the parent featured Result. */
  priority: number
}

export interface ResultEntryWithCount extends ResultEntry {
  count: number
}

export interface ResultBasic {
  url: string
  title: string
}

export interface ResultBasicPlusId extends ResultBasic {
  id: string
}
export interface ResultFull extends ResultBasicPlusId {
  brokensince: Date
  entries: ResultEntry[]
  tags: string[]
}

export interface ResultFullWithCount extends ResultFull {
  entries: ResultEntryWithCount[]
}

export type ResultDocument = Document<ObjectId> & IResult & IResultMethods

export type ResultDocumentWithQueries = ResultDocument & {
  queries: QueryDocument[]
}

interface IResultMethods {
  basic: () => ResultBasic
  basicPlusId: () => ResultBasicPlusId
  outentries: () => ResultEntry[]
  full: () => ResultFull
  fullWithCount: () => ResultFullWithCount
  /** Returns a `result`'s `entries` sorted by their decending `priority`. */
  sortedEntries: () => IResultEntry[]
  match: (words: string[], wordset: Set<string>, wordsjoined: string) => number | undefined
  fromJson: (input: any) => void
  hasEntry: (entry: IResultEntry) => boolean
  hasTag: (tag: string) => boolean
  valid: () => boolean
  currencyTest: () => Promise<void>
}

interface ResultModel extends Model<IResult, any, IResultMethods> {
  getAllWithQueries: () => Promise<ResultDocumentWithQueries[]>
  getWithQueries: (id: string) => Promise<ResultDocumentWithQueries>
  /** Returns cursor to all results with `keywords` that start with any of the `words`. */
  getByQuery: (words: string[]) => Promise<ResultDocument[]>
  findByQuery: (query?: string) => Promise<ResultDocument[]>
  currencyTestAll: () => Promise<void>
  currencyTestLoop: () => Promise<void>
}

/** Inteface for MongoDB storage of the `result` collection. */
interface IResult {
  url: string
  title: string
  /** Currency is whether the URL associated with the `result` doesn't get a 200 response on tests.
   * TODO - Detect Redirects as well. */
  currency: {
    broken: boolean
    tested: Date
    brokensince: Date
    // isRedirect: boolean
  }
  entries: IResultEntry[]
  tags: string[]
}
/** Inteface for MongoDB storage of alias `entries` within the MongoDB `result` collection.
 * Note that the `keyphrase: string` of `ResultEntry` is broken into `keywords: string[]`
 * to allow for more efficient indexing by Mongoose. */
interface IResultEntry {
  keywords: string[]
  mode: ResultModes
  priority: number
}

const ResultSchema = new Schema<IResult, ResultModel, IResultMethods>({
  url: { type: String, unique: true },
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
  return {
    id: this._id.toString(),
    ...this.basic()
  }
}

/** Gets a list of all the alias `entries` of a parent `result` object. */
ResultSchema.methods.outentries = function () {
  const outentries = []
  for (const entry of this.sortedEntries()) {
    outentries.push({
      keyphrase: entry.keywords.join(' '),
      mode: entry.mode,
      priority: entry.priority ?? 0
    })
  }
  return outentries
}

ResultSchema.methods.full = function () {
  const info = this.basicPlusId()
  const entries = this.outentries()
  return {
    ...info,
    brokensince: this.currency.brokensince,
    entries,
    /* Can't find any references to use this so commenting out to cut wasted
       processing as well as keep it from being a source of crossed references bugs.
    priority: this.priority ?? Math.max(...entries.map(e => e.priority)), */
    tags: this.tags
  }
}

ResultSchema.methods.fullWithCount = function () {
  const info = this.full()
  const ret: ResultFullWithCount = {
    ...info,
    entries: info.entries.map(e => ({ ...e, count: 0 }))
  }
  for (const query of this.queries) {
    const words = querysplit(query.query)
    const [wordset, wordsjoined] = wordsProcessed(words)
    for (let i = 0; i < info.entries.length; i++) {
      if (entryMatch(this.entries[i], words, wordset, wordsjoined)) {
        ret.entries[i].count += query.hits.length
        break
      }
    }
  }
  return ret
}

function wordsProcessed (words: string[], wordset?: Set<string>, wordsjoined?: string) {
  return [
    wordset || new Set(words),
    wordsjoined || words.join(' ')
  ] as const
}

const entryMatch = function (entry: IResultEntry, words: string[], wordset: Set<string>, wordsjoined: string) {
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
  this.url = input.url.trim()
  this.title = input.title.trim()
  this.tags = []
  this.entries = []
  for (const entry of input.entries) {
    const lcmode = entry.mode.toLowerCase()
    const mode = ['keyword', 'phrase', 'exact'].includes(lcmode) ? lcmode : 'keyword'
    const words = querysplit(entry.keyphrase)
    if (words.length > 0) {
      this.entries.push({
        keywords: words,
        mode,
        // May want to bring back the rool level priority in `full` above. Seems other services
        // may depend on being able to pass old root level priority to this API.
        priority: entry.priority || 1 - (input.priority || 1)
      })
    }
  }
  for (const tag of input.tags || []) {
    if (!isBlank(tag)) this.tags.push(tag.toLowerCase().trim())
  }
}

ResultSchema.methods.hasEntry = function (entry) {
  const eKeys = entry.keywords.join()
  for (const e of this.entries) {
    if (e.mode === entry.mode && e.keywords.join() === eKeys) return true
  }
  return false
}

ResultSchema.methods.hasTag = function (tag) {
  return this.tags.includes(tag)
}

ResultSchema.methods.valid = function () {
  if (this.entries.length === 0) return false
  if (isBlank(this.title)) return false
  if (isBlank(this.url)) return false
  if (!this.url.match(/^(\w+:)?\/\//i)) return false
  return true
}

ResultSchema.statics.getAllWithQueries = async function () {
  return this.find().populate('queries')
}

ResultSchema.statics.getWithQueries = async function (id) {
  return this.findById(id).populate('queries')
}

ResultSchema.statics.getByQuery = async function (words: string[]) {
  // TODO: Need to learn `$or` in find query syntax.
  const ret = await this.find({
    $or: words.map(w => ({
      'entries.keywords': { $regex: '^' + w }
    }))
  })
  return ret
}

ResultSchema.statics.findByQuery = async function (query) {
  if (isBlank(query)) return []
  const words = querysplit(query)
  const results = await this.getByQuery(words) as (ResultDocument & { priority?: number })[]
  const [wordset, wordsjoined] = wordsProcessed(words)
  for (const r of results) r.priority = r.match(words, wordset, wordsjoined)
  const filteredresults = results.filter(r => r.priority != null)
  return sortby(filteredresults, 'priority', true, 'title')
}

ResultSchema.methods.currencyTest = async function () {
  try {
    let alreadypassed = false
    if (this.url.includes('txstate.edu')) {
      try {
        const newUrl = this.url.replace(/txstate\.edu/, 'txst.edu')
        await axios.get(newUrl, { timeout: 5000 })
        this.url = newUrl
        alreadypassed = true
      } catch (e) {
        // can't switch to txst.edu yet
      }
    }
    if (!alreadypassed) await axios.get(this.url, { timeout: 5000 })
    this.currency.broken = false
    this.currency.brokensince = null
  } catch (e) {
    if (!this.currency.broken) this.currency.brokensince = new Date()
    this.currency.broken = true
  }
  this.currency.tested = new Date()
  try {
    await this.save()
  } catch (e) {
    console.log(e)
  }
}

ResultSchema.statics.currencyTestAll = async function () {
  const results = await this.find({
    $or: [{
      'currency.tested': { $lte: DateTime.local().minus({ days: 1 }).toJSDate() }
    }, {
      'currency.tested': { $exists: false }
    }]
  }) as ResultDocument[]
  await eachConcurrent(results, async result => { await result.currencyTest() })
}

ResultSchema.statics.currencyTestLoop = async function () {
  try {
    await this.currencyTestAll()
  } catch (e) {
    console.log(e)
  }
  setTimeout(() => { this.currencyTestLoop().catch(console.error) }, 600000)
}

export const Result = model<IResult, ResultModel>('Result', ResultSchema)
