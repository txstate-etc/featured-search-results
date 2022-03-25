const db = require('mysql2-async/db').default
const Db = require('mysql2-async').default
const motion = require('./motion')

/** Returns a PoolOptions compatible record with the options needed to connect to the peoplesearch database in the warehouse. */
function getWareHousePoolOptions () {
  return {
    host: process.env.WAREHOUSE_HOST,
    port: process.env.WAREHOUSE_PORT,
    user: process.env.WAREHOUSE_USER,
    password: process.env.WAREHOUSE_PASS,
    database: process.env.WAREHOUSE_DATABASE
  }
}

/** Checks for searchid clone in ITSDB, clones it over if not present. If it is present, checks for differeces to sync and syncs them. */
async function cloneOrSyncSearchIdTable () {
  const warehouseDB = new Db( getWareHousePoolOptions() )
  const showTablesResults = await warehouseDB.query('show tables')
  console.log('WAREHOUSEDB:',showTablesResults)

  // const dropTablesResults = await db.query('DROP TABLE IF EXISTS searchid')
  const showITSDBTablesResults = await db.query('show tables')
  if ( showITSDBTablesResults.some(result => result.Tables_in_peoplesearch === 'searchid') ) {
    console.log('Existing `searchid` clone found in ITSDB. Estimating differences...')
    // For a quick low impact check get counts from each.
    const countWarehouseEstimate = await warehouseDB.query('SELECT count(*) FROM searchid')
    console.log('WAREHOUSEDB:',Object.values(countWarehouseEstimate[0]))
    let countITSDBEstimate = await db.query('SELECT count(*) FROM searchid')
    console.log('ITSDB:      ',Object.values(countITSDBEstimate[0]))

    /* Convenience section for purposefully makeing the tables not match for verification.
    const fetchedITSDBPlids = await db.getvals('SELECT plid FROM searchid')
    const testerPlid = fetchedITSDBPlids.pop()
    const deleteResult = await db.query(`DELETE FROM searchid WHERE plid=?`, [testerPlid])
    */

    // If the counts are the same assume we have sync'd tables and don't put query load on DBs looking for differences.
    if (Object.values(countWarehouseEstimate[0])[0] != Object.values(countITSDBEstimate[0])[0]) {
      console.log("Counts between databases don't match. Finding missing records and inserting...")
      // Query existing table for plids, query warehouse where plids not in ITSDB plids. Insert those into ITSDB clone.
      const fetchedITSDBPlids = await db.getvals('SELECT plid FROM searchid')
      const selectBinds = []
      const warehouseRecords = await warehouseDB.getall(`SELECT * FROM searchid WHERE plid NOT IN (${db.in(selectBinds, fetchedITSDBPlids)})`, selectBinds)
      if ( warehouseRecords.length ) {
        const insertBinds = []
        const insertResult = await db.query(`INSERT INTO searchid (plid, searchid) VALUES ${db.in(insertBinds, warehouseRecords.map(record => Object.values(record)))}`, insertBinds)
      }
      countITSDBEstimate = await db.query('SELECT count(*) FROM searchid')
      console.log('ITSDB:      ',countITSDBEstimate)
    }
    else console.log('Counts between databases matches up. Bypassed sync load on databases.')
  }
  else {
    console.log('No local copies of `searchid` found. Cloning table definition...')
    const searchidGetDDLResult = await warehouseDB.query('show create table searchid')
    const createITSDBSearchIdResult = await db.query(searchidGetDDLResult[0]['Create Table'])
    const countWarehouseEstimate = await warehouseDB.query('SELECT count(*) FROM searchid')
    console.log('WAREHOUSEDB:',countWarehouseEstimate)
    const searchidRecords = await warehouseDB.getall('SELECT * FROM searchid')
    const binds = []
    const searchidInsertsResult = await db.query(`INSERT INTO searchid (plid, searchid) VALUES ${db.in(binds, searchidRecords.map(record => Object.values(record)))}`, binds)
    const countITSDBEstimate = await db.query('SELECT count(*) FROM searchid')
    console.log('ITSDB:      ',countITSDBEstimate)
  }

}

/** Loads the people table, and updates the searchids table, in ITSDB by first ensuring an up-to-date clone of the searchid table
 * from the warehouse peoplesearch database, and then querying Motion to collect the faculty and staff data needed to populate
 * the people directory and associated searchid's used to generate static linkable references.
 */
module.exports = async function () {
/*
  We're going to copy over the old searchid table, query motion adding aNumber to query, load the people table while
  updating new searchids table checking for existing entries in the old searchid table accordingly. We'll then keep the
  copied over searchid table which we'll reuse to only copy over what we need in the future.

  First import from mysql2-async in a way that we can provide our own config to the old peoplesearch databases on phrixos.

  Copy the searchid table from there to ITSDB peoplesearch.
  Load people and searchids from Motion query checking against old searchid table for existing searchid values corresponding
  to aNumber from Motion query. 
    We have a problem here we may need to solve. How do we keep the searchids in sync between both databases given the values aren't hashed but random number generations?
    Maybe we create searchids with two searchid columns? One that has the old random value, a new one that's a hash.
    If we use a hash how do we keep it from being exploited later. Perhaps in searchids, a table that should be persistent to some degree, we store an additional safety
    column to specify that netid+seachid's info has been requested as private.
*/



  console.log('Inspecting warehouse clone needs...')
  await cloneOrSyncSearchIdTable()

  console.log('Loading ITSDB people table...')
  const facultyStaff = await motion.getFacultyStaff()
  console.log(facultyStaff)

}
