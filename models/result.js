var mongoose = require('mongoose')
var Schema = mongoose.Schema

var ResultSchema = new Schema({
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

ResultSchema.index({'entries.keywords': 1})

ResultSchema.methods.basic = function () {
  var info = {
    url: this.url,
    title: this.title
  }
  return info
}

ResultSchema.methods.outentries = function () {
  var outentries = []
  for (var entry of this.entries) {
    outentries.push({
      keyphrase: entry.keywords.join(' '),
      mode: entry.mode
    })
  }
  return outentries
}

ResultSchema.methods.full = function () {
  var info = {
    id: this._id.toString(),
    url: this.url,
    title: this.title,
    entries: this.outentries(),
    tags: this.tags
  }
  return info
}

ResultSchema.methods.match = function (words) {
  // given an array of words, determine whether this entry is a match
  // after accounting for mode
  return true
}

ResultSchema.methods.fromJson = function (input) {
  var result = this
  result.url = input.url
  result.title = input.title
  result.tags = input.tags
  result.entries = []
  for (var entry of input.entries) {
    var words = entry.keyphrase.toLowerCase().split(/[^\w-]+/)
    var lcmode = entry.mode.toLowerCase()
    var mode = ['keyword','phrase','exact'].includes(lcmode) ? lcmode : 'keyword'
    result.entries.push({
      keywords: words,
      mode: mode
    })
  }
}

module.exports = mongoose.model('Result', ResultSchema)
