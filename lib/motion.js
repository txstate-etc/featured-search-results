/* eslint-disable indent */
const axios = require('axios')
const https = require('https')
const { parsePhoneNumber } = require('libphonenumber-js')

/** Local service for creating a token authenticated connection to Motion and executing GraphQL queries against it. */
class MotionService {
  constructor () {
    this.client = axios.create({
      baseURL: process.env.MOTION_URL,
      headers: {
        authorization: `Bearer ${process.env.MOTION_TOKEN}`
      },
      httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 10 })
    })
  }

  /** Simple function for posting the query to Motion and directly returning the array of JSON results sent back. */
  async query (query, variables) {
    const result = await this.client.post('', { query, variables })
    return result.data.data
  }

  /** Sends a query to Motion for faculty and staff users and returns their records formatted for easy people table insertion. */
  async getFacultyStaff () {
    const data = await this.query(`
    query peopleSearchLoad {
      users (filter:{roles: ["STAFF","FACULTY","RETIREDSTAFF","RETIREDFACULTY"]}) {
          aNumber
          netid
          name {
            preferredFirstPlusMiddle
            last
            prefixSpecial
            pronouns
          }
          campusEmail
          jobTitle
          department
          office {
            displayString
          }
          officePhone
          displayRole
      }
    }`)
    return data.users.map(u => ({
            plid: u.aNumber,
          userid: u.netid,
       firstname: u.name.preferredFirstPlusMiddle,
        lastname: u.name.last,
        pronouns: u.name.pronouns,
      name_title: u.name.prefixSpecial,
           email: u.campusEmail,
           title: u.jobTitle,
      department: u.department,
    //     address: u.officeBldg ? `${u.officeBldg} ${u.officeRoom ?? ''}` : undefined,
         address: (u.displayRole !== 'Retired') ? u.office?.displayString?.replace(':', '') : undefined, // Retired employees don't have associated office.
           phone: u.officePhone ? parsePhoneNumber(u.officePhone).formatNational() : undefined,
        phoneURI: u.officePhone,
        category: u.displayRole
    }))
  }
}

module.exports = new MotionService()
