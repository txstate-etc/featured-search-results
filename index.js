const utils = require('txstate-node-utils')
const app = utils.apiservice.app
const util = utils.util

// models
const Result = require('./models/result')
const Query = require('./models/query')

// authorize based on secret key
function authorize(req, res, next) {
  if (req.get('X-Secret-Key') !== process.env.FEATURED_SECRET) {
    const message = process.env.NODE_ENV === 'production' ? 'Authentication failure.' : 'Secret key required for all endpoints except /search.'
    return res.status(401).send(message)
  }
  next()
}

app.use('/search', function (req, res, next) {
  res.set('Access-Control-Allow-Origin', '*')
  next()
})

// add endpoints
app.get('/search', async function (req, res) {
  var query = req.query.q
  if (query && query.length > 1024) return res.status(400).send('Query length is limited to 1kB.')
  var asyoutype = req.query.asyoutype ? true : false
  var results = await Result.findByQuery(query)
  var ret = results.map(result => result.basic())
  res.json(ret)
  if (!asyoutype) Query.record(query, results)
})
app.get('/adminsearch', authorize, async function (req, res) {
  var query = req.query.q
  if (query && query.length > 1024) return res.status(400).send('Query length is limited to 1kB.')
  var results = await Result.findByQuery(query)
  var ret = results.map(result => result.basicPlusId())
  res.json(ret)
})
app.get('/results', authorize, async function (req, res) {
  var ret = (await Result.getAllWithQueries()).map(result => { return result.fullWithCount() })
  res.json(ret)
})
app.post('/result', authorize, async function (req, res) {
  var input = req.body
  if (!input) return res.status(400).send('POST body was not parseable JSON.')
  if (util.isBlank(input.url)) return res.status(400).send('Posted result must contain a URL.')

  let result = null
  const newresult = new Result()
  newresult.fromJson(input)
  const oldresult = await Result.findOne({url: input.url})
  if (oldresult) {
    result = oldresult
    if (!util.isBlank(newresult.title)) result.title = input.title
    result.priority = input.priority || 1
    for (const entry of newresult.entries) {
      if (!result.hasEntry(entry)) result.entries.push(entry)
    }
    for (const tag of newresult.tags) {
      if (!result.hasTag(tag)) result.tags.push(tag)
    }
  } else {
    result = newresult
  }
  if (!result.valid()) return res.status(400).send('Result did not validate.')
  await result.save()
  res.status(200).json(result.full())
})
app.get('/result/:id', authorize, async function (req, res) {
  if (!util.isHex(req.params.id)) return res.status(400).send('Bad id format. Should be a hex string.')
  var result = await Result.getWithQueries(req.params.id)
  res.json(result.full())
})
app.put('/result/:id', authorize, async function (req, res) {
  if (!util.isHex(req.params.id)) return res.status(400).send('Bad id format. Should be a hex string.')
  if (!req.body) return res.status(400).send('POST body was not parseable JSON.')
  var result = await Result.findById(req.params.id)
  if (!result) return res.status(404).send('That result id does not exist.')
  result.fromJson(req.body)
  if (!result.valid()) return res.status(400).send('Result did not validate.')
  await result.save()
  res.status(200).json(result.full())
})
app.delete('/result/:id', authorize, async function (req, res) {
  await Result.findByIdAndRemove(req.params.id)
  res.sendStatus(200)
})
app.get('/queries', authorize, async function (req, res) {
  const ret = (await Query.getAllQueries()).map((query) => query.basic())
  res.json(ret)
})

utils.apiservice.start().then(() => {
  Result.currencyTestLoop()
  Query.cleanupLoop()
})
