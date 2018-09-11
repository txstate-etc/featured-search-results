//var Entry = require('../models/entry')

class Helpers {
  static isBlank(str) {
    return !str || !str.trim || str.trim().length == 0
  }
  static isHex(str) {
    return !this.isBlank(str) && !str.match(/[^a-f0-9]/)
  }
}

module.exports = Helpers
