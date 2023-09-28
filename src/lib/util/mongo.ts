import { connect as mongooseConnect } from 'mongoose'
import { sleep } from 'txstate-utils'

// database config
const dbHost = process.env.DB_HOST || 'localhost'
const dbPort = process.env.DB_PORT || '27017'
const dbAuthdb = process.env.DB_AUTHDATABASE || ''
const dbUser = process.env.DB_USER || ''
const dbPw = process.env.DB_PASSWORD || ''
const dbName = process.env.DB_DATABASE || 'default_database'
const dbUserpasswordPrefix = (dbUser.length > 0 && dbPw.length > 0) ? dbUser + ':' + dbPw + '@' : ''
const dbAuthdbSuffix = dbAuthdb.length > 0 ? '?authSource=' + dbAuthdb : ''

// start up
export const mongoConnect = async function () {
  let failures = 0
  while (true) {
    try {
      await mongooseConnect('mongodb://' + dbUserpasswordPrefix + dbHost + ':' + dbPort + '/' + dbName + dbAuthdbSuffix, {
        ssl: process.env.DB_SSL === 'true'
      })
      console.info('MongoDB connection alive')
      break
    } catch (err) {
      failures++
      console.log('Connection to MongoDB failed. Trying again in 200 milliseconds.')
      if (failures > 4) console.error(err)
      await sleep(200)
    }
  }
}
