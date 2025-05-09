/* eslint-disable @typescript-eslint/dot-notation */
/* eslint-disable quote-props */
/* In the parlance of Search-Featured-Result a `Query` is a record of all search requests
 * submitted for `Result` matching. Each `Query` record is uniquely identified by its
 * "cleaned" query string:
 *   - lowercased
 *   - whitespaces reduced to single space
 *   - trimmed
 *
 * Any time a query is "Submitted" the timestamp of the submission is added to the associated
 * Query record's `hits` array and any correlated Result's id found by the search are saved
 * with the Query record in its `results` array. TODO: why are they saved there?
 *
 * Queries can be sent to the API as "Non-Submitted" (no Enter|Button-Click|Tap) for 'AsYouType'
 * or 'Auto-Complete' searches that want results for a query that's not yet fully typed by users
 * in an input. The requests for results for these "incomplete" queries are not recorded for
 * obvious reasons.
 *
 * CLEANUP:
 * Query `hits` that are older than 6 months are removed from all Query documents every 27 minutes.
 * If any Query documents end up with empty `hits` arrays as a result - they are deleted.
 */
import { Result } from './result.js'
import { DateTime } from 'luxon'
import mongoose from 'mongoose'
const { Schema, models, model, deleteModel } = mongoose
import type { Model, Document, ObjectId, PipelineStage } from 'mongoose'
import { isBlank, keyby, unique } from 'txstate-utils'
import { type ResultDocument, type ResultBasicPlusId, entryMatchesQuery, getResultsDef } from './result.js'
import { getMongoStages, querysplit, getFields } from '../util/helpers.js'
import type { Paging, AdvancedSearchResult, AggregateResult, SearchMappings, MetaSearch, MappingType, SortParam } from '../util/helpers.js'

/** Returns an object reference to a utility representation of the relationship between search
 *  terms and the underlying `Query` documents. */
