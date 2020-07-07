const mongoose = require('mongoose')
const Cache = require('txstate-node-utils/lib/cache')
const Schema = mongoose.Schema

const CounterSchema = new Schema({
  name: String,
  hitcount: {
    type: Number,
    default: 0
  },
  lasthit: Date
})

CounterSchema.index({ name: 1 })

const counterCache = new Cache(async function (name) {
  const counter = await mongoose.model('Counter').findOne({ name })
  return (counter && counter.hitcount) || 0
})

CounterSchema.statics.get = async function (name) {
  return counterCache.fetch(name)
}

CounterSchema.statics.increment = async function (name) {
  const counter = await mongoose.model('Counter').findOneAndUpdate({ name }, { $inc: { hitcount: 1 }, $set: { lasthit: new Date() } }, { upsert: true, new: true, setDefaultsOnInsert: true })
  counterCache.invalidate(name)
  return counter.hitcount
}

module.exports = mongoose.model('Counter', CounterSchema)
