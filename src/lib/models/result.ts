/* In the parlance of Search-Featured-Results a `Result` is an associative object that searches
 * can be compared against for correlated `url:title` pairs to be ranked and returned. The search
 * queries are compared against the Result documents' lists of corresponding `entries` (or "alias"
 * associations) and ranked based on how strongly the `priority` of the associations correlate
 * the query to the Result document.
 *
 * CURRENCY TESTS:
 * All Result document urls are regularly tested looking for any urls that no longer recieve a
 * 2xx response on a 5 second timeout. If the test fails the Result document is updated to
 * reflect the "broken" state of the url including the timestamp of when it was detected. If a
 * previously broken url resolves with a 2xx response in less than 5 seconds then the broken
 * state of the Result document is reset. Regardless the Result document is updated with the
 * timestamp of the last test. This process is repeated again after a 10 minute interval. */

/* Below we model two primary interface paths for result objects. One is the Mongoose model
 * for storage and efficient retrieval from a Mongo database. These interfaces begin their names
 * with the letter 'I'. The second interface path is for the front end API to be able to recieve
 * and manipulate the result data for API consumers. We do duplicate fields between the two paths
 * and we are fine with that as we want the Mongoose needs decoupled from the front end needs. */

import axios from 'axios'
import { DateTime } from 'luxon'
import mongoose from 'mongoose'
const { Schema, models, model, Error } = mongoose
// const { ValidationError, ValidatorError } = Error
import type { Model, Document, ObjectId } from 'mongoose'
import { isBlank, isNotNull, sortby, eachConcurrent, isNotBlank } from 'txstate-utils'
import { querysplit } from '../util/helpers.js'
import type { QueryDocument } from './query.js'
import { MessageType, type Feedback } from '@txstate-mws/svelte-forms'

export type ResultModes = 'keyword' | 'phrase' | 'exact'
const matchingModes = ['keyword', 'phrase', 'exact']
export interface ValidationError extends Error {
  errors: Record<string, {
    properties: {
      validator: (value: any) => boolean
      message: string
      type: string
      path: string
      value: any
    }
    kind: string
    path: string
    value: any
    reason?: any
  }>
}

/** A `Partial<RawJsonResult>`, with optional `id`, useful for initializing form data from
 * either custom template values or values fetched for editing an existing Result. */
export interface TemplateResult extends Partial<RawJsonResult> {
  id?: string
}

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
  /** Returns an object of just the `title` and `url` of the `Result`. Useful for efficient search hits. */
  basic: () => ResultBasic
  /** Returns an object of the Mongoose generated `id` as a string in addition to `Result`'s `title` and `url`. */
  basicPlusId: () => ResultBasicPlusId
  /** Returns an array of objects sorted by descending `priority` representing all the alias `entries` of
   *  the `Result` as a `keyphrase` string, `mode`, and `priority`. */
  outentries: () => ResultEntry[]
  /** Returns an object composite of `basicPlusId` and `outentries` with `tags` and currency's `brokensince` added. */
  full: () => ResultFull
  /** Returns an object composite of `full` with `entries` getting a `count` property added to them that is the sum
   * of all associated query hits with that entry's `keyphrase`.
   * @note Aggregation of query hits for elements in the `entries` array stops for each associated `Query` after the
   * first matching entry to that `Query` is found. This might not be a problem as that would also be the highest
   * priority match for that query as well. */
  fullWithCount: () => ResultFullWithCount
  /** Returns a `result`'s `entries` sorted by their decending `priority`. */
  sortedEntries: () => IResultEntry[]
  /** Updates entries to the passed in entries, if at least one is defined, and resets the internal
   * sorting of the entries. */
  setEntries: (entries: IResultEntry[]) => void
  /** Tests `entries` of a `Result` for a match against `words` based on the entry's
   *  `mode` and returns the highest matching `priority` or `undefined` if no matches. */
  match: (words: string[]) => number | undefined
  /** Tests `entries` of a `Result` for a match against `words` based on the entry's
   *  `mode` and returns the highest matching `priority` or `undefined` if no matches.
   *  Prefetch matching permits last word in words to be a `keyword.startsWith()` match
   *  so that matches work for autocomplete suggestions. */
  prefetchMatch: (words: string[], offset?: number) => number | undefined
  /** Updates the result's values with those passed in via `input`.
   * Intended to be used with non-saving validation checks. */
  fromPartialJson: (input: TemplateResult) => void
  /** Tests if result already has an entry with the same `keywords` and `mode`.
   * @note `priority` is not tested. */
  hasEntry: (entry: IResultEntry) => boolean
  /** Tests if result's `tags` array already includes `tag`. */
  hasTag: (tag: string) => boolean
  /** Tests for non-blank `title` and `url` values, at least one entry, and that the `url` starts with a scheme. */
  valid: () => Feedback[]
  /** Uses feedback from `this.valid` to attempt to heal records failing validation where it can. */
  healRecord: (feedback?: Feedback[]) => void
  /** Tests `url` for 2xx response on a 5 second timeout.
   * * Resets `currency.broken*` values to not broken state if passed.
   * * Sets `currency.broken*` values to broken state and time detected if newly broken.
   * * Updates `currency.tested` to `new Date()` and attempts to `this.save()` when done.
   * @note Will attempt to update 'txstate.edu' urls to 'txst.edu' urls if testing against
   *       the 'txst.edu' url returns a 2xx response in less than 5 seconds. */
  currencyTest: () => Promise<void>
}

