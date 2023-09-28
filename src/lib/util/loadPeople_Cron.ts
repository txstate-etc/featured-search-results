import { CronJob } from 'cron'
import { loadPeople } from './loadPeople.js'

const cronString = '0 0 0/2 * * *' // Every even numbered hour on the hour. Doesn't seem to support */2 syntax for every 2 hours starting whenever.

/** Cron job to run the loadPeople process every 20th minute of the hour. */
export default new CronJob(cronString, function () {
  console.log(
    'Beginning `people` data reload at', new Date().toLocaleString('en-US', { timeZone: 'CST', timeZoneName: 'short' })
  )
  loadPeople().catch(console.error)
}, null, true, 'America/Chicago')
