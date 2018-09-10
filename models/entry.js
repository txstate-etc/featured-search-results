var mongoose = require('mongoose')
var Schema = mongoose.Schema

var EntrySchema = new Schema({
  url: String,
  title: String,
  entries: [{
    keywords: [String],
    mode: {
      type: String,
      enum: ['keyword', 'phrase', 'exact']
    }
  }],
  tags: [String]
})

EntrySchema.index({'entries.keywords': 1})

EntrySchema.methods.basic = function () {
  var info = {
    url: this.url,
    title: this.title
  }
  return info
}

EntrySchema.methods.full = function () {
  var info = {
    id: this._id.toString(),
    url: this.url,
    title: this.title,
    entries: this.entries,
    tags: this.tags
  }
  return info
}

EntrySchema.methods.match = function (words) {
  // given an array of words, determine whether this entry is a match
  // after accounting for mode
  return true
}

module.exports = mongoose.model('Entry', EntrySchema)
