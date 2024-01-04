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
import type { Model, Document, ObjectId } from 'mongoose'
// import paginate from 'mongoose-paginate-v2'
import { isBlank, isNotNull, sortby, eachConcurrent } from 'txstate-utils'
import { getUrlEquivalencies, isValidHttpUrl, normalizeUrl, querysplit } from '../util/helpers.js'
import type { Feedback } from '@txstate-mws/svelte-forms'

export type ResultModes = 'keyword' | 'phrase' | 'exact'
const matchModes = ['keyword', 'phrase', 'exact']
const matchModesToString = new Map<ResultModes, string>([
  ['keyword', 'Keyword'],
  ['phrase', 'Phrase'],
  ['exact', 'Exact']
])

export interface ResultEntry {
  /** Space delimited list of words to associate with the URL based on the `mode`. */
  keyphrase: string
  mode: ResultModes
  /** Preferably a percentage, expressed as an integer, of how strongly the keywords associate to the parent featured Result. */
  priority: number
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
  brokensince?: Date
  entries: ResultEntry[]
  tags: string[]
}

export type ResultDocument = Document<ObjectId> & IResult & IResultMethods

interface ResultModel extends Model<IResult, any, IResultMethods> {
  /** @async Returns array of all `Result` documents with `keywords` that start with any of the `words`. */
  getByQuery: (words: string[]) => Promise<ResultDocument[]>
  /** @async Returns array, sorted by priority decending, of all `Result` documents with `entries` that `match()` on the tokenized `query`. */
  findByQuery: (query?: string) => Promise<ResultDocument[]>
  /** @async Returns array of all `Result` documents with `url` that match any of the `url` equivalencies. */
  findByUrl: (url: string) => Promise<ResultDocument[]>
  /** @async Concurrently runs currencyTest() on all `Result` documents with an `currency.tested` date older than 1 day or `undefined`. */
  currencyTestAll: () => Promise<void>
  /** @async Runs `currencyTestAll` followed by a 10 minute timeout interval before running it again. */
  currencyTestLoop: () => Promise<void>
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
  /** Returns a `result`'s `entries` sorted by their decending `priority`. */
  sortedEntries: () => IResultEntry[]
  /** Tests `entries` of a `Result` for a match against `words` based on the entry's
   *  `mode` and returns the highest matching `priority` or `undefined` if no matches. */
  match: (words: string[], wordset: Set<string>, wordsjoined: string) => number | undefined
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
/** Inteface for MongoDB storage of alias `entries` within the MongoDB `result` collection.
 * Note that the `keyphrase: string` of `ResultEntry` is broken into `keywords: string[]`
 * to allow for more efficient indexing by Mongoose. */
export interface IResultEntry {
  id: string
  keywords: string[]
  mode: ResultModes
  priority: number
  hitCountCached: number
}
/** Inteface for MongoDB storage of the `result` collection. */
export interface IResult {
  url: string
  title: string
  /** Currency is whether the URL associated with the `result` doesn't get a 200 response on tests.
   * TODO - Detect Redirects as well. */
  currency: {
    broken: boolean
    tested: Date
    brokensince?: Date
    // isRedirect: boolean
    conflictingUrls?: { id: string, url: string }[]
    conflictingTitles?: { id: string, title: string }[]
    conflictingMatchings?: { index: number, mode: ResultModes }[]
  }
  entries: IResultEntry[]
  tags: string[]
}

const ResultSchema = new Schema<IResult, ResultModel, IResultMethods>({
  url: {
    type: String,
    required: [true, 'Required.'],
    unique: true, // Note `unique` here is a hint for MongoDB indexes, not a validator.
    validate: {
      validator: (value: string) => {
        return isValidHttpUrl(value)
      },
      message: 'Invalid URL.'
    }
  },
  title: { type: String, required: [true, 'Required.'] },
  currency: {
    broken: Boolean,
    tested: Date,
    brokensince: Date,
    conflictingUrls: [{ id: Schema.Types.ObjectId, url: String }],
    conflictingTitles: [{ id: Schema.Types.ObjectId, title: String }],
    conflictingMatchings: [{ index: Number, mode: String }]
  },
  entries: [{
    keywords: {
      type: [String],
      // required: [true, 'Search Words are required.'], // Not working.
      lowercase: true,
      validate: {
        validator: (value: string[]) => {
          return value.length > 0
        },
        message: 'Required.'
      }
    },
    mode: {
      type: String,
      enum: {
        values: matchModes,
        message: '{VALUE} is not an option.'
      },
      required: [true, 'Required.']
    },
    priority: { type: Number, required: [true, 'Required.'] },
    hitCountCached: { type: Number }
  }],
  tags: { type: [String], lowercase: true }
})
// ResultSchema.plugin(paginate)

ResultSchema.index({ 'entries.keywords': 1 })
ResultSchema.index({ 'currency.tested': 1 })
ResultSchema.index({ url: 1 })

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
      priority: entry.priority ?? 0,
      count: entry.hitCountCached ?? 0
    })
  }
  return outentries
}
ResultSchema.methods.sortedEntries = function () {
  (this as any)._sortedEntries ??= sortby([...this.entries], 'priority', true)
  return (this as any)._sortedEntries
}
ResultSchema.methods.resetSorting = function () {
  this._sortedEntries = undefined
}
ResultSchema.methods.full = function () {
  const info = this.basicPlusId()
  const entries = this.outentries()
  return {
    ...info,
    brokensince: this.currency.brokensince,
    entries,
    tags: this.tags
  }
}
export function entryMatch (entry: IResultEntry, words: string[], wordset: Set<string>, wordsjoined: string) {
  // given a query string, determine whether this entry is a match
  // after accounting for mode
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
    const lastword = words[words.length - 1]
    for (const keyword of entry.keywords) {
      if (wordset.has(keyword)) count++
      else if (keyword.startsWith(lastword)) prefixcount++
    }
    if (count === entry.keywords.length || (count === entry.keywords.length - 1 && prefixcount >= 1)) return true
  }

  return false
}
ResultSchema.methods.match = function (words: string[], wordset: Set<string>, wordsjoined: string) {
  for (const entry of this.sortedEntries()) {
    if (entryMatch(entry, words, wordset, wordsjoined)) return entry.priority ?? 0
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
/** A `Partial<RawJsonResult>`, with optional `id`, useful for initializing form data from
 * either custom template values or values fetched for editing an existing Result. */
export interface TemplateResult extends Partial<RawJsonResult> {
  id?: string
}
ResultSchema.methods.fromPartialJson = function (input: TemplateResult) {
  this.url = normalizeUrl(input.url ?? '')
  this.title = input.title?.trim() ?? ''
  this.tags = []
  this.entries = []
  for (const entry of sortby(input.entries ?? [], 'priority', true)) {
    const mode = entry.mode?.trim().toLowerCase() ?? 'keyword' as ResultModes
    this.entries.push({
      keywords: querysplit(entry.keyphrase ?? ''),
      mode,
      priority: entry.priority,
      hitCountCached: 0
    } as unknown as IResultEntry)
  }
  for (const tag of input.tags ?? []) {
    this.tags.push(tag.trim().toLowerCase())
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
function findDuplicateMatchings (entries: IResultEntry[]) {
  const exacts = new Set<string>()
  const keywords = new Set<string>()
  const phrases = new Set<string>()
  const duplicates: { index: number, mode: ResultModes }[] = []
  entries.forEach((entry, index) => {
    const terms = entry.keywords.join(' ').toLocaleLowerCase()
    if (entry.mode === 'exact') {
      const _ = exacts.has(terms) ? duplicates.push({ index, mode: entry.mode }) : exacts.add(terms)
    } else if (entry.mode === 'keyword') {
      const _ = keywords.has(terms) ? duplicates.push({ index, mode: entry.mode }) : keywords.add(terms)
    } else if (entry.mode === 'phrase') {
      const _ = phrases.has(terms) ? duplicates.push({ index, mode: entry.mode }) : phrases.add(terms)
    }
  })
  return duplicates
}
ResultSchema.methods.valid = function () {
  // this.validate() will only throw errors for us to catch. Use validateSync() instead.
  const validation: mongoose.Error.ValidationError | null = this.validateSync()
  const resp: Feedback[] = validation
    ? Object.keys(validation.errors).filter(key => validation.errors[key].name !== 'CastError').map(key =>
      ({ type: 'error', path: key, message: (validation.errors[key] as mongoose.Error.ValidatorError).properties.message })
    )
    : []
  // Additional entries validation external to Model until we can create entriesSchema to apply nest-wide validator to.
  resp.push(...findDuplicateMatchings(this.entries).map<Feedback>(dup => {
    return { type: 'error', path: `entries.${dup.index}.keywords`, message: `Duplicate Terms for ${matchModesToString.get(dup.mode)} Type.` }
  }))
  // Additional warning validation on http instead of https URL.
  if (/^http:/i.test(this.url)) resp.push({ type: 'warning', path: 'url', message: "URL is using 'http:' not 'https:'" })
  return resp
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
  const wordset = new Set(words)
  const wordsjoined = words.join(' ')
  const results = await this.getByQuery(words) as (ResultDocument & { priority?: number })[]
  for (const r of results) r.priority = r.match(words, wordset, wordsjoined)
  const filteredresults = results.filter(r => isNotNull(r.priority))
  return sortby(filteredresults, 'priority', true, 'title')
}
ResultSchema.statics.findByUrl = async function (url: string) {
  const equivalencies = getUrlEquivalencies(url)
  return this.find({ url: { $in: equivalencies } })
}
const reservedTags = ['duplicate', 'broken-url', 'needs-url-normalization', '']
ResultSchema.methods.currencyTest = async function () {
  // Reset duplicate and broken-url tags as well as remove any duplicate tags.
  this.tags = this.tags.filter((t, i) => !reservedTags.includes(t) && this.tags.indexOf(t) === i)
  // Test currency of url normalization.
  const normalized = normalizeUrl(this.url)
  if (this.url !== normalized) {
    const origUrl = this.url
    try {
      this.url = normalized
      await this.save()
    } catch (e) { // Might be in conflict with existing duplicate but we want to normalize and save so try adding a '.' to the end.
      this.tags.push('duplicate')
      if (this.url.endsWith('/')) {
        try {
          this.url = this.url + '.'
          await this.save()
        } catch (e) {
          this.url = origUrl
          this.tags.push('needs-url-normalization')
          console.info(`Result ${this.id} needs url normalization from '${this.url}' to '${normalized}' but has a conflict with existing Results.`)
          console.error(e)
        }
      } else {
        this.url = origUrl
        this.tags.push('needs-url-normalization')
        console.info(`Result ${this.id} needs url normalization from '${this.url}' to '${normalized}' but has a conflict with existing Results.`)
        console.error(e)
      }
    }
  }
  // Test currency of duplicate url validation.
  const dupUrls = await Result.findByUrl(this.url)
  if (dupUrls?.length) {
    this.currency.conflictingUrls = dupUrls.map((r: ResultDocument) => { return { id: r.id, url: r.url } }).filter((r: any) => r.id !== this.id)
    if (this.currency.conflictingUrls.length && !this.hasTag('duplicate')) this.tags.push('duplicate')
  } else if (this.currency.conflictingUrls) delete this.currency.conflictingUrls
  // Test currency of duplicate title validation.
  this.title = this.title.trim()
  const dupTitles = await Result.find({ title: { $regex: `^\\s*${this.title}\\s*$`, $options: 'i' } })
  if (dupTitles?.length) {
    this.currency.conflictingTitles = dupTitles.map((r: any) => { return { id: r.id, title: r.title } }).filter((r: any) => r.id !== this.id)
    if (this.currency.conflictingTitles?.length && !this.hasTag('duplicate')) this.tags.push('duplicate')
  } else if (this.currency.conflictingTitles) delete this.currency.conflictingTitles
  // Test currency of duplicate term:type matchings validation.
  this.currency.conflictingMatchings = findDuplicateMatchings(this.entries)
  if (this.currency.conflictingMatchings.length === 0) {
    delete this.currency.conflictingMatchings
  } else if (!this.hasTag('duplicate')) this.tags.push('duplicate')
  // Test currency of url domain migration.
  try {
    let alreadypassed = false
    const parsedUrl = new URL(this.url)
    if (parsedUrl.hostname.endsWith('txstate.edu') && !this.currency.conflictingUrls) {
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
    this.currency.brokensince = undefined
  } catch (e) {
    // Handle Redirect Detection
    if (!this.currency.broken) this.currency.brokensince = new Date()
    this.currency.broken = true
    this.tags.push('broken-url')
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
        console.info(`Healing Result ${this.id} entries.${index}.priority from ${this.entries[index].priority ?? 'undefined'} to 50.`)
        this.entries[index].priority = 50
      }
      if (v.path.endsWith('mode')) {
        console.info(`Healing Result ${this.id} entries.${index}.mode from ${this.entries[index].mode ?? 'undefined'} to 'keyword'.`)
        this.entries[index].mode = 'keyword'
      }
    }
  }
}
ResultSchema.statics.currencyTestAll = async function () {
  console.info('Running currency test.')
  const results = await this.find({
    $or: [{
      'currency.tested': { $lte: DateTime.local().minus({ minutes: 1 }).toJSDate() }
    }, {
      'currency.tested': { $exists: false }
    }]
  }) as ResultDocument[]
  await eachConcurrent(results, async result => { await result.currencyTest() })
  console.info('Finished currency test.')
}
ResultSchema.statics.currencyTestLoop = async function () {
  try {
    await this.currencyTestAll()
  } catch (e) {
    console.error(e)
  }
  setTimeout(() => { this.currencyTestLoop().catch(console.error) }, 600000)
}

if (mongoose.models.Result) mongoose.deleteModel('Result')
export const Result = model<IResult, ResultModel>('Result', ResultSchema)
