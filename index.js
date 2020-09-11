const utils = require('txstate-node-utils')
const cookieparser = require('cookie-parser')
const db = require('mysql2-async/db').default
const app = utils.apiservice.app
const util = utils.util
const Helpers = require('./lib/helpers')

utils.apiservice.addDomain(/txstate\.edu$/)
utils.apiservice.addDomain(/tsus\.edu$/)
utils.apiservice.addDomain(/tjctc\.org$/)
app.use(cookieparser())

// models
const Result = require('./models/result')
const Query = require('./models/query')
const Counter = require('./models/counter')
// const { getSortClause } = require('./lib/helpers')

// authorize based on secret key
function authorize (req, res, next) {
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
app.use('/counter', function (req, res, next) {
  res.set('Access-Control-Allow-Credentials', 'true')
  next()
})

// add endpoints
// ====================================================================================================================================
app.get('/peoplesearch', async function (req, res) {
  const params = req.query
  if (!params.q) return res.json({ count: 0, lastpage: 1, results: [] })

  const peopleDef = Helpers.getPeopleDef()
  const whereClause = Helpers.getWhereClause(peopleDef, params.q)
  const countSQL = 'select count(*) from swtpeople' + whereClause
  const listingSQL = 'select * from swtpeople' + whereClause + Helpers.getSortClause(peopleDef, params.sort) + Helpers.getLimitClause(params.n)
  console.log(listingSQL)
  const [hitCount, people] = await Promise.all([ // Careful with Promise.all that has lots of concurrent queries.
    db.getval(countSQL), // Returns the value instead of the
    db.getall(listingSQL)
  ]) // Returns an array of results I can inspect. All these fail together if any fails.
  const response = {
    count: hitCount,
    lastpage: 1, // Count of pages of results. Can calculate from params.num and hitCount
    results: people
  }
  res.json(response)
  // Don't forget to update api_results.js to send requests to this endpoint making sure it handles all situations.
  // We'll also need a departments endpoint that will mirror dept.pl code.
  // We'll revisit to paginate.

  // start=?
  // num=?   -- Regardless of what they pass as the num to return, we need to get a count of how many matches there were and display it?
  // q=gato-search-input[text]
  // sort=?
})
// ====================================================================================================================================
app.get('/search', async function (req, res) {
  var query = req.query.q
  if (query && query.length > 1024) return
  var asyoutype = !!req.query.asyoutype
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
  const oldresult = await Result.findOne({ url: input.url })
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
app.post('/counter/:id', async function (req, res) {
  const cookiename = 'sfr_counter_' + req.params.id
  if (req.cookies[cookiename] !== 'false') {
    const count = await Counter.get(req.params.id)
    return res.json({ count })
  }
  const count = await Counter.increment(req.params.id)
  res.cookie(cookiename, 'true', { sameSite: 'None', secure: true, httpOnly: true, maxAge: 365 * 24 * 60 * 60 * 1000 }).json({ count })
})
app.get('/counter/:id', async function (req, res) {
  const cookiename = 'sfr_counter_' + req.params.id
  let voted = req.cookies[cookiename]
  if (voted !== 'true') voted = 'false'
  const count = await Counter.get(req.params.id)
  res.cookie(cookiename, voted, { sameSite: 'None', secure: true, httpOnly: true, maxAge: 365 * 24 * 60 * 60 * 1000 }).json({ count })
})

utils.apiservice.start().then(() => {
  Result.currencyTestLoop()
  Query.cleanupLoop()
})
