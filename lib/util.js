class Util {
  static sleep(milliseconds) {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds)
    })
  }
}

module.exports = Util
