const express = require('express')
require('express-async-errors')
const app = express()
const mongoose = require('mongoose')
const logger = require('morgan')
const helpers = require('./lib/helpers')
require('dotenv').config()

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
var Entry = require('./models/entry')

// middleware
app.use(logger('dev'))
app.use(express.json())

// add endpoints
app.get('/search', async function (req, res) {
  var ret = []
  var query = req.query.q
  res.json(ret)
})
app.get('/entry', async function (req, res) {
  var id = req.params.id
  var ret = (await Entry.find()).map(entry => { return entry.full() })
  res.json(ret)
})
app.post('/entry', async function (req, res) {
  var input = req.body
  if (helpers.isBlank(input.url)) return res.status(400).send('Posted entry must contain a URL.')

  var entry = (await Entry.findOne({url: input.url})) || new Entry({ url: input.url })
  await entry.save()
  res.sendStatus(200)
})
app.get('/entry/:id', async function (req, res) {
  var id = req.params.id
  res.json(info)
})
app.put('/entry/:id', async function (req, res) {
  if (!helpers.isHex(req.params.id)) return res.status(400).send('Bad id format. Should be a hex string.')
  var entry = await Entry.findById(req.params.id)
})
app.delete('/entry/:id', async function (req, res) {
  await Entry.findByIdAndRemove(req.params.id)
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
