/* eslint-disable quote-props */
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
const { Schema, models, model, Error, deleteModel } = mongoose
import type { Model, Document, ObjectId } from 'mongoose'
import { isBlank, isNotNull, sortby, eachConcurrent } from 'txstate-utils'
import { getUrlEquivalencies, isValidHttpUrl, normalizeUrl, querysplit, getMongoStages, getFields } from '../util/helpers.js'
import type { Paging, AdvancedSearchResult, AggregateResult, SearchMappings, MappingType, SortParam } from '../util/helpers.js'
import type { Feedback } from '@txstate-mws/svelte-forms'

export type ResultModes = 'keyword' | 'phrase' | 'exact'
const matchModes = ['keyword', 'phrase', 'exact']
export const matchModesToString = new Map<ResultModes, string>([
  ['keyword', 'Keyword'],
  ['phrase', 'Phrase'],
  ['exact', 'Exact']
])

/** Returns an object reference to a utility representation of the relationship between search
 *  terms and the underlying `Result` documents. */
export function getResultsDef (): SearchMappings {
  const aliasMap: Record<string, string> = {
    'title': 'title',
    'pagename': 'title',
    'page name': 'title',
    'tag': 'tags',
    'tags': 'tags',
    'tagcount': 'results::tags-length',
    'tag count': 'results::tags-length',
    'url': 'url',
    'path': 'url',
    'domain': 'url',
    'subdomain': 'url',
    'hostname': 'url',
    'broken': 'currency.broken',
    'brokensince': 'currency.brokensince',
    'duplicateurl': 'currency.conflictingUrls.url',
    'duplicateurls': 'results::conflictingUrls-length',
    'duplicatetitle': 'currency.conflictingTitles.title',
    'duplicatetitles': 'results::conflictingTitles-length',
    'duplicatematch': 'currency.conflictingMatchings.mode',
    'duplicatematches': 'results::conflictingMatchings-length',
    'matchwords': 'entries.keywords',
    'match words': 'entries.keywords',
    'matchwordcount': 'results::keywords-length',
    'matchword count': 'results::keywords-length',
    'keyphrase': 'entries.keywords',
    'aliases': 'entries.keywords',
    'keyword': 'entries.keywords',
    'keywords': 'entries.keywords',
    'keywordcount': 'results::keywords-length',
    'keyword count': 'results::keywords-length',
    'search': 'entries.keywords',
    'query': 'entries.keywords',
    'term': 'entries.keywords',
    'terms': 'entries.keywords',
    'termcount': 'results::keywords-length',
    'term count': 'results::keywords-length',
    'mode': 'entries.mode',
    'type': 'entries.mode',
    'priority': 'entries.priority',
    'weight': 'entries.priority',
    'hits': 'entries.hitCountCached',
    'count': 'entries.hitCountCached'
  }
  const metas: MappingType = {
    'title': 'string',
    'tags': { array: 'string' },
    'results::tags-length': { $size: '$tags' },
    'tags-length': 'number',
    'url': 'string',
    'currency.broken': 'boolean',
    'currency.brokensince': 'date',
    'results::conflictingUrls-length': { $size: '$currency.conflictingUrls' },
    'conflictingUrls-length': 'number',
    'results::conflictingTitles-length': { $size: '$currency.conflictingTitles' },
    'conflictingTitles-length': 'number',
    'results::conflictingMatchings-length': { $size: '$currency.conflictingMatchings' },
    'conflictingMatchings-length': 'number',
    'results::keywords-length': { $size: '$entries.keywords' },
    'keywords-length': 'number',
    'currency.conflictingUrls.url': 'string',
    'currency.conflictingTitles': 'boolean',
    'currency.conflictingTitles.title': 'string',
    'currency.conflictingMatchings': 'boolean',
    'currency.conflictingMatchings.mode': 'string',
    'entries.keywords': { array: 'string' },
    'entries.mode': 'string',
    'entries.priority': 'number',
    'entries.hitCountCached': 'number'
  }
  const opMap: Record<string, string> = {
    ':': 'in',
    '=': 'eq',
    'is': 'eq',
    'contains': 'in',
    '<': 'lt',
    '<=': 'lte',
    'starts with': 'lte',
    'startswith': 'lte',
    'begins with': 'lte',
    'beginswith': 'lte',
    '>': 'gt',
    '>=': 'gte',
    'ends with': 'gte',
    'endswith': 'gte'
  }
  const defaults: string[] = ['title', 'tags', 'url', 'entries.keywords']
  const sortDefaults: SortParam[] = [{ field: 'title', direction: 'asc' }, { field: 'tagcount', direction: 'desc' }]
  const noSort: Set<string> = new Set<string>(['entries.keywords', 'entries.mode', 'entries.priority', 'entries.hitCountCached'])
  return { aliasMap, metas, opMap, defaults, sortDefaults, fields: getFields(aliasMap), noSort } as const
}

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
  /** Returns a ResultDocument from the `input` Record. */
  castAggResult: (input: Record<string, any>) => ResultDocument
  /** Returns an array of the `Result` objects sorted by their `title, tags, url, entries.keywords` in
   *  descending order based on the Advanced Search string provided. */
  searchAllResults: (search: string, pagination?: Paging) => Promise<AdvancedSearchResult>
  /** @async Returns array of all `Result` documents with `keywords` that start with any of the `words`. */
  getByQuery: (words: string[]) => Promise<ResultDocument[]>
  /** @async Returns array of all `Result` documents with `keywords` having size of one that start with `word` if word is longer than 3 characters or exactly match if less. */
  getByOneWordQuery: (word: string) => Promise<ResultDocument[]>
  /** @async Returns array, sorted by priority decending, of all `Result` documents with `entries` that `match()` on the tokenized `query`. */
  findByQuery: (query: string) => Promise<ResultDocument[]>
  /** @async Returns array, sorted by priority decending, of all `Result` documents with `entries` that `oneWordMatch()` on the `query` word. */
  findByOneWordQuery: (query: string) => Promise<ResultDocument[]>
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
  getHighestPriorityMatch: (words: string[], wordset: Set<string>, wordsjoined: string) => number | undefined
  /** Tests `keyword` `entries` of a `Result` for a match against `word` and returns the highest
   *  matching `priority` or `undefined` if no matches. */
  getHighestPriorityOneWordMatch: (word: string) => number | undefined
  /** Updates the result's values with those passed in via `input`.
   * Intended to be used with non-saving validation checks. */
  fromPartialJson: (input: TemplateResult) => void
  /** Tests if result already has an entry with the same `keywords` and `mode`.
   * @note `priority` is not tested. */
  hasEntry: (entry: IResultEntry) => boolean
  /** Tests if result's `tags` array already includes `tag`. */
  hasTag: (tag: string) => boolean
  /** Tests for non-blank `title` and `url` values, at least one entry, and that the `url` starts with a scheme. */
  getValidationFeedback: () => Feedback[]
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

