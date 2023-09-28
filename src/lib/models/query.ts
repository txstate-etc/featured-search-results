import { type Model, model, Schema, type Document, type ObjectId } from 'mongoose'
import { DateTime } from 'luxon'
import { isEmpty, isBlank } from 'txstate-utils'
import type { ResultDocument, ResultBasicPlusId } from './result.js'

interface IQuery {
  query: string
  hits: Date[]
  results: Schema.Types.ObjectId[]
  hitcount: number
}

export interface QueryBasic {
  query: string
  hits: number
  lasthit: Date
  results: ResultBasicPlusId
}

interface IQueryMethods {
  basic: () => QueryBasic
}

export type QueryDocument = Document<ObjectId> & IQuery & IQueryMethods
export type QueryDocumentWithResults = QueryDocument & { results: ResultDocument[] }

interface QueryModel extends Model<IQuery, any, IQueryMethods> {
  record: (query: string, results: ResultDocument[]) => void
  getAllQueries: () => Promise<QueryDocument[]>
  cleanup: () => Promise<void>
  cleanupLoop: () => Promise<void>
}

const QuerySchema = new Schema<IQuery, QueryModel, IQueryMethods>({
  query: String,
  hits: [Date],
  results: [{ type: Schema.Types.ObjectId, ref: 'Result' }],
  hitcount: Number
})

QuerySchema.index({ query: 1 })

// we always push later dates on the end of hits, so hits[0] is the minimum and the
// only index we need - luckily mongo supports this with dot notation
QuerySchema.index({ 'hits.0': 1 })

QuerySchema.methods.basic = function () {
  return {
    query: this.query,
    hits: this.hits.length || this.hitcount,
    lasthit: isEmpty(this.lasthit) ? this.hits[this.hits.length - 1] : this.lasthit[0],
    results: this.results.map((result: ResultDocument) => result.basicPlusId())
  }
}

QuerySchema.statics.record = async function (query, results) {
  if (isBlank(query)) return
  await Query.findOneAndUpdate({ query: query.toLowerCase().trim() }, { $set: { results }, $push: { hits: new Date() } }, { upsert: true }).exec()
}

QuerySchema.statics.getAllQueries = async function () {
  const queries = (await Query.aggregate([
    {
      $project: {
        query: 1,
        results: 1,
        hitcount: { $size: '$hits' },
        lasthit: { $slice: ['$hits', -1] }
      }
    },
    { $sort: { hitcount: -1 } },
    { $limit: 5000 }
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
}

QuerySchema.statics.cleanupLoop = async function () {
  try {
    await Query.cleanup()
  } catch (e) {
    console.log(e)
  }
  setTimeout(() => { Query.cleanupLoop().catch(console.error) }, 27 * 60 * 1000)
}

export const Query = model<IQuery, QueryModel>('Query', QuerySchema)
