const db = require('mysql2-async/db').default

  // Putting these in constants for easier versioning reference and comparison to source if we want to update in the future.
  const peopleTableDDL = `
    CREATE TABLE people (
      firstname  char(64)  DEFAULT NULL COMMENT 'Preferred First plus Middle',
      lastname   char(64)  DEFAULT NULL COMMENT 'Last name - no variants to consider.',
      userid     char(8)   NOT NULL     COMMENT 'The AD based netId of the user.',
      email      char(64)  DEFAULT NULL COMMENT 'The campus email address on record. Can be alias.',
      title      char(128) DEFAULT NULL COMMENT 'The job title listed in AD.',
      address    char(128) DEFAULT NULL COMMENT 'The office building acronym and room - sourced from PYBEMPL.',
      department char(128) DEFAULT NULL COMMENT 'The associated department listed in AD.',
      phone      char(16)  DEFAULT NULL COMMENT 'The office telephone number found in AD.',
      category   char(64)  DEFAULT NULL COMMENT 'The associated display role found in AD.',
      name_title char(16)  DEFAULT NULL COMMENT 'Any special naming prefixes such as Dr., Sgt, or Capt, but not common prefixes such as Mr., Mrs., etc.',
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
    ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    COMMENT='Cache table of faculty and staff directory information. Loaded by search-featured-results/lib/migration.'
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
      userid   char(8)          NOT NULL COMMENT 'The corresponding userid/netId of the user this searchid is locked to.',
      searchid int(11) UNSIGNED NOT NULL COMMENT 'The random number generated searchid locked to the associated userid.',
      PRIMARY KEY (userid),
      UNIQUE KEY searchid (searchid)
    )
    ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    COMMENT='A table used to permanently associate linkable searchids to users in the cached directory people table. NOTE: They might not be in there.'
  `
  // Statement for copying existing searchids data to new searchids table in event searchids DDL changes.
  // If the above DDL changes we may need to update this to handdle accordingly.
  const searchIdsCopyStatement = `
    INSERT INTO temp_searchids
      (userid, searchid)
      SELECT * FROM searchids
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
  console.log(showTablesResults)

  if ( showTablesResults.some(result => result.Tables_in_peoplesearch === 'people') ) {
    console.log('people table found in peoplesearch database.')
    // Query for existing DDL and compare to coded DDL above to see if we've changed specs. Drop the table and recreate if so.
    const currentPeopleDDL = await db.query('show create table people')
    const formattedCurrentDDL = cleanDDL(currentPeopleDDL[0]['Create Table'])
    const formattedNewDDL = cleanDDL(peopleTableDDL)

    if ( formattedCurrentDDL != formattedNewDDL ) {
      console.log('Existing people table DDL does not match latest migrate DDL. Recreateing table.')
      const renameResult = await db.query('RENAME TABLE people TO recovery_people')
      const recreateResult = await db.query(peopleTableDDL)
      const dropResult = await db.query('DROP TABLE IF EXISTS recovery_people')
    }
  }
  else {
    console.log('people table not found in peoplesearch database. Creating...')
    const createPeopleResult = await db.query(peopleTableDDL)
  }
  
  if ( showTablesResults.some(result => result.Tables_in_peoplesearch === 'searchids') ) {
    console.log('searchids table found in peoplesearch database.')
    // We'll need to handle searchids differently from people if we change it's DDL - seachids' data needs to be persistent.
    const currentSearchIdsDDL = await db.query('show create table searchids')
    const formattedCurrentDDL = cleanDDL(currentSearchIdsDDL[0]['Create Table'])
    const formattedNewDDL = cleanDDL(searchIdsTableDDL)

    if ( formattedCurrentDDL != formattedNewDDL ) {
      console.log('Existing searchids table DDL does not match latest migrate DDL. Recreateing table.')
      const createResult = await db.query(searchIdsTableDDL.replace(/table searchids/,'table temp_searchids'))
      const copyResult = await db.query(searchIdsCopyStatement)
      const dropResult = await db.query('DROP TABLE IF EXISTS searchids')
      const renameResult = await db.query('RENAME TABLE temp_searchids TO searchids')
    }
  }
  else {
    console.log('searchids table not found in peoplesearch database. Creating...')
    const createSearchIdsResult = await db.query(searchIdsTableDDL)
  }
}
