const helpers = require('./lib/helpers')
const utils = require('node-api-utils')
const app = utils.apiservice.app
const util = utils.util

// models
var Result = require('./models/result')

// authorize based on secret key
app.use(function (req, res, next) {
  if (req.method !== 'GET') {
    if (req.get('X-Secret-Key') !== process.env.FEATURED_SECRET) return res.status(401).send('Secret key required for any non-GET method.')
  }
  next()
})
app.use('/search', function (req, res, next) {
  res.set('Access-Control-Allow-Origin', '*')
  next()
})

// add endpoints
app.get('/search', async function (req, res) {
  var query = req.query.q
  var results = await Result.findByQuery(query)
  var ret = results.map(result => result.basic())
  res.json(ret)
})
app.get('/results', async function (req, res) {
  var ret = (await Result.find()).map(result => { return result.full() })
  res.json(ret)
})
app.post('/result', async function (req, res) {
  var input = req.body
  if (!input) return res.status(400).send('POST body was not parseable JSON.')
  if (util.isBlank(input.url)) return res.status(400).send('Posted result must contain a URL.')

  var result = (await Result.findOne({url: input.url})) || new Result({ url: input.url })
  result.fromJson(input)
  await result.save()
  res.sendStatus(200)
})
app.get('/result/:id', async function (req, res) {
  if (!util.isHex(req.params.id)) return res.status(400).send('Bad id format. Should be a hex string.')
  var result = await Result.findById(req.params.id)
  res.json(result.full())
})
app.put('/result/:id', async function (req, res) {
  if (!util.isHex(req.params.id)) return res.status(400).send('Bad id format. Should be a hex string.')
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

utils.apiservice.start()