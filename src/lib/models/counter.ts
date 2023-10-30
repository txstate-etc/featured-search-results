/* TODO: what are we counting?
 * I'm unable to make heads or tails of what this is meant to do between this model and the /counter/[id] endpoint handlers. */

import { model, type Model, Schema, models } from 'mongoose'
import { Cache } from 'txstate-utils'

interface ICounter {
  name: string
  hitcount: number
  lasthit: Date
}

interface CounterModel extends Model<ICounter> {
  get: (name: string) => Promise<number>
  increment: (name: string) => Promise<number>
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

const counterCache = new Cache(async (name: string) => {
  const counter = await Counter.findOne({ name })
  return counter?.hitcount ?? 0
})

CounterSchema.statics.get = async function (name) {
  return await counterCache.get(name)
}

CounterSchema.statics.increment = async function (name) {
  const counter = await Counter.findOneAndUpdate({ name }, { $inc: { hitcount: 1 }, $set: { lasthit: new Date() } }, { upsert: true, new: true, setDefaultsOnInsert: true })
  counterCache.invalidate(name).catch(console.error)
  return counter.hitcount
}

export const Counter = models.Counter ?? model<ICounter, CounterModel>('Counter', CounterSchema)
