import { parsePhoneNumber } from 'libphonenumber-js'

/** Local service for creating a token authenticated connection to Motion and executing GraphQL queries against it. */
class MotionService {
  /** Simple function for posting the query to Motion and directly returning the array of JSON results sent back. */
  async query <T> (query: string, variables?: any) {
    const result = await fetch(process.env.MOTION_URL!, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.MOTION_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    })
    if (!result.ok) throw new Error(result.statusText + JSON.stringify({ query, variables }, null, 2))
    const data = await result.json()
    if (data.errors?.length) throw new Error(data.errors[0].message)
    return data.data as T
  }

  /** Sends a query to Motion for faculty and staff users and returns their records formatted for easy people table insertion. */
  async getFacultyStaff () {
    const data = await this.query<{ users: {
      aNumber: string
      netid: string
      name: {
        preferredFirstPlusMiddle: string
        last: string
        prefixSpecial: string
        pronouns: string
      }
      campusEmail: string
      jobTitle: string
      department: string
      office: {
        displayString: string
      }
      officePhone: string
      displayRole: string
    }[] }>(`
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

export const motion = new MotionService()
