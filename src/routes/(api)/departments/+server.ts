import { json } from '@sveltejs/kit'
import db from 'mysql2-async/db'

/** @type {import('./$types').RequestHandler} */
export async function GET () {
  const departmentsSQL = `
    SELECT DISTINCT department AS name from people
     WHERE department is not null
       AND department != ""
       AND category != "Retired"
     ORDER BY department ASC`
  const departments = await db.getall(departmentsSQL)
  return json({
    count: departments.length,
    lastpage: 1,
    results: departments
  })
}
