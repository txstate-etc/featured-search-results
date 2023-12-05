/* TODO: what are we counting?
 * I'm unable to make heads or tails of what this is meant to do between this model and the /counter/[id] endpoint handlers. */
import pkg, { deleteModel } from 'mongoose'
const { Schema, models, model } = pkg
import type { Model } from 'mongoose'
import { Cache } from 'txstate-utils'

interface ICounter {
  name: string
  hitcount: number
  lasthit: Date
}
interface CounterModel extends Model<ICounter, any> {
  increment: (name: string | undefined) => Promise<number | undefined>
  get: (name: string | undefined) => Promise<number | undefined>
}

const CounterSchema = new Schema<ICounter, CounterModel>({
  name: String,
  hitcount: {
    type: Number,
    default: 0
  },
  lasthit: Date
})

CounterSchema.index({ name: 1 })

const counterCache = new Cache(async (name: string | undefined) => {
  const counter = await Counter.findOne({ name })
  return counter?.hitcount ?? 0
})

CounterSchema.statics.get = async function (name) {
  return await counterCache.get(name)
}

CounterSchema.statics.increment = async function (name) {
  const counter = await Counter.findOneAndUpdate({ name }, { $inc: { hitcount: 1 }, $set: { lasthit: new Date() } }, { upsert: true, new: true, setDefaultsOnInsert: true })
  if (!counter) return undefined
  counterCache.invalidate(name).catch(console.error)
  return counter.hitcount
}

if (models.Counter) deleteModel('Counter')
export const Counter = model<ICounter, CounterModel>('Counter', CounterSchema)
