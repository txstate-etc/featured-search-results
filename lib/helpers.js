//var Entry = require('../models/entry')

class Helpers {
  static querysplit(query) {
    const clean = query.toLowerCase().replace(/[^\w-]/g, ' ').trim()
    if (clean.length === 0) return []
    return clean.split(' ')
  }
}

module.exports = Helpers
