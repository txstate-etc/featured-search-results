const CronJob = require('cron').CronJob
const reload = require('./loadPeople')

const cronString = '0 0 0/2 * * *' // Every even numbered hour on the hour. Doesn't seem to support */2 syntax for every 2 hours starting whenever.

/** Cron job to run the loadPeople process every 20th minute of the hour. */
module.exports = new CronJob(cronString, function () {
  console.log(
    'Beginning `people` data reload at', new Date().toLocaleString('en-US', { timeZone: 'CST', timeZoneName: 'short' })
  )
  console.group()
  reload()
  console.groupEnd()
}, null, true, 'America/Chicago')
