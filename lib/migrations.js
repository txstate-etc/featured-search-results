const db = require('mysql2-async/db').default
const loadPeople = require('../lib/loadPeople')

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
    
    WARNING!!! - Make sure to update searchIdsCopyStatement, directly below, if this DDL is updated.

    We're updating the searchids correlation table to pair with userids instead of plids.
    This may bite us in the future event that we push the capabilities of motion to include
    Person objects that lack netids but as currently defined motion will error if it somehow
    cobbles together a Person object that lacks a netid, so we can rely on userid/netid as
    an up-to-date correlation to the cached directory table and drop the fetching and storage
    of plid or aNumber values.
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
  // Statement for copying existing searchids data to new searchids table in event searchids DDL changes.
  // If the above DDL changes we may need to update this to handle accordingly.
  const searchIdsCopyStatement = `
    INSERT INTO searchids
      (userid, searchid)
      SELECT * FROM recovery_searchids
  `

/** Function for getting serverside DDL and locally defined DDL consistently formatted for comparisons. */
function cleanDDL(ddl) {
  // Make sure all :table-options: in the DDL above have = between key value pairs. Example: COMMENT='Some comment for table.'
  // Not nessary for :column-options:.
  return ddl.replace(/`/g,'').replace(/\s\s+/g,' ').replace(/\n/g,' ').replace(/ UNSIGNED /g,' unsigned ').trim()
}

/** Checks for existance of people-search-results related tables in ITSDB and creates them if not present.
 * If they are present it compares DDL defined in the migrations module to existing table DDL and recreates the
 * tables accordingly. Since searchids needs to be a persistent data set backing up and copying that data is
 * handled in here by the searchIdsCopyStatement defined above.
 */
module.exports = async function () {
  // const dropTablesResults = await db.query('DROP TABLE IF EXISTS people, searchids')
  const showTablesResults = await db.query('show tables')
  console.log('ITSDB:',showTablesResults)

  console.log('Checking table definitions in peoplesearch...')
  if ( showTablesResults.some(result => result.Tables_in_peoplesearch === 'people') ) {
    // Query for existing DDL and compare to coded DDL above to see if we've changed specs. Drop the table and recreate if so.
    const currentPeopleDDL = await db.query('show create table people')
    const formattedCurrentDDL = cleanDDL(currentPeopleDDL[0]['Create Table'])
    const formattedNewDDL = cleanDDL(peopleTableDDL)
    const compareResult = ( formattedCurrentDDL != formattedNewDDL )

    console.log(`Table \`people\` found in peoplesearch database.${compareResult ? '' : ' No DDL updates for the `people` table.'}`)
    if ( compareResult ) {
      console.log('Existing `people` table DDL does not match latest migrate DDL. Recreateing table...')
      const renameResult = await db.query('RENAME TABLE people TO recovery_people')
      const createResult = await db.query(peopleTableDDL)
      const dropResult = await db.query('DROP TABLE IF EXISTS recovery_people')
    }
  }
  else {
    console.log('Table `people` not found in peoplesearch database. Creating...')
    const createPeopleResult = await db.query(peopleTableDDL)
  }
  
  if ( showTablesResults.some(result => result.Tables_in_peoplesearch === 'searchids') ) {
    // We'll need to handle searchids differently from people if we change it's DDL - seachids' data needs to be persistent.
    const currentSearchIdsDDL = await db.query('show create table searchids')
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
    }
  }
  else {
    console.log('Table `searchids` not found in peoplesearch database. Creating...')
    const createSearchIdsResult = await db.query(searchIdsTableDDL)
  }
  
  try {
    Promise.all([loadPeople()])
  } catch (e) {
    // Transactions in load task should roll back. Log error so we can continue gracefully.
    console.log(e)
  }
}
