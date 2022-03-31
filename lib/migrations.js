/* eslint-disable no-unused-vars */
/* eslint-disable indent */
const db = require('mysql2-async/db').default
const Db = require('mysql2-async').default
const warehouseDB = new Db({
    host: process.env.WAREHOUSE_HOST,
    port: process.env.WAREHOUSE_PORT,
    user: process.env.WAREHOUSE_USER,
    password: process.env.WAREHOUSE_PASS,
    database: process.env.WAREHOUSE_DATABASE
})

/**  Checks if local searchids table is populated. If not it populates it from warehouse.
 *
 * The old load process added searchid to both swtpeople as well as a separate searchid table. This was to
 * accomodate different demands on the old system. For our purposes, since we're not concerned with preserving
 * every searchid association ever made, we can do an initial one-time population of searchids by selecting
 * userid, searchid from swtpeople in the warehouse and inserting into our new searchids table. Once our
 * searchids table has that inital load of records we won't bother syncing again as the potential for data
 * loss is not as significant a loss as overcomplicating this code.
 *
 * With that said having this searchids migrated from swtpeople first, we'll load people table later, without
 * checking for needed searchids as we do that, and then join to searchids to find entries in people that don't
 * have a searchid associated. We'll then generate a searchid to associate with them to insert into searchids.
 * That will be done transactionally with the load.
 */
async function cloneSearchIdTableData () {
  console.log('Migrating searchids data if needed...')
  console.group()

  try { // Catching errors here in case we're all good but the warehouse access is decommed.
    const warehouseCount = await warehouseDB.getval('SELECT count(*) FROM swtpeople')
    console.info(`Currently there are ${warehouseCount} active searchid associations in the warehouse.`)
  } catch (e) { console.log(e) }

  const searchidsCount = await db.getval('SELECT count(*) FROM searchids')
  if (searchidsCount > 0) {
    console.log(`Table \`searchids\` is already populated with ${searchidsCount} associations. Bypassing migration of data from warehouse.`)
    console.groupEnd()
    return
  }

  // Not catching errors here. If we fail here we want to hard fail the error up.
  console.log('Table `searchids` is empty. Cloning searchids data from warehouse...')
  console.group()
  const stream = warehouseDB.stream('SELECT userid, searchid FROM swtpeople')
  for await (const row of stream) {
      const insertResult = await db.query('INSERT INTO searchids (userid, searchid) VALUES (?, ?)', [row.userid, row.searchid])
  }
  const recordCount = await db.getval('SELECT count(*) FROM searchids')
  console.log(`${recordCount} searchid associations cloned over from warehouse.`)
  console.groupEnd()
  console.groupEnd()
}

  // Putting these in constants for easier versioning reference and comparison to source if we want to update in the future.
  // We were adding `DEFAULT COLLATE=utf8mb4_general_ci` to this so LIKE comparisons would be case-insensitive but it's the
  // system default and will not show up when running `SHOW CREATE TABLE people` for DDL comparison. So removed from here.
  const peopleTableDDL = `
    CREATE TABLE people (
      firstname  varchar(64)  DEFAULT NULL COMMENT 'Preferred First plus Middle',
      lastname   varchar(64)  DEFAULT NULL COMMENT 'Last name - no variants to consider.',
      userid     varchar(8)   NOT NULL     COMMENT 'The AD based netId of the user.',
      email      varchar(64)  DEFAULT NULL COMMENT 'The campus email address on record. Can be alias.',
      title      varchar(128) DEFAULT NULL COMMENT 'The job title listed in AD.',
      address    varchar(128) DEFAULT NULL COMMENT 'The office building acronym and room - sourced from PYBEMPL.',
      department varchar(128) DEFAULT NULL COMMENT 'The associated department listed in AD.',
      phone      varchar(16)  DEFAULT NULL COMMENT 'The office telephone number found in AD.',
      category   varchar(64)  DEFAULT NULL COMMENT 'The associated display role found in AD.',
      name_title varchar(16)  DEFAULT NULL COMMENT 'Any special naming prefixes such as Dr., Sgt, or Capt, but not common prefixes such as Mr., Mrs., etc.',
      PRIMARY KEY (userid),
      KEY firstname (firstname,lastname,email,phone), 
      KEY lastname (lastname),
      KEY email (email),
      KEY phone (phone),
      KEY userid (userid),
      KEY title (title),
      KEY address (address),
      KEY department (department),
      KEY category (category)
    ) 
    ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4
    COMMENT='Cache table of faculty and staff directory information. Loaded by search-featured-results/lib/loadPeople.'
  `
  /*
    We're updating the searchids correlation table to pair with userids instead of plids.

    Decided not compare DDL for the searchids table since an update to MySQL, or config changes
    to it, could trigger the DDL to not match and create potential for things to go wrong leaving
    the searchids table renamed to recovery_searchids.
  */
  const searchIdsTableDDL = `
    CREATE TABLE searchids (
      userid   varchar(8)          NOT NULL COMMENT 'The corresponding userid/netId of the user this searchid is locked to.',
      searchid int(11)    UNSIGNED NOT NULL COMMENT 'The random number generated searchid locked to the associated userid.',
      PRIMARY KEY (userid),
      UNIQUE KEY searchid (searchid)
    )
    ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4
    COMMENT='A table used to permanently associate linkable searchids to users in the cached directory people table. NOTE: They might not be in there.'
  `
  /* We decided searchids was too sensitive of a table to risk random updates to MySQL possibly causing
   * constant rebuilds of it that could fail.
   * Statement for copying existing searchids data to new searchids table in event searchids DDL changes.
   * If the above DDL changes we may need to update this to handle accordingly.
  const searchIdsCopyStatement = `
    INSERT INTO searchids
      (userid, searchid)
      SELECT userid, searchid FROM recovery_searchids
  ` */

  /** Since we're needing to join searchids to people we're creating this convenience view to make
   * selects of the data cleaner to write and parse. */
  const peopleSearchViewDDL = `
    CREATE OR REPLACE VIEW people_search AS
    SELECT people.*, searchids.searchid
      FROM people
     INNER JOIN searchids
             ON (people.userid = searchids.userid)
  `

