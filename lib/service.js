const express = require('express')
require('express-async-errors')
const app = express()
var db = require('./db')

// server config
var server_port = parseInt(process.env.PORT, 10) || 3000;

// start up
db().then(function () {
  app.listen(server_port)
})

module.exports = app
