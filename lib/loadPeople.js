/* eslint-disable no-unused-vars */
/* eslint-disable indent */
const db = require('mysql2-async/db').default
const motion = require('./motion')

/** Randomly generates numbers and checks them against existing searchids associations.
 * @returns The first unclaimed value or `undefined` after 10 tries.
 */
async function generateNewSearchId () {
  for (let i = 0; i < 10; i++) {
    const newSearchId = Math.floor(Math.random() * Math.pow(2, 31))
    if (!await db.getval('SELECT searchid FROM searchids WHERE searchid=?', newSearchId)) {
      return newSearchId
    }
  }
  return undefined
}

/** Queries Motion for all faculty and staff with an AD record. Then transactionally deletes from
 *  and loads the `people` table with the queried Motion records, and updates the `searchids` table
 *  for any entries in the reloaded `people` table lacking an associated searchid in `searchids`.
 *  If any errors it rolls back the entire transaction. */
module.exports = async function () {
  try {
    // Throwing this block into a try/catch since the Motion query could fail if Motion is down.
    // In that even we want to log an error and continue running with the data in the table unchanged.
    console.log('Querying for faculty and staff to load into ITSDB `people` table...')
    const facultyStaff = await motion.getFacultyStaff()

    console.log('Loading `people` table from results...')
    console.group()

    const loadDef = await db.getvals(`
      SELECT column_name 
        FROM information_schema.columns
       WHERE table_schema='peoplesearch'
         AND table_name='people'`
    )
    const peopleInsertVals = []
    const filterRegEx = /(Faculty|Staff|Retired).*/
    facultyStaff.forEach(person => {
      const record = []
      // Adding this test because AD doesn't always return just (Faculty|Staff|Retired) for displayRole.
      // We need to filter out things like Guests, Lockout, and we'll need to replace Retired.* with Retired.
      if (filterRegEx.test(person.category)) {
        for (const field of loadDef) {
          if (field === 'category') {
            record.push(person[field].replace(filterRegEx, '$1'))
          } else {
            record.push(person[field])
          }
        }
        peopleInsertVals.push([record])
      }
    })
    const chunkSize = 1000
    const chunkedInserts = Array.from({ length: Math.ceil(peopleInsertVals.length / chunkSize) },
                                      (_, index) => peopleInsertVals.slice(index * chunkSize, (index + 1) * chunkSize)
    )

    await db.transaction(async db => {
      const deleteResult = await db.delete('DELETE FROM people')

      for (const chunk of chunkedInserts) {
        const binds = []
        const insertResult = await db.insert(`
          INSERT INTO people (${loadDef.join(',')})
          VALUES ${db.in(binds, chunk)}`, binds)
      }

      const needsSearchId = await db.getvals(`
        SELECT people.userid 
          FROM people 
          LEFT OUTER JOIN searchids
                      ON (people.userid = searchids.userid)
        WHERE searchids.userid IS NULL`
      )
      for (const userid of needsSearchId) {
        const newSearchId = await generateNewSearchId()
        const insertResult = db.insert('INSERT INTO searchids (userid, searchid) VALUES (?, ?)', [userid, newSearchId])
      }
    })
    const peopleCount = await db.getval('SELECT count(*) FROM people')
    const searchidsCount = await db.getval('SELECT count(*) FROM searchids')
    console.log(`${peopleCount} records loaded into \`people\` with ${searchidsCount} searchid associations stored in \`searchids\`.`)
    console.groupEnd()
  } catch (e) { console.log(e) }

  /* const notInPeople = await db.getvals(`
    SELECT searchids.userid
      FROM searchids
      LEFT OUTER JOIN people
                    ON (people.userid = searchids.userid)
      WHERE people.userid IS NULL`)
  console.log(notInPeople) */
}
