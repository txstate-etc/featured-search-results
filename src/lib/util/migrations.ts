/* eslint-disable indent */
import db from 'mysql2-async/db'

/** Putting these in constants for easier versioning reference and comparison to source if we want to update in the future.
We were adding `DEFAULT COLLATE=utf8mb4_general_ci` to this so LIKE comparisons would be case-insensitive but it's the
system default and will not show up when running `SHOW CREATE TABLE people` for DDL comparison. So removed from here. */
const peopleTableDDL = `
  CREATE TABLE people (
    firstname  varchar(64)           DEFAULT NULL COMMENT 'Preferred First plus Middle',
    lastname   varchar(64)           DEFAULT NULL COMMENT 'Last name - no variants to consider.',
    userid     varchar(8)   NOT NULL              COMMENT 'The NetID of the user.',
    email      varchar(64)           DEFAULT NULL COMMENT 'The campus email address on record. Can be alias.',
    title      varchar(128)          DEFAULT NULL COMMENT 'The job title listed in AD or PYBEMPL.',
    address    varchar(128)          DEFAULT NULL COMMENT 'The office building acronym and room - sourced from PYBEMPL.',
    department varchar(128)          DEFAULT NULL COMMENT 'The associated department listed in AD or PYBEMPL.',
    phone      varchar(14)           DEFAULT NULL COMMENT 'The office telephone number found in AD in US national format.',
    phoneURI   varchar(16)           DEFAULT NULL COMMENT 'The office telephone number in URI format.',
    category   varchar(64)           DEFAULT NULL COMMENT 'The primary role - Faculty, Staff, Retired - found in AD or GORIROL.',
    name_title varchar(16)           DEFAULT NULL COMMENT 'Any special naming prefixes such as Dr., Sgt, or Capt, but not common prefixes such as Mr., Mrs., etc.',
    pronouns   varchar(128)          DEFAULT NULL COMMENT 'The third person personal pronoun antecedent-agreement mappings found in SAP or Banner.',
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
  COMMENT='Cache table of faculty and staff directory information. Transactionally emptied and reloaded by search-featured-results/lib/loadPeople.'
`
/**
  We're updating the searchids correlation table to pair with userids instead of plids.

  Decided not compare DDL for the searchids table since an update to MySQL, or config changes
  to it, could trigger the DDL to not match and create potential for things to go wrong leaving
  the searchids table renamed to recovery_searchids. */
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
 * selects of the data cleaner to write and parse. In additon we can easily update to join in different
 * exclusions like we've done with special_exclusions. */
const peopleSearchViewDDL = `
  CREATE OR REPLACE VIEW people_search AS
  SELECT people.*, searchids.searchid
    FROM people
    INNER JOIN searchids
            ON (people.userid = searchids.userid)
    LEFT OUTER JOIN special_exclusions
                  ON people.userid = special_exclusions.userid
    WHERE special_exclusions.userid IS NULL`
//   -- WHERE people.private = 0 -- Removed this as fac/staff directory info is public information that can't be exempted.

/** We need to be able to exclude some special case userids from the peoplesearch API results. We'll create a table for that and load manually. */
const exclusionsTableDDL = `
  CREATE TABLE special_exclusions (
    userid varchar(8) NOT NULL COMMENT 'The NetID to be excluded from API results.'
  )
  ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COMMENT='Table of special case netids to be excluded from API results. These are special exceptions to the directory inclusion given to us by requests from ITAC. Useful for protecting stalked identities.'`

