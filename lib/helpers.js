/* eslint-disable space-in-parens */
/* eslint-disable key-spacing */
/* eslint-disable no-multi-spaces */
/* eslint-disable quote-props */

class Helpers {
  static querysplit (query) {
    const clean = query.toLowerCase().replace(/[^\w-]+/g, ' ').trim()
    if (clean.length === 0) return []
    return clean.split(' ')
  }

  static getPeopleDef () {
    // First property's value determines default in getSortOp
    const peopleDef = { hash: {}, defaults: [] } // type tableDef -- I need to figure out how to create tableDef type that enforces creating these.
    peopleDef.hash = {
      'lastname':  'lastname',
      'last name': 'lastname',
      'last':      'lastname',
      'firstname':  'firstname',
      'first name': 'firstname',
      'first':      'firstname',
      'userid':  'userid',
      'user id': 'userid',
      'email':         'email',
      'email address': 'email',
      'emailaddress':  'email',
      'title': 'title',
      'department': 'department',
      'dept':       'department',
      'address': 'address',
      'addr':    'address',
      'phone':            'phone',
      'phone number':     'phone',
      'phonenumber':      'phone',
      'telephone':        'phone',
      'telephone number': 'phone',
      'telephonenumber':  'phone',
      'searchid': 'searchid',
      'category': 'category'
    }
    peopleDef.defaults = ['lastname', 'firstname', 'phone', 'email']
    return peopleDef
  }

  static getFields (hash) { // Get the values from the hash as the field names in the SQL table.
    return new Set(Object.values(hash)) // Set() to just the distinct field names.
  }

  static getAliases (hash) { // Get the keys from the hash as the aliases to the field names in the SQL table.
    return Object.keys(hash)
  }

  static getWhereClause (tableDef, search) {
    // Returns an object of Example: {sql: ' where field like ?', binds: ['%whatfor%']}
    const binds = []
    // Handle the most likely case that they send us a single word to query for.
    if (search.trim().split(/\s+/).length === 1) {
      const whatforbind = search.replace(/^(["'])(.*?)\1$/, '$2')
      return { sql: ' where ' + tableDef.defaults.map(field => (binds.push(`%${whatforbind}%`) && field + ' like ?')).join(' or '), binds: binds }
    }
    const fieldAliases = this.getAliases(tableDef.hash).join('|')
    // We need to break the RegEx down to string in the fieldAliases. While we're at it might as well tokenize
    // the parts into their respective purposes for easier editing if we decide to change functionality.
    const whatfors           = /(?<whatfor>"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|(?:\\[,; ]|[^,; ])+)/      // What to search for.
    const wildcardops        = /(?<wildcardop>:|=|<|>|contains?|(?:ends|begins|starts)\s?with|is)\s*/ // Add wildcards to search?
    const likeops            = /(?<likeop>\+|-|not\s+|and\s+)/                                        // Like, or Not Like?
    const aliases = new RegExp('(?<alias>' + fieldAliases + ')\\s*')                                  // Aliases that translate to fields we search.
    const parser  = new RegExp('(?:' + likeops.source + ')?(?:' + aliases.source + wildcardops.source + ')?' + whatfors.source + '[,;]?\\s*', 'gi')
    // /(?:(?<likeop>\+|-|not\s+|and\s+))?(?:(?<alias>$fieldAliases)\s*(?<wildcardop>:|=|<|>|contains?|(?:ends|begins|starts)\s?with|is)\s*)?(?<whatfor>"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|(?:\\[,; ]|[^,; ])+)[,;]?\s*/gi
    const whereClause = []
    const tokens = search.matchAll(parser)
    for (const token of tokens) { // Build our where clause parts out of the tokens building right to left within each part.
      const { likeop, alias, wildcardop, whatfor } = token.groups
      // Start building our clause with what we're searching for stripped of any grouping quotes in the string.
      const whatforbind = whatfor.replace(/^(["'])(.*?)\1$/, '$2')
      // Add SQL wildcard symbols for all cases except advanced search is|=.
      let wildcardbind = ''
      if (!wildcardop || /^(?:(?:begins|starts)\s?with|<)/.test(wildcardop)) wildcardbind =  `${whatforbind}%`
      else if (                       /^(?:ends\s?with|>)/.test(wildcardop)) wildcardbind = `%${whatforbind}`
      else if (                          /^(?:contains|:)/.test(wildcardop)) wildcardbind = `%${whatforbind}%`
      else /* (                             /^(?:is|=)/.test(wildcardop)) */ wildcardbind =     whatforbind
      // SQL query will search using like comparisons. The likeop determines negative or positive like if specified, else default to like.
      let clause = '?'
      if (!likeop || /^(?:and\s+|\+)$/.test(likeop)) clause =     `like ${clause}`
      else /* (   /^(?:not\s+|-)$/.test(likeop)) */  clause = `not like ${clause}`
      // Prepend our alias's SQL field name, if alias is specified, else default to tableDef.defaults.
      if (alias) binds.push(wildcardbind) && (clause = `${tableDef.hash[alias]} ${clause}`)
      else clause = tableDef.defaults.map(field => (binds.push(wildcardbind) && `(${field} ${clause})`)).join(' or ')// Didn't specify search alias. Try quering against all SQL fields we search.
      whereClause.push(`(${clause})`)
    }
    return { sql:' where ' + whereClause.join(' and '), binds: binds }
  }

  static getSortClause (tableDef, sortOption) {
    const sortDefault = tableDef.defaults[0]
    return ' order by ' + (this.getFields(tableDef.hash).has(sortOption) ? sortOption : sortDefault)
  }

  static getLimitClause (limit) {
    const limitDefault = ''
    return (limit > 0) ? ' limit ' + parseInt(Math.round(limit), 10) : limitDefault
  }
}

module.exports = Helpers
