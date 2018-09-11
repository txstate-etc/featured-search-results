const express = require('express')
require('express-async-errors')
const app = express()
const mongoose = require('mongoose')
const logger = require('morgan')
const helpers = require('./lib/helpers')

// database config
var db_host = process.env.DB_HOST || 'localhost';
var db_port = process.env.DB_PORT || '27017';
var db_authdb = process.env.DB_AUTHDATABASE || '';
var db_user = process.env.DB_USER || '';
var db_pw = process.env.DB_PASSWORD || '';
var db_name = process.env.DB_DATABASE || 'search-featured-results';
var db_userpassword_prefix = '';
if (db_user.length > 0 && db_pw.length > 0) db_userpassword_prefix = db_user+':'+db_pw+'@';
var db_authdb_suffix = '';
if (db_authdb.length > 0) db_authdb_suffix = '?authSource='+db_authdb;

// server config
var server_port = parseInt(process.env.PORT, 10) || 3000;

// models
var Result = require('./models/result')

// middleware
app.use(logger('tiny'))
app.use(express.json())

// add endpoints
app.get('/search', async function (req, res) {
  var ret = []
  var query = req.query.q
  res.json(ret)
})
app.get('/results', async function (req, res) {
  var id = req.params.id
  var ret = (await Result.find()).map(result => { return result.full() })
  res.json(ret)
})
app.post('/result', async function (req, res) {
  var input = req.body
  if (!input) return res.status(400).send('POST body was not parseable JSON.')
  if (helpers.isBlank(input.url)) return res.status(400).send('Posted result must contain a URL.')

  var result = (await Result.findOne({url: input.url})) || new Result({ url: input.url })
  result.fromJson(input)
  await result.save()
  res.sendStatus(200)
})
app.get('/result/:id', async function (req, res) {
  if (!helpers.isHex(req.params.id)) return res.status(400).send('Bad id format. Should be a hex string.')
  var result = await Result.findById(req.params.id)
  res.json(result.full())
})
app.put('/result/:id', async function (req, res) {
  if (!helpers.isHex(req.params.id)) return res.status(400).send('Bad id format. Should be a hex string.')
  if (!req.body) return res.status(400).send('POST body was not parseable JSON.')
  var result = await Result.findById(req.params.id)
  if (!result) return res.status(404).send('That result id does not exist.')
  result.fromJson(req.body)
  await result.save()
  res.sendStatus(200)
})
app.delete('/result/:id', async function (req, res) {
  await Result.findByIdAndRemove(req.params.id)
  res.sendStatus(200)
})

// start up
var db_connect = function () {
  mongoose.connect('mongodb://'+db_userpassword_prefix+db_host+':'+db_port+'/'+db_name+db_authdb_suffix, {
    ssl: process.env.DB_SSL == 'true' ? true : false,
    reconnectTries: Number.MAX_VALUE,
    reconnectInterval: 500,
    poolSize: 50
  })
  .then(function () {
    console.log("DB connection alive")
    app.listen(server_port)
  })
  .catch(function (err) {
    console.log(err)
    console.log('trying again in 5 seconds')
    setTimeout(db_connect, 5000)
  })
}
db_connect()
