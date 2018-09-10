//var Entry = require('../models/entry')

class Helpers {
  static isBlank(str) {
    return typeof(str) !== 'undefined' && str.trim().length > 0
  }
}

module.exports = Helpers
