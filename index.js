const utils = require('txstate-node-utils')
const cookieparser = require('cookie-parser')
const db = require('mysql2-async/db').default
const app = utils.apiservice.app
const util = utils.util
const Helpers = require('./lib/helpers')

utils.apiservice.addDomain(/txstate\.edu$/)
utils.apiservice.addDomain(/txst\.edu$/)
utils.apiservice.addDomain(/tsus\.edu$/)
utils.apiservice.addDomain(/tjctc\.org$/)
app.use(cookieparser())

// models
const Result = require('./models/result')
const Query = require('./models/query')
const Counter = require('./models/counter')
// const { count } = require('./models/result')
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
app.use('/peoplesearch', function (req, res, next) {
  res.set('Access-Control-Allow-Credentials', 'true')
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
  const response = { count: 0, lastpage: 1, results: [] }
  if (!params.q) return res.json(response)// Handle empty request.
  params.n = (params.n > 0) ? parseInt(Math.round(params.n), 10) : 10// Normalize the n results returned/page. default = 10
  params.p = (params.p > 0) ? parseInt(Math.round(params.p), 10) : 1// Normalize the p page number requested. default = 1

  const peopleDef = Helpers.getPeopleDef()
  const whereClause = Helpers.getWhereClause(peopleDef, params.q)
  const countSQL = 'select count(*) from people_search' + whereClause.sql
  const listingSQL = `select * from people_search ${whereClause.sql} ${Helpers.getSortClause(peopleDef, params.sort)} ${Helpers.getLimitClause(params.p, params.n)}`
  const [hitCount, people] = await Promise.all([
    db.getval(countSQL, whereClause.binds),
    db.getall(listingSQL, whereClause.binds)
  ])
  // eslint-disable-next-line no-return-assign
  people.forEach(person => { delete person.plid && Object.keys(person).forEach(property => person[property] = (person[property] ? person[property].toString() : '')) })
  response.count = hitCount
  response.lastpage = Math.ceil(response.count / params.n)
  response.results = people
  res.json(response)
})
app.get('/departments', async function (req, res) {
  const departmentsSQL = `
    SELECT DISTINCT department AS name from people
     WHERE department is not null
       AND department != ""
       AND category != "Retired"
     ORDER BY department ASC`
  const departments = await db.getall(departmentsSQL)
  res.json({
    count: departments.length,
    lastpage: 1,
    results: departments
  })
})
// ====================================================================================================================================
app.get('/search', async function (req, res) {
  const query = req.query.q
  if (!query?.length || query.length < 3 || query.length > 1024) return res.json([])
  const asyoutype = !!req.query.asyoutype
  const results = await Result.findByQuery(query)
  const ret = results.map(result => result.basic())
  res.json(ret)
  if (!asyoutype) Query.record(query, results)
})
app.get('/adminsearch', authorize, async function (req, res) {
  const query = req.query.q
  if (query && query.length > 1024) return res.status(400).send('Query length is limited to 1kB.')
  const results = await Result.findByQuery(query)
  const ret = results.map(result => result.basicPlusId())
  res.json(ret)
})
app.get('/results', authorize, async function (req, res) {
  const ret = (await Result.getAllWithQueries()).map(result => { return result.fullWithCount() })
  res.json(ret)
})
app.post('/result', authorize, async function (req, res) {
  const input = req.body
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
  const result = await Result.getWithQueries(req.params.id)
  res.json(result.full())
})
app.put('/result/:id', authorize, async function (req, res) {
  if (!util.isHex(req.params.id)) return res.status(400).send('Bad id format. Should be a hex string.')
  if (!req.body) return res.status(400).send('POST body was not parseable JSON.')
  const result = await Result.findById(req.params.id)
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

const migrate = require('./lib/migrations')
const loadPeople = require('./lib/loadPeople')
const reloadPeopleCron = require('./lib/loadPeople_Cron')

async function main () {
  await utils.apiservice.start(async () => {
    await migrate()
    await Result.migratePriority()
    try {
      await loadPeople()
    } catch (e) {
      console.error(e)
    }
  })
  reloadPeopleCron.start()
  Result.currencyTestLoop()
  Query.cleanupLoop()
}

main().catch(e => { console.error(e); process.exit(1) })
