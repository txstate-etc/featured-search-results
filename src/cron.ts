import { mongoConnect } from './lib/util/mongo.js'
import { Query } from './lib/models/query.js'
import { Result } from './lib/models/result.js'
import loadPeopleCron from './lib/util/loadPeople_Cron.js'
import { migrate } from './lib/util/migrations.js'

async function main () {
  await migrate()
  await mongoConnect()
  await Query.cleanupLoop()
  await Result.currencyTestLoop()
  loadPeopleCron.start()
}

main().catch(console.error)
