/* eslint-disable quote-props */

export function querysplit (query: string) {
  const clean = query.toLowerCase().replace(/[^\w-]+/g, ' ').trim()
  if (clean.length === 0) return []
  return clean.split(' ')
}

export function getFields (hash: any) { // Get the values from the hash as the field names in a SQL table.
  return new Set(Object.values(hash)) // Set() to just the distinct field names.
}

export function getAliases (hash: any) { // Get the keys from the hash as the aliases to the field names in a SQL table.
  return Object.keys(hash)
}

export function getPeopleDef () {
  const hash = {
    'lastname': 'lastname',
    'last name': 'lastname',
    'last': 'lastname',
    'firstname': 'firstname',
    'first name': 'firstname',
    'first': 'firstname',
    'name_title': 'name_title',
    'pronouns': 'pronouns',
    'userid': 'userid',
    'user id': 'userid',
    'email': 'email',
    'email address': 'email',
    'emailaddress': 'email',
    'title': 'title',
    'department': 'department',
    'dept': 'department',
    'address': 'address',
    'addr': 'address',
    'phone': 'phone',
    'phone number': 'phone',
    'phonenumber': 'phone',
    'telephone': 'phone',
    'telephone number': 'phone',
    'telephonenumber': 'phone',
    // 'altphone': 'altphone',
    'searchid': 'searchid',
    'category': 'category'
  }
  return {
    hash,
    defaults: ['lastname', 'firstname', 'phone', 'email'],
    fields: getFields(hash)
  }
}

export function getWhereClause (tableDef: any, search: string) {
  /* Takes tableDef and parsable search string as parameters.
  |    tableDef must define:
  |      - hash: An object that maps alias strings as keys to field names as values.
  |      - defaults: Array of default fields to compare on.
  |    search must be:
  |      - A string that will be parsed for tokens of simple search terms, tokens of advanced search phrases, or combos of the two.
  |      - Advanced search phrases consist of the following RegEx-ish form.
  |          (and |not |+|-)?((tableDef hash's Alias keys) *(contains|(ends|begins|starts) with|is|:|=|<|>) *)?(["']*|[,; ]+)what to search for\5+[,;]? *
  |          <   likeops   >  <         aliases          >  <                 wildcardops                 >   <<     \5     >      whatfor       >
  |  Returns an object of {sql: string, binds: [string]}. Example: {sql: ' where field like ?', binds: ['%whatfor%']}
  */
  const binds = []
  const fieldAliases = getAliases(tableDef.hash).join('|')
  // We need to break the RegEx down to interpolate the fieldAliases. While we're at it might as well tokenize
  // the parts into their respective purposes for easier editing if we decide to change functionality.
  const whatfors = /(?<whatfor>"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|(?:\\[,; ]|[^,; ])+)/ // What to search for.
  const wildcardops = /(?<wildcardop>:|=|<|>|contains?|(?:ends|begins|starts)\s?with|is)\s*/ // Add wildcards to search?
  const likeops = /(?<likeop>\+|-|not\s+|and\s+)/ // Like, or Not Like?
  const aliases = new RegExp(`(?<alias>${fieldAliases})\\s*`) // Aliases that translate to fields we search.
  const parser = new RegExp(`(?:${likeops.source})?(?:${aliases.source + wildcardops.source})?${whatfors.source}[,;]?\\s*`, 'gi')

  const whereClause = []
  for (const token of search.matchAll(parser)) {
    const { likeop, alias, wildcardop, whatfor } = token.groups as any
    const whatforbind = whatfor.replace(/^(["'])(.*?)\1$/, '$2') // Strip any grouping quotes.
    let wildcardbind = ''
    if (!wildcardop || /^(?:contains|:)/.test(wildcardop)) wildcardbind = `%${whatforbind}%`
    else if (/^(?:ends\s?with|>)/.test(wildcardop)) wildcardbind = `%${whatforbind}`
    else if (/^(?:(?:begins|starts)\s?with|<)/.test(wildcardop)) wildcardbind = `${whatforbind}%`
    else /*                        /^(?:is|=)/                */ wildcardbind = whatforbind
    // We've created our bind parameter for this token, now let's build the clause.
    let clause = '?'
    if (/^(?:not\s+|-)$/.test(likeop)) clause = `not like ${clause}`
    else /*  /^(?:and\s+|\+)$/ or !likeop */ clause = `like ${clause}`
    // Prepend our alias's SQL field name, if alias was parsed, else default to tableDef.defaults.
    if (alias) binds.push(wildcardbind) && (clause = `${tableDef.hash[alias]} ${clause}`)
    else clause = tableDef.defaults.map((field: any) => (binds.push(wildcardbind) && `(${field} ${clause})`)).join(' or ')
    whereClause.push(`(${clause})`)
  }
  return { sql: ' where ' + whereClause.join(' and '), binds }
}

export function getSortClause (tableDef: any, ...sortOptions: any[]) {
  /* Takes multiple sortOption parameters after tableDef.
  |    tableDef must define:
  |      - defaults: Array of default fields to compare on. First value is the sort default.
  |      - fields: Set of field names the table can be sorted on.
  |    sortOptions can be:
  |      - object pairs with {fields: (comma delimited string) and order: (d|desc)} - and/or
  |      - a comma delimited string of one or more options that will get a default order of asc(ending).
  |  Returns a string. Example: 'order by field1 desc, field2 asc'
  */
  const sortDefault = tableDef.defaults.join(', ')
  if (sortOptions.length === 0) return ` order by ${sortDefault}`

  const sortClause = []
  for (const optionToken of sortOptions) {
    if (!optionToken) {
      // Ignore this token if it's null or undefined.
    } else if (typeof optionToken === 'string') {
      const options = optionToken.split(/,\s*/)
      for (const option of options) { if (tableDef.fields.has(option)) sortClause.push(option + ' asc') }
    } else if (Object.prototype.hasOwnProperty.call(optionToken, 'fields') &&
                Object.prototype.hasOwnProperty.call(optionToken, 'order')) {
      const fieldOps = optionToken.fields.split(/,\s*/)
      for (const fieldOp of fieldOps) {
        if (tableDef.fields.has(fieldOp)) sortClause.push(fieldOp + ((optionToken.order?.match(/^(?:d|desc)/i)) ? ' desc' : ' asc'))
      }
    } else throw new TypeError('getSortClause(tableDef, ...sortOptions): sortOptions must be object pairs of fields and order or comma delimited strings.')
  }
  return 'order by ' + (sortClause.length === 0 ? sortDefault + ' asc' : sortClause.join(', ')) + ', email'
}

export function getLimitClause (pageNum: number, pageSizes: number) {
  /* Takes base 10 numeric parameters pageNum and pageSizes.
  |    pageNum: The page number of the result subset for subsets of size = or rounded up to pageSizes.
  |      - Sanity checked for truthy greater than 0, else defaults to 0 by way of an empty string.
  |    pageSizes: The maximum number of results allowed per page.
  |      - Sanity checked for truthy greater than 0, else defaults to all results by way of an emptry string.
  |  Returns a string. Example: ' limit 12, 3'
  */
  const limitDefault = ''
  const offset = (pageNum > 1) ? `${(pageNum - 1) * pageSizes}, ` : ''
  return (pageSizes > 0) ? ` limit ${offset}${pageSizes}` : limitDefault
}
