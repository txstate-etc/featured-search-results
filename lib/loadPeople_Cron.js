var CronJob = require('cron').CronJob
const reload = require('./loadPeople')

const cronString = '0 0/20 * * * *' // Every 20th minute of the hour. Doesn't seem to support */20 syntax for every 20 minutes.

/** Cron job to run the loadPeople process every 20th minute of the hour. */
module.exports = new CronJob(cronString, function () {
  console.log(
    'Beginning `people` data reload at', new Date().toLocaleString('en-US', { timeZone: 'CST', timeZoneName: 'short' })
  )
  console.group()
  reload()
  console.groupEnd()
}, null, true, 'America/Chicago')