interface ResultModel extends Model<IResult, any, IResultMethods> {
  /** @async Returns an array of all `Result` documents with their associated queries populated in the documents. */
  getAllWithQueries: () => Promise<ResultDocumentWithQueries[]>
  /** @async Returns the `Result` document identified by `id` with its associated queries populated in the document. */
  getWithQueries: (id: string) => Promise<ResultDocumentWithQueries>
  /** @async Returns array of all `Result` documents with `keywords` that start with any of the `words`. */
  getByQuery: (words: string[]) => Promise<ResultDocument[]>
  /** @async Returns array, sorted by priority decending, of all `Result` documents with `entries` that `match()` on the tokenized `query`. */
  findByQuery: (query?: string) => Promise<ResultDocument[]>
  /** @async Returns array, sorted by priority decending, of all `Result` documents with `entries` that `prefetchMatch()` on the tokenized `query`. */
  findByQueryCompletion: (query?: string, offset?: number) => Promise<ResultDocument[]>
  /** @async Concurrently runs currencyTest() on all `Result` documents with an `currency.tested` date older than 1 day or `undefined`. */
  currencyTestAll: () => Promise<void>
  /** @async Runs `currencyTestAll` followed by a 10 minute timeout interval before running it again. */
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

// TODO: I wonder if making entries it's own sub-Schema/Model in here would
// provide benefits worth the extra step in tracing with problems.

const ResultSchema = new Schema<IResult, ResultModel, IResultMethods>({
  url: {
    type: String,
    required: [true, 'Required.'],
    unique: true, // Note `unique` here is a hint for MongoDB indexes, not a validator.
    validate: [/^(\w+:)?\/\//i, 'URL must start with a scheme.']
  },
  title: { type: String, required: [true, 'Required.'] },
  currency: {
    broken: Boolean,
    tested: Date,
    brokensince: Date
  },
  entries: [{
    keywords: {
      type: [String],
      // required: [true, 'Search Words are required.'], // Not working.
      lowercase: true,
      validate: {
        validator: (value: string[]) => {
          const notEmpty = value.length > 0
          return notEmpty ? value.every(str => isNotBlank(str)) : false
        },
        message: 'Required.'
      }
    },
    mode: {
      type: String,
      enum: {
        values: matchingModes,
        message: '{VALUE} is not an option.'
      },
      required: [true, 'Required.']
    },
    priority: { type: Number, required: [true, 'Required.'] }
  }],
  tags: { type: [String], lowercase: true }
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

ResultSchema.methods.sortedEntries = function () {
  this._sortedEntries ??= sortby([...this.entries], 'priority', true)
  return this._sortedEntries
}

ResultSchema.methods.resetSorting = function () {
  this._sortedEntries = undefined
}

ResultSchema.methods.setEntries = function (entries: IResultEntry[] | undefined) {
  if (!entries) return
  if (entries.length > 0) {
    this.entries = entries
    this._sortedEntries = sortby([...this.entries], 'priority', true)
  }
}

ResultSchema.methods.full = function () {
  const info = this.basicPlusId()
  const entries = this.outentries()
  return {
    ...info,
    brokensince: this.currency.brokensince,
    entries,
    /** Used for storage of highest priority of matching entries during matching tests.
     * TODO: I'm not sure if we want to preserve the Document level `priority` of existing Result records. */
    priority: this.priority ?? entries[0]?.priority ?? 0,
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
    for (let i = 0; i < info.entries.length; i++) {
      if (entryMatch(this.entries[i], words)) {
        ret.entries[i].count += query.hits.length
        break
        /* Commit says each entry but the above breaks the loop after the first matching entry is found.
           Intended?
             That would be the highest priority match since info.entries is sorted by priority desc.
        */
      }
    }
  }
  return ret
}

/** Returns `[ new Set(words), words.join(' ') ] as const` */
function wordsProcessed (words: string[]) {
  return [new Set(words), words.join(' ')] as const
}

/** Tests `entry` for a match against `searchWords` based on the entry's `mode`:
 * * `exact` - `entry.keywords.join(' ')` EXACTLY matches `searchWords.join(' ')`
 * * `phrase` - `searchWords.join(' ').includes(entry.keywords.join(' '))`
 * * `keyword` - ALL `entry.keywords` are found in `searchWords`. */
const entryMatch = function (entry: IResultEntry, searchWords: string[]) {
  const [searchSet, searchJoined] = wordsProcessed(searchWords)
  /** Used for short-circuit detections of false conditions. */
  const keysMinusQs = entry.keywords.length - searchWords.length
  if (entry.mode === 'exact') { // "query must match exactly"
    return (keysMinusQs === 0 && searchJoined === entry.keywords.join(' '))
  } else if (entry.mode === 'phrase') { // "all words must be present, in order"
    return (keysMinusQs <= 0 && searchJoined.includes(entry.keywords.join(' ')))
  } else { // entry.mode === 'keyword' - "all words must be present, but in any order"
    return (keysMinusQs <= 0 && entry.keywords.filter(keyword => searchSet.has(keyword)).length === entry.keywords.length)
  }
}

/** Implementation of `entryMatch` that's useful for autocomplete suggestion prefetching.
 * Impletements the same rules as entryMatch except the last word of the `searchWords` is
 * compared using `.startsWith()` rather than exact matching. */
const prefetchEntryMatch = function (entry: IResultEntry, searchWords: string[], offset?: number) {
  // given a query string, determine whether this entry is a match
  // after accounting for mode
  const [searchSet, searchJoined] = wordsProcessed(searchWords)
  if (entry.mode === 'exact') { // "query must match exactly" - last query word exception
    return (entry.keywords.length === searchWords.length && entry.keywords.join(' ').startsWith(searchJoined))
  } else if (entry.mode === 'phrase') { // "all words must be present, in order" - last query word exception
    let keywordIndex = 0
    let prefixcount = 0
    for (let i = 0; i < searchWords.length; i++) {
      const searchWord = searchWords[i]
      if (searchWord === entry.keywords[keywordIndex]) {
        keywordIndex++
        prefixcount = 0
      } else if (i === searchWords.length - 1 && entry.keywords[keywordIndex]?.startsWith(searchWord)) {
        prefixcount++
      } else if (keywordIndex < i) return false // Go ahead an stop comparing - it not match enough to continue.
    }
    return (keywordIndex === entry.keywords.length || (keywordIndex === entry.keywords.length - 1 && prefixcount === 1))
    /* An easier to read but less performant alternative:
    return (entry.keywords.slice(0, -1).join(' ') === searchWords.slice(0, -1).join(' ') && entry.keywords[-1].startsWith(searchWords[-1]))
    */
  } else { // entry.mode === 'keyword' - "all words must be present, but in any order" - last query word excetpion
    let keywordCount = 0
    let prefixcount = 0
    for (const keyword of entry.keywords) {
      if (searchSet.has(keyword)) keywordCount++
      else if (searchWords.some(sw => keyword.startsWith(sw))) prefixcount++
      /* The above `else if` ends up letting any word being edited in the search to match
         for the keywords instead of just the last `searchWord`. Is this intended or do we
         want to limit to the last? If so the following would be more performant and accurate. */
      // else if (keyword.startsWith(searchWords[-1])) prefixcount++
    }
    return (keywordCount === entry.keywords.length || (keywordCount === entry.keywords.length - 1 && prefixcount === 1))
  }
}

ResultSchema.methods.match = function (words: string[]) {
  for (const entry of this.sortedEntries()) {
    if (entryMatch(entry, words)) return entry.priority ?? 0
  }
  return undefined
}

ResultSchema.methods.prefetchMatch = function (words: string[], offset?: number) {
  for (const entry of this.sortedEntries()) {
    if (prefetchEntryMatch(entry, words, offset)) return entry.priority ?? 0
  }
  return undefined
}

export interface RawJsonResult {
  url: string
  title: string
  entries: ResultEntry[]
  tags?: string[]
  /** Used for storage of highest priority of matching entries during matching tests. */
  priority?: number
}

ResultSchema.methods.fromPartialJson = function (input: Partial<RawJsonResult>) {
  this.url = input.url?.trim()
  this.title = input.title?.trim()
  this.tags = []
  this.entries = []
  for (const entry of input.entries ?? []) {
    const mode = entry.mode?.toLowerCase()
    this.entries.push({
      keywords: querysplit(entry.keyphrase ?? ''),
      mode,
      priority: entry.priority
    })
  }
  // Sort on new inputs to speed up fetching of Result arrays.
  this._sortedEntries = sortby([...this.entries], 'priority', true)
  for (const tag of input.tags ?? []) {
    this.tags.push(tag.toLowerCase().trim())
  }
}

ResultSchema.methods.hasEntry = function (entry: IResultEntry) {
  const inKeys = entry.keywords.join(' ')
  for (const e of this.entries) {
    if (e.mode === entry.mode && e.keywords.join(' ') === inKeys) return true
  }
  return false
}

ResultSchema.methods.hasTag = function (tag: string) {
  return this.tags.includes(tag)
}

ResultSchema.methods.valid = function () {
  // this.validate() will only throw errors for us to catch. Use validateSync() instead.
  const validation: ValidationError = this.validateSync()
  const resp: Feedback[] = validation
    ? Object.keys(validation.errors).map(key =>
      ({ type: MessageType.ERROR, path: key, message: validation.errors[key].properties.message })
    )
    : []
  return resp
}

ResultSchema.statics.getAllWithQueries = async function () {
  return this.find().populate('queries')
}

ResultSchema.statics.getWithQueries = async function (id) {
  return this.findById(id).populate('queries')
}

ResultSchema.statics.getByQuery = async function (words: string[]) {
  if (words.length === 0) throw new Error('Attempted Result.getByQuery(words: string[]) with an empty array.')
  const ret = await this.find({
    $or: words.map(w => ({
      'entries.keywords': { $regex: '^' + w }
    }))
  })
  return ret
}

ResultSchema.statics.findByQuery = async function (query: string) {
  if (isBlank(query)) return []
  const words = querysplit(query)
  const results = await this.getByQuery(words) as (ResultDocument & { priority?: number })[]
  for (const r of results) r.priority = r.match(words)
  const filteredresults = results.filter(r => isNotNull(r.priority))
  return sortby(filteredresults, 'priority', true, 'title')
}

ResultSchema.statics.findByQueryCompletion = async function (query: string, offset?: number) {
  if (isBlank(query)) return []
  const words = querysplit(query)
  const results = await this.getByQuery(words) as (ResultDocument & { priority?: number })[]
  for (const r of results) r.priority = r.prefetchMatch(words, offset)
  const filteredresults = results.filter(r => isNotNull(r.priority))
  return sortby(filteredresults, 'priority', true, 'title')
}

ResultSchema.methods.currencyTest = async function () {
  try {
    let alreadypassed = false
    const parsedUrl = new URL(this.url)
    if (parsedUrl.hostname.endsWith('txstate.edu')) {
      try {
        parsedUrl.hostname = parsedUrl.hostname.replace(/txstate\.edu$/, 'txst.edu')
        const newUrl = parsedUrl.toString()
        await axios.get(newUrl, { timeout: 5000 })
        // axios.get will throw an error for all non 2xx repsonse,
        // so it worked if no error was thrown.
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
    // Handle Redirect Detection
    if (!this.currency.broken) this.currency.brokensince = new Date()
    this.currency.broken = true
  }
  this.currency.tested = new Date()
  try {
    // Heal existing Result documents where we can.
    this.healRecord(this.valid())
    await this.save()
  } catch (e) {
    console.error(e)
  }
}

ResultSchema.methods.healRecord = function (feedback?: Feedback[]) {
  if (!feedback || feedback.length === 0) return
  for (const v of feedback) {
    if (v.path?.startsWith('entries.')) {
      // Even though this potentially affects the sorting order of the entries we're not resetting _sortedEntries here.
      const index = parseInt(v.path.split('.')[1])
      if (v.path.endsWith('priority')) {
        console.info(`Healing Result ${this.id} entries.${index}.priority from ${this.entries[index].priority ?? 'undefined'} to 0.`)
        this.entries[index].priority = 0
      }
      if (v.path.endsWith('mode')) {
        console.info(`Healing Result ${this.id} entries.${index}.mode from ${this.entries[index].mode ?? 'undefined'} to 'keyword'.`)
        this.entries[index].mode = 'keyword'
      }
    }
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
    console.error(e)
  }
  setTimeout(() => { this.currencyTestLoop().catch(console.error) }, 600000)
}

export const Result = models.Result as ResultModel ?? model<IResult, ResultModel>('Result', ResultSchema)