export function getQueriesDef (): SearchMappings {
  const aliasMap: Record<string, string> = {
    'match words': 'query',
    'keyphrase': 'query',
    'aliases': 'query',
    'keywords': 'query',
    'query': 'query',
    'search': 'query',
    'term': 'query',
    'terms': 'query',
    'title': 'results::',
    'pagename': 'results::',
    'page name': 'results::',
    'url': 'results::',
    'path': 'results::',
    'domain': 'results::',
    'subdomain': 'results::',
    'hostname': 'results::',
    'hits': 'query::hitcount',
    'count': 'query::hitcount',
    'hitcount': 'query::hitcount',
    'lasthit': 'query::lasthit',
    'last hit': 'query::lasthit',
    'resultcount': 'query::results-length',
    'result count': 'query::results-length'
  }
  const metas: MappingType = {
    'query': 'string',
    'query::hitcount': { $size: '$hits' }, // Translate to using test for existance of Number(value) in $hits array.
    'hitcount': 'number',
    'query::lasthit': { $arrayElemAt: [{ $slice: ['$hits', -1] }, 0] },
    'lasthit': 'date',
    'results::': undefined, // TODO: Add filtering for results title and url?
    'query::results-length': { $size: '$results' },
    'results-length': 'number'
  }
  const correlations: Record<string, (metaSearch: MetaSearch) => Promise<MetaSearch>> = {
    results: async (metaSearch) => {
      const tableDef = getResultsDef()
      if (metaSearch.correlations.results.unionSearches.length) {
        const unionFilter = await getMongoStages(tableDef, metaSearch.correlations.results.unionSearches.join(''))
        const unionResults: ObjectId[] = (await Result.aggregate<AggregateResult>(unionFilter.pipeline))[0].matches.map(result => result['_id'])
        unionResults.forEach(result => metaSearch.correlations.results.unionIds.add(result))
      }
      if (metaSearch.correlations.results.intersectSearches.length) {
        const intersectFilter = await getMongoStages(tableDef, metaSearch.correlations.results.intersectSearches.join(''))
        const intersectResults = (await Result.aggregate<AggregateResult>(intersectFilter.pipeline))[0].matches.map(result => result['_id'])
        intersectResults.forEach(result => metaSearch.correlations.results.intersectIds.add(result))
      }
      return metaSearch
    }
  }
  const pretty: PipelineStage = {
    $project: { query: 1, results: 1, hitcount: 1, lasthit: 1 }
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
  const defaults: string[] = ['query']
  const sortDefaults: SortParam[] = [{ field: 'hitcount', direction: 'desc' }]
  const noSort: Set<string> = new Set<string>(['rusults'])
  return { aliasMap, metas, correlations, opMap, defaults, sortDefaults, noSort, pretty, fields: getFields(aliasMap) } as const
}

export interface QueryBasic {
  /** The string that makes this query. */
  query: string
  /** The number of times this query's results have been asked for. */
  hits: number
  /** Last date-time this query's results were asked for. */
  lasthit: Date | undefined
  /** Reference array to all basic Results, with their `id`, this query matches to. */
  results: ResultBasicPlusId[]
}
interface IQueryMethods {
/** Returns a basic `Query` record object including:
 * * `query` - the search query string
 * * `hits` - number of hits from the length of the `hits` array or coalesc from `hitcount`
 * * `lasthit` - Date of `lasthit` prop or its coalesc from the last element of `hits`
 * * `results` - an array of corresponding basicPlusId `Result` objects. */
  basic: () => QueryBasic
}
interface IQuery {
  query: string
  hitcount: number
  hits: Date[]
  lasthit: Date
  results: ObjectId[]
}

export type QueryDocument = Document<ObjectId> & IQuery & IQueryMethods
// export interface QueryDocument extends Document, IQuery, IQueryMethods {}
export type QueryDocumentWithResults = QueryDocument & { results: ResultDocument[] }

interface QueryModel extends Model<IQuery, any, IQueryMethods> {
  castAggResult: (input: Record<string, any>) => QueryDocument
  /** Updates or Inserts the corresponding `query` document, setting its `results` to passed in array,
   *  and pushing a `new Date()` to the document's `hits` array. */
  record: (query: string, results: ResultDocument[]) => void
  /** Returns an array of the top 5000 `Query` objects sorted by their `hitcount` in
   *  descending order and getting their corresponding `results` array populated
   *  based on the Advanced Search string provided. */
  searchAllQueries: (search: string, pagination?: Paging) => Promise<AdvancedSearchResult>
  /** Returns an array of the top 5000 `Query` objects sorted by their `hitcount` in
   *  descending order and getting their corresponding `results` array populated. */
  getAllQueries: () => Promise<QueryDocument[]>
  /** Updates all Query documents removing any `hits` elements older than 6 months and then deletes any
   * Query documents with no remaining `hits` entries. */
  cleanup: () => Promise<void>
  /** Runs `cleanup()` every 27 minutes after last execution and logs any caught errors. */
  cleanupLoop: () => Promise<void>
  /** Updates all the hit counts in Result.entries based on queries that have been recorded. */
  updateHitCounts: () => Promise<void>
}

const QuerySchema = new Schema<IQuery, QueryModel, IQueryMethods>({
  query: { type: String, unique: true, required: true },
  hits: [{ type: Date, default: [] }],
  hitcount: { type: Number },
  lasthit: { type: Date },
  results: [{ type: Schema.Types.ObjectId, ref: 'Result' }]
})

/** After many warnings from Mongoose about these I tracked down their documentation recomending to turn off the the autoIndex feature,
 * remove any statements in the app code to create the indexes and manually create them in the database once development is done.
 * The autoIndex feature and the statements to create the index here are ONLY provided as a convenience for quickly getting them
 * recreated in development where your DB can frequently get wiped to test with a clean slate. Leaving statements in place but commented
 * in case someone is working with a volatile development DB instance in the future but I'm otherwise disabling the autoIndex feature
 * while development on the models and dev data is pretty much done. Either manually create them in a tool like MongoDB Compass or
 * temporarily enable the auto creation extra indexes below. */
QuerySchema.set('autoIndex', false)
// QuerySchema.index({ query: 1 })
// we always push later dates on the end of hits, so hits[0] is the minimum and the
// only index we need - luckily mongo supports this with dot notation
// QuerySchema.index({ 'hits.0': 1 })

QuerySchema.methods.basic = function () {
  return {
    query: this.query,
    hits: this.hitcount ?? this.hits.length ?? 0,
    lasthit: this.lasthit ?? this.hits[this.hits.length - 1] ?? undefined,
    results: (this.results as unknown as ResultDocument[]).map((result: ResultDocument) => result.basicPlusId())
  }
}
QuerySchema.statics.record = async function (query: string, results: ResultDocument[]) {
  if (isBlank(query)) return
  await Query.findOneAndUpdate({ query: query.toLowerCase().replace(/[^\w-]+/g, ' ').trim() }, { $set: { results }, $push: { hits: new Date() } }, { upsert: true }).exec()
}
QuerySchema.statics.castAggResult = function (input: Record<string, any>) {
  return new Query({ query: input.query, hitcount: input.hitcount, hits: input.hits, lasthit: input.lasthit, results: input.results })
}
const queriesDef = getQueriesDef()
QuerySchema.statics.searchAllQueries = async function (search: string, pagination?: Paging): Promise<AdvancedSearchResult> {
  const filter = await getMongoStages(queriesDef, search, pagination)
  // console.log(JSON.stringify(clause))
  const searchResult = (await Query.aggregate<AggregateResult>(filter.pipeline, { allowDiskUse: true, collation: { locale: 'en', caseLevel: false, numericOrdering: true } }))[0]
  if (searchResult.matches.length) {
    const matches = (await Query.populate(searchResult.matches.map((query) => Query.castAggResult(query)), 'results')).map((query) => query.basic())
    // This would be where we insert sub-array filtering using the filter.metaSearch object to guide us.
    return { matches, total: searchResult.matchCount[0].total, search, pagination, meta: filter.metaSearch }
  }
  return { matches: [], total: 0, search, pagination, meta: filter.metaSearch }
}
QuerySchema.statics.getAllQueries = async function () {
  const queries = (await Query.aggregate([
    {
      $project: {
        query: 1,
        results: 1,
        hitcount: { $size: '$hits' },
        lasthit: { $arrayElemAt: [{ $slice: ['$hits', -1] }, 0] }
      }
    },
    { $sort: { hitcount: -1 } },
    { $limit: 100 }
  ])).map(q => new Query(q))
  return await Query.populate(queries, 'results')
}
QuerySchema.statics.cleanup = async function () {
  console.info('Running Query.cleanup.')
  const expires = DateTime.local().minus({ months: 6 }).toJSDate()
  await Query.updateMany(
    { 'hits.0': { $lte: expires } },
    { $pull: { hits: { $lte: expires } } }//,
    // { multi: true }
  )
  await Query.deleteMany({ hits: { $eq: [] } })
  await Query.updateHitCounts()
  console.info('Finished Query.cleanup.')
}
QuerySchema.statics.updateHitCounts = async function () {
  const queries = await this.getAllQueries()
  const Result = model('Result')
  const results = (await Result.find()) as unknown as ResultDocument[]
  const resultIdsByKeyword: Record<string, string[]> = {}
  const resultIdsByPrefix: Record<string, string[]> = {}
  const resultsById = keyby(results, r => r.id)
  // Build reverse indexes of keywords and prefixes to result ids.
  for (const r of results) {
    for (const e of r.entries) {
      for (const w of e.keywords) {
        resultIdsByKeyword[w] ??= []
        resultIdsByKeyword[w].push(r.id)
        for (let i = 1; i <= w.length; i++) {
          const ss = w.slice(0, i)
          resultIdsByPrefix[ss] ??= []
          resultIdsByPrefix[ss].push(r.id)
        }
      }
    }
  }
  // For each query, use the reverse indexes we created to get matching Result entries and increment their hit counts by the query's hit count.
  const hitCounts: Record<string, number> = {}
  for (const q of queries) {
    const words = querysplit(q.query)
    const wordset = new Set(words)
    const wordsjoined = words.join(' ')
    const lastword = words[words.length - 1]
    const resultIds = unique(words.flatMap(w => resultIdsByKeyword[w] ?? []).concat(resultIdsByPrefix[lastword] ?? []))
    for (const r of resultIds.map(rId => resultsById[rId]) as unknown as ResultDocument[]) {
      for (const e of r.sortedEntries()) { // Sorted on priority desc.
        if (entryMatchesQuery(e, words, wordset, wordsjoined)) {
          hitCounts[e.id] ??= 0
          hitCounts[e.id] += q.hitcount
          break // Only update the hitcount of the highest priority entry that first matched the query.
        }
      }
    }
  }
  // Build our update operations and bulk update the hitCountCached of the Result.entries.
  const ops: any[] = []
  for (const r of results) {
    for (let i = 0; i < r.entries.length; i++) {
      ops.push({
        updateOne: {
          filter: { _id: r._id },
          update: { [`entries.${i}.hitCountCached`]: hitCounts[r.entries[i].id] ?? 0 }
        }
      })
    }
  }
  await Result.bulkWrite(ops)
}
QuerySchema.statics.cleanupLoop = async function () {
  try {
    await Query.cleanup()
  } catch (e) {
    console.error(e)
  }
  setTimeout(() => { Query.cleanupLoop().catch(console.error) }, 27 * 60 * 1000)
}

if (models?.Query) deleteModel('Query')
export const Query = model<IQuery, QueryModel>('Query', QuerySchema)