/** After many warnings from Mongoose about these I tracked down their documentation recomending to turn off the the autoIndex feature,
 * remove any statements in the app code to create the indexes and manually create them in the database once development is done.
 * The autoIndex feature and the statements to create the index here are ONLY provided as a convenience for quickly getting them
 * recreated in development where your DB can frequently get wiped to test with a clean slate. Leaving statements in place but commented
 * in case someone is working with a volatile development DB instance in the future but I'm otherwise disabling the autoIndex feature
 * while development on the models and dev data is pretty much done. Either manually create them in a tool like MongoDB Compass or
 * temporarily enable the auto creation extra indexes below. */
ResultSchema.set('autoIndex', false)
// ResultSchema.index({ 'entries.keywords': 1 })
// ResultSchema.index({ 'currency.tested': 1 })
// ResultSchema.index({ url: 1 })

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
  (this as any)._sortedEntries ??= sortby(this.entries, 'priority', true)
  return (this as any)._sortedEntries
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
export function entryMatchesQuery (entry: IResultEntry, words: string[], wordset: Set<string>, wordsjoined: string) {
  // Given a query string, determine whether this entry is a match after accounting for mode.
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
ResultSchema.methods.getHighestPriorityMatch = function (words: string[], wordset: Set<string>, wordsjoined: string) {
  for (const entry of this.sortedEntries()) {
    if (entryMatchesQuery(entry, words, wordset, wordsjoined)) return entry.priority ?? 0
  }
  return undefined
}
ResultSchema.methods.getHighestPriorityOneWordMatch = function (word: string) {
  // if (!word.length) return undefined // <- Handled by caller.
  for (const entry of this.sortedEntries().filter(e => e.keywords.length === 1)) {
    // If a search query is only one word long then the rules about mode coalesce to being equivalent,
    // allowing us to significantly simplify and reduce the matching workload for one word queries.
    // If search query is less than 3 characters do exact match to avoid too many results, else startsWith match.
    if (word.length < 3 ? entry.keywords[0] === word : entry.keywords[0].startsWith(word)) return entry.priority ?? 0
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
    this.entries.push({
      keywords: querysplit(entry.keyphrase ?? ''),
      mode: entry.mode?.trim().toLowerCase() ?? 'keyword' as ResultModes,
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
export interface DuplicateMatching { index: number, mode: ResultModes }
export function findDuplicateMatchings (entries: IResultEntry[]) {
  const exacts = new Set<string>()
  const keywords = new Set<string>()
  const phrases = new Set<string>()
  const duplicates: DuplicateMatching[] = []
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
ResultSchema.methods.getValidationFeedback = function () {
  // this.validate() will only throw errors for us to catch. Use validateSync() instead.
  const validation: mongoose.Error.ValidationError | null = this.validateSync()
  const resp: Feedback[] = validation
    ? Object.keys(validation.errors).filter(key => validation.errors[key].name !== 'CastError').map(key =>
      ({ type: 'error', path: key, message: (validation.errors[key] as mongoose.Error.ValidatorError).properties.message })
    )
    : []
  // Additional warning validation on http instead of https URL.
  if (/^http:/i.test(this.url)) resp.push({ type: 'warning', path: 'url', message: "URL is using 'http:' not 'https:'" })
  return resp
}
ResultSchema.statics.castAggResult = function (input: Record<string, any>) {
  return new Result({
    _id: input._id,
    title: input.title,
    url: input.url,
    entries: input.entries,
    tags: input.tags,
    currency: input.currency
  })
}
const resultDef = getResultsDef()
ResultSchema.statics.searchAllResults = async function (search: string, pagination?: Paging): Promise<AdvancedSearchResult> {
  const filter = await getMongoStages(resultDef, search, pagination)
  const searchResult = (await Result.aggregate<AggregateResult>(filter.pipeline, { collation: { locale: 'en', caseLevel: false, numericOrdering: true } }))[0]
  if (searchResult.matches.length) {
    // This would be where we insert sub-array filtering using the filter.metaSearch object to guide us.
    return {
      matches: searchResult.matches.map(r => this.castAggResult(r).full()),
      total: searchResult.matchCount[0].total,
      search,
      pagination,
      meta: filter.metaSearch
    }
  }
  return { matches: [], total: 0, search, pagination, meta: filter.metaSearch }
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
ResultSchema.statics.getByOneWordQuery = async function (word: string) {
  // if (!word?.trim()) throw new Error('Attempted Result.getByOneWordQuery(word: string) with an empty or undefined word.') // <- Handled by caller.
  const ret = word.length > 3 // If word is less than 3 characters then exact match, else startsWith match.
    ? await this.find({
      'entries.keywords': { $regex: '^' + word }
    })
    : await this.find({
      'entries.keywords': [word]
    })
  return ret
}
ResultSchema.statics.findByQuery = async function (query: string) {
  if (isBlank(query)) return []
  const words = querysplit(query)
  if (words.length === 0) return []
  const wordset = new Set(words)
  const wordsjoined = words.join(' ')
  const results = await this.getByQuery(words) as (ResultDocument & { priority?: number })[]
  for (const r of results) r.priority = r.getHighestPriorityMatch(words, wordset, wordsjoined)
  const filteredresults = results.filter(r => isNotNull(r.priority))
  return sortby(filteredresults, r => r.priority, true, r => r.title)
}
ResultSchema.statics.findByOneWordQuery = async function (query: string) {
  if (isBlank(query)) return []
  const words = querysplit(query) // Still calling querysplit for its input sanitization.
  if (words.length !== 1) throw new Error('Attempted Result.findByOneWordQuery(query: string) with a multi-word query.')
  const results = await this.getByOneWordQuery(words[0]) as (ResultDocument & { priority?: number })[]
  for (const r of results) r.priority = r.getHighestPriorityOneWordMatch(words[0])
  const filteredresults = results.filter(r => isNotNull(r.priority))
  return sortby(filteredresults, r => r.priority, true, r => r.title)
}
ResultSchema.statics.findByUrl = async function (url: string) {
  const equivalencies = getUrlEquivalencies(url)
  return this.find({ url: { $in: equivalencies } })
}
const reservedTags = ['duplicate', 'duplicate-url', 'duplicate-title', 'duplicate-match-phrase', 'broken-url', 'needs-url-normalization', '']
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
    if (this.currency.conflictingUrls.length) {
      if (!this.hasTag('duplicate')) this.tags.push('duplicate')
      if (!this.hasTag('duplicate-url')) this.tags.push('duplicate-url')
    }
  } else if (this.currency.conflictingUrls) delete this.currency.conflictingUrls
  // Test currency of duplicate title validation.
  this.title = this.title.trim()
  const dupTitles = await Result.find({ title: { $regex: `^\\s*${this.title}\\s*$`, $options: 'i' } })
  if (dupTitles?.length) {
    this.currency.conflictingTitles = dupTitles.map((r: any) => { return { id: r.id, title: r.title } }).filter((r: any) => r.id !== this.id)
    if (this.currency.conflictingTitles?.length) {
      if (!this.hasTag('duplicate')) this.tags.push('duplicate')
      if (!this.hasTag('duplicate-title')) this.tags.push('duplicate-title')
    }
  } else if (this.currency.conflictingTitles) delete this.currency.conflictingTitles
  // Test currency of duplicate term:type matchings validation.
  const dupMatchings = findDuplicateMatchings(this.entries)
  if (dupMatchings.length) {
    this.currency.conflictingMatchings = dupMatchings
    if (this.currency.conflictingMatchings.length) {
      if (!this.hasTag('duplicate')) this.tags.push('duplicate')
      if (!this.hasTag('duplicate-match-phrase')) this.tags.push('duplicate-match-phrase')
    }
  } else if (this.currency.conflictingMatchings) delete this.currency.conflictingMatchings
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
    this.healRecord(this.getValidationFeedback())
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
    $or: [
      { 'currency.tested': { $lte: DateTime.local().minus({ days: 1 }).toJSDate() } },
      { 'currency.tested': { $exists: false } }
    ]
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

if (models?.Result) deleteModel('Result')
export const Result = model<IResult, ResultModel>('Result', ResultSchema)
