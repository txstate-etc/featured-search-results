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

import pkg from 'mongoose'
const { models, model } = pkg
import { Schema, type Model, type Document, type ObjectId } from 'mongoose'
import { DateTime } from 'luxon'
import { isBlank, keyby, unique } from 'txstate-utils'
import { type ResultDocument, type ResultBasicPlusId, entryMatch } from './result.js'
import { querysplit } from '$lib/util/helpers.js'

interface IQuery {
  query: string
  hits: Date[]
  results: Schema.Types.ObjectId[]
  hitcount: number
  lasthit: Date | undefined
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

export type QueryDocument = Document<ObjectId> & IQuery & IQueryMethods
export type QueryDocumentWithResults = QueryDocument & { results: ResultDocument[] }

interface QueryModel extends Model<IQuery, any, IQueryMethods> {
  /** Updates or Inserts the corresponding `query` document, setting its `results` to passed in array,
   *  and pushing a `new Date()` to the document's `hits` array. */
  record: (query: string, results: ResultDocument[]) => void
  /** Returns an array of the top 5000 `Query` objects sorted by their `hitcount` in
   *  descending order and getting their corresponding `results` array populated. */
  getAllQueries: () => Promise<QueryDocument[]>
  /** Updates all Query documents removing any `hits` elements older than 6 months and then deletes any
   * Query documents with no remaining `hits` entries. */
  cleanup: () => Promise<void>
  /** Runs `cleanup()` every 27 minutes after last execution and logs any caught errors. */
  cleanupLoop: () => Promise<void>
  /** Updates all the hit counts in Result.entries based on queries that have been recorded */
  updateHitCounts: () => Promise<void>
}

const QuerySchema = new Schema<IQuery, QueryModel, IQueryMethods>({
  query: { type: String, unique: true },
  hits: [Date],
  results: [{ type: Schema.Types.ObjectId, ref: 'Result' }],
  hitcount: Number,
  lasthit: Date
})
QuerySchema.index({ query: 1 })
// we always push later dates on the end of hits, so hits[0] is the minimum and the
// only index we need - luckily mongo supports this with dot notation
QuerySchema.index({ 'hits.0': 1 })

QuerySchema.methods.basic = function () {
  return {
    query: this.query,
    hits: this.hitcount ?? this.hits.length ?? 0,
    lasthit: this.lasthit ?? this.hits[this.hits.length - 1] ?? undefined,
    results: this.results.map((result: ResultDocument) => result.basicPlusId())
  }
}

QuerySchema.statics.record = async function (query: string, results: ResultDocument[]) {
  if (isBlank(query)) return
  await Query.findOneAndUpdate({ query: query.toLowerCase().replace(/[^\w-]+/g, ' ').trim() }, { $set: { results }, $push: { hits: new Date() } }, { upsert: true }).exec()
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
  const expires = DateTime.local().minus({ months: 6 }).toJSDate()
  await Query.updateMany(
    { 'hits.0': { $lte: expires } },
    { $pull: { hits: { $lte: expires } } },
    { multi: true }
  )
  await Query.deleteMany({ hits: { $eq: [] } })
  await Query.updateHitCounts()
}

QuerySchema.statics.updateHitCounts = async function () {
  const queries = await this.getAllQueries()
  const Result = model('Result')
  const results = (await Result.find()) as unknown as ResultDocument[]
  const resultIdsByKeyword: Record<string, string[]> = {}
  const resultIdsByPrefix: Record<string, string[]> = {}
  const resultsById = keyby(results, r => r.id)
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
  const hitCounts: Record<string, number> = {}
  for (const q of queries) {
    const words = querysplit(q.query)
    const wordset = new Set(words)
    const wordsjoined = words.join(' ')
    const lastword = words[words.length - 1]
    const resultIds = unique(words.flatMap(w => resultIdsByKeyword[w] ?? []).concat(resultIdsByPrefix[lastword] ?? []))
    for (const r of resultIds.map(rId => resultsById[rId]) as unknown as ResultDocument[]) {
      for (const e of r.entries) {
        if (entryMatch(e, words, wordset, wordsjoined)) {
          hitCounts[e.id] ??= 0
          hitCounts[e.id] += q.hitcount
          break
        }
      }
    }
  }
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

export const Query = models.Query as QueryModel ?? model<IQuery, QueryModel>('Query', QuerySchema)
