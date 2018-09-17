//var Entry = require('../models/entry')

class Helpers {
  static querysplit(query) {
    return query.toLowerCase().split(/[^\w-]+/)
  }
}

module.exports = Helpers