/** Function for getting serverside DDL and locally defined DDL consistently formatted for comparisons. */
function cleanDDL (ddl: string) {
  // Make sure all :table-options: in the DDL above have = between key value pairs. Example: COMMENT='Some comment for table.'
  // Not nessary for :column-options:.
  return ddl.replace(/`/g, '').replace(/\s\s+/g, ' ').replace(/\n/g, ' ').replace(/ UNSIGNED /g, ' unsigned ').replace(/ (CHARSET=utf8mb4).*COMMENT=/, ' $1 COMMENT=').trim()
}

/** Returns the current time in a compact format suitable for a table name.
 * Example: 2026Dec04_0801 */
function getUsableDateString () {
  const now = new Date()
  const options = { timezone: 'UTC' }
  const year = now.toLocaleString('en-US', { ...options, year: 'numeric' })
  const month = now.toLocaleString('en-US', { ...options, month: 'short' })
  const day = now.toLocaleString('en-US', { ...options, day: '2-digit' })
  const clunkHour = now.toLocaleString('en-US', { ...options, hour: '2-digit' })
  const hour = clunkHour.endsWith('PM') ? parseInt(clunkHour, 10) + 12 : `${parseInt(clunkHour, 10)}`.padStart(2, '0')
  const minute = now.toLocaleString('en-US', { ...options, minute: '2-digit' }).padStart(2, '0')
  return `${year}${month}${day}_${hour}${minute}`
}

/** Checks for existance of people-search-results related tables in ITSDB and creates them if not present.
 * If they are present it compares DDL defined in this migrations module to existing table DDL and recreates the
 * tables accordingly. Only does the DDL compare for the people table.
 */
export async function migrate () {
  // const dropTablesResults = await db.query('DROP TABLE IF EXISTS recovery_searchids, recovery_people, recovery_people_2022Apr06_2258')
  console.log('Checking table and view definitions in peoplesearch...')
  console.group()
  const tables = await db.getvals('show tables')
  console.log('ITSDB-Tables-n-Views:\n ', tables.join('\n  '))
  if (tables.length > 10) {
    console.log('WARNING!!!!!! We shouldn\'t have so many tables! Something went wrong with our migrations! Need human intervention!')
  }
  console.log()
  if (tables.some(table => table === 'people')) {
    // Query for existing DDL and compare to coded DDL above to see if we've changed specs. Drop the table and recreate if so.
    // TODO:
    // TODO:
    // TODO: Let's drop this DDL compare after we're done with transition to ITSDB, or at least have a way of flagging when we want this feature on.
    // TODO:
    // TODO:
    const currentPeopleDDL: any = await db.query('show create table people')
    const formattedCurrentDDL = cleanDDL(currentPeopleDDL[0]['Create Table'])
    const formattedNewDDL = cleanDDL(peopleTableDDL)
    const compareResult = (formattedCurrentDDL !== formattedNewDDL)

    console.log(`Table \`people\` found in peoplesearch database.${compareResult ? '' : ' No DDL updates for the `people` table.'}`)
    if (compareResult) {
      console.log('Existing `people` table DDL does not match latest migrate DDL. Recreateing table...')
      console.log(formattedCurrentDDL)
      console.log(formattedNewDDL)
      const recoveryName = `recovery_people_${getUsableDateString()}`
      await db.execute(`RENAME TABLE people TO ${recoveryName}`)
      await db.execute(peopleTableDDL)
      await db.execute(`DROP TABLE IF EXISTS ${recoveryName}`)
    }
  } else {
    console.log('Table `people` not found in peoplesearch database. Creating...')
    await db.execute(peopleTableDDL)
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
    await db.execute(searchIdsTableDDL)
  }

  if (tables.some(table => table === 'special_exclusions')) {
    console.log('Table `special_exclusions` found in peoplesearch database. DDL compare bypassed for this sensitive table.')
    // We'll need to handle special_exclusions differently from people if we change it's DDL - special_exclusions' data needs to be persistent.
  } else {
    console.log('Table `special_exclusions` not found in peoplesearch database. Creating...')
    await db.execute(exclusionsTableDDL)
  }

  console.log('Creating or replacing `people_search` convenience view...')
  // Not going to worry about checking if the view exists, just run the create or replace.
  await db.execute(peopleSearchViewDDL)
  console.groupEnd()
}