/** Function for getting serverside DDL and locally defined DDL consistently formatted for comparisons. */
function cleanDDL (ddl) {
  // Make sure all :table-options: in the DDL above have = between key value pairs. Example: COMMENT='Some comment for table.'
  // Not nessary for :column-options:.
  return ddl.replace(/`/g, '').replace(/\s\s+/g, ' ').replace(/\n/g, ' ').replace(/ UNSIGNED /g, ' unsigned ').trim()
}

/** Checks for existance of people-search-results related tables in ITSDB and creates them if not present.
 * If they are present it compares DDL defined in this migrations module to existing table DDL and recreates the
 * tables accordingly. Only does the DDL compare for the people table.
 * Also checks if searchids has records and migrates data over from the warehouse to load it if not.
 */
module.exports = async function () {
  // const dropTablesResults = await db.query('DROP TABLE IF EXISTS recovery_searchids')
  console.log('Checking table and view definitions in peoplesearch...')
  console.group()
  const tables = await db.getvals('show tables')
  console.log('ITSDB-Tables-n-Views:\n ', tables.join('\n  '))
  if (tables.some(table => table === 'people')) {
    // Query for existing DDL and compare to coded DDL above to see if we've changed specs. Drop the table and recreate if so.
    const currentPeopleDDL = await db.query('show create table people')
    const formattedCurrentDDL = cleanDDL(currentPeopleDDL[0]['Create Table'])
    const formattedNewDDL = cleanDDL(peopleTableDDL)
    const compareResult = (formattedCurrentDDL !== formattedNewDDL)

    console.log(`Table \`people\` found in peoplesearch database.${compareResult ? '' : ' No DDL updates for the `people` table.'}`)
    if (compareResult) {
      console.log('Existing `people` table DDL does not match latest migrate DDL. Recreateing table...')
      const renameResult = await db.query('RENAME TABLE people TO recovery_people')
      const createResult = await db.query(peopleTableDDL)
      const dropResult = await db.query('DROP TABLE IF EXISTS recovery_people')
    }
  } else {
    console.log('Table `people` not found in peoplesearch database. Creating...')
    const createPeopleResult = await db.query(peopleTableDDL)
  }

  if (tables.some(table => table === 'searchids')) {
    console.log('Table `searchids` found in peoplesearch database. DDL compare bypassed for this sensitive table.')
    // We'll need to handle searchids differently from people if we change it's DDL - seachids' data needs to be persistent.
    /* const currentSearchIdsDDL = await db.query('show create table searchids')
    const formattedCurrentDDL = cleanDDL(currentSearchIdsDDL[0]['Create Table'])
    const formattedNewDDL = cleanDDL(searchIdsTableDDL)
    const compareResult = ( formattedCurrentDDL != formattedNewDDL )

    console.log(`Table \`searchids\` found in peoplesearch database.${compareResult ? '' : ' No DDL updates for the `searchids` table.'}`)
    if ( compareResult ) {
      console.log('Existing `searchids` table DDL does not match latest migrate DDL. Recreateing table...')
      const renameResult = await db.query('RENAME TABLE searchids TO recovery_searchids')
      const createResult = await db.query(searchIdsTableDDL)
      const copyResult = await db.query(searchIdsCopyStatement)
      const dropResult = await db.query('DROP TABLE IF EXISTS recovery_searchids')
    } */
  } else {
    console.log('Table `searchids` not found in peoplesearch database. Creating...')
    const createSearchIdsResult = await db.query(searchIdsTableDDL)
  }

  console.log('Creating or replacing `people_search` convenience view...')
  // Not going to worry about checking if the view exists, just run the create or replace.
  const createView = await db.query(peopleSearchViewDDL)
  console.groupEnd()

  await cloneSearchIdTableData()
}
