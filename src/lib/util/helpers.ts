/* eslint-disable quote-props */
import { isNotBlank } from 'txstate-utils'

/** Uses URL constructor to test if `urlString` is a value conformant to valid URL standards. */
export function isValidUrl (urlString: string | undefined | null) {
  if (!urlString) return false
  try { return Boolean(new URL(urlString)) } catch (e) { return false }
  // Once we're able to upgrade to Node.js 19+ we can use the following instead:
  // return URL.canParse(urlString)
}
/** Casts `urlString` as a new URL to check for URL validity and tests the `protocol` of that URL
 * object to see if it's a HTTP or HTTPS protocol - returning true, or false if not. */
export function isValidHttpUrl (urlString: string) {
  try { return /https?:/.test(new URL(urlString).protocol) } catch (e) { return false }
}

// Debugging fuctions
const excludeHeaders = new Set(['cookie'])
const excludeHeadersRegex = new RegExp(`^(${[...excludeHeaders].join('|')})$`, 'i')
export function parseHeaders (headers: Headers) {
  const obj: Record<string, string> = {}
  headers.forEach((value, key) => { if (!excludeHeadersRegex.test(key)) obj[key] = value })
  return obj
}
export function logCookies (cookies: { name: string, value: string }[] | undefined | []) {
  if (!cookies || cookies.length === 0) return
  const obj: Record<string, string> = {}
  cookies.forEach((cookie) => {
    if (cookie.name === 'token') {
      obj[cookie.name] = `present with length ${cookie.value.length}`
    } else obj[cookie.name] = cookie.value
  })
  console.table([{ title: 'Cookies', ...obj }])
}
export function logResponse (res: Response) {
  const obj: Record<string, string> = {}
  if (res.status) obj.status = res.status.toString()
  if (res.statusText) obj.statusText = res.statusText
  if (res.redirected) obj.redirected = res.redirected.toString()
  if (res.url) obj.url = res.url
  if (res.type) obj.type = res.type
  if (res.bodyUsed) obj.bodyUsed = res.bodyUsed.toString()
  if (res.ok) obj.ok = res.ok.toString()
  const cookies = res.headers.get('cookie')?.split(';').map<{ name: string, value: string }>(c => ({ name: (c.split('=')[0] ?? 'no-name'), value: c.split('=')[1] ?? 'no-value' }))
  console.log('----- Response Status -----')
  console.table([{ title: 'Headers', ...parseHeaders(res.headers) }])
  logCookies(cookies)
  console.table([obj])
}
export function logEvent (event: any) {
  const requestedUrl = event.url.searchParams.get('requestedUrl')
  const unifiedJwt = event.url.searchParams.get('unifiedJwt')
  const token = event.cookies.get('token')
  const obj: Record<string, string> = {}
  if (event.request.method) obj['request.method'] = event.request.method
  if (event.request.url) obj['request.url'] = event.request.url
  if (event.request.referrer) obj['request.referrer'] = event.request.referrer
  if (event.request.credentials) obj['request.credentials'] = event.request.credentials
  if (event.request.destination) obj['request.destination'] = event.request.destination
  if (event.request.mode) obj['request.mode'] = event.request.mode
  if (event.request.cache) obj['request.cache'] = event.request.cache
  if (event.request.redirect) obj['request.redirect'] = event.request.redirect
  if (requestedUrl) obj['url.searchParams.unifiedJwt'] = event.url.searchParams.get('requestedUrl') ?? ''
  if (unifiedJwt) obj['url.searchParams.unifiedJwt'] = `present with length ${unifiedJwt.length}`
  if (event.isDataRequest) obj.isDataRequest = 'true'
  if (event.isSubRequest) obj.isSubRequest = 'true'
  if (event.route.id) obj['route.id'] = event.route.id
  console.log('----- Event Status -----')
  console.table([{ title: 'Headers', ...parseHeaders(event.request.headers) }])
  logCookies(event.cookies.getAll())
  console.table([obj])
}

/** Used in `getUrlEquivalences` to build domain permutations based on the original domain. */
const domainEqivalencies: Record<string, string[]> = {
  'txstate.edu': ['txst.edu', 'txstate.edu'],
  'txst.edu': ['txst.edu', 'txstate.edu']
}
/** Gets permutations of `url` that are its equivalents given our domain and sub-domain equivalencies as well as common
 * routing equivalencies. Usefull for checking uniqueness integrity of indexed URLs beyond their simple string values. */
export function getUrlEquivalencies (url: string): string[] {
  if (!isValidUrl(url)) return ['Invalid URL']
  const parsedUrl = new URL(url)
  const splitHost = parsedUrl.hostname.toLocaleLowerCase().split('.')
  const protocol = parsedUrl.protocol.toLocaleLowerCase()
  const box = splitHost.length > 2 ? splitHost.slice(0, -2).join('.') : ''
  const domain = splitHost.slice(-2).join('.')
  const port = parsedUrl.port ? `:${parsedUrl.port}` : ''
  const pathCleaned = parsedUrl.pathname.replace(/\/$/, '')
  const params = isNotBlank(parsedUrl.search) ? parsedUrl.search : ''
  const hash = parsedUrl.hash
  const equivalencies: string[] = []
  if (domainEqivalencies[domain]) {
    equivalencies.push(...Object.keys(domainEqivalencies).filter(key => key === domain).map(de => {
      return domainEqivalencies[de].map(domain => {
        return getEquivalencies(protocol, box, domain, port, pathCleaned, params, hash)
      })
    }).flat(2))
  } else {
    equivalencies.push(...getEquivalencies(protocol, box, domain, port, pathCleaned, params, hash))
  }
  return equivalencies
}
/** Takes the URL `protocol` of the original URL, the sub-domain/host portion of the original URL as the `box` parameter,
 * the cleaned (no trailing slash) path portion of the original URL as `cleanedPath`, along with the two part `domain`,
 * and the `port`, `params`, and `hash` portions of the original URL. Combines the `domain`, `port`, `cleanedPath`, `params`,
 * and `hash` into an array of pre-evaluated domain+path+params+hash equivalencies with both path equivalencies (trailing
 * slash and without) and calls a routine with the `protocol`, sub-domain, and those path equivalencies to build and return
 * an array of equivalent URLs with all our desired equivalent permutations of the `protocol`, `box`, and `pathEquivalencies`. */
function getEquivalencies (protocol: string, box: string, domain: string, port: string, cleanedPath: string, params: string, hash: string): string[] {
  const base = `${domain}${port}${cleanedPath}`
  const fullParams = `${params}${hash}`
  const pathEquivalencies = [`${base}${fullParams}`, `${base}/${fullParams}`]
  if (fullParams === '') pathEquivalencies.push(`${base}/.`)
  return getSubDomainEquivalencies(protocol, box, pathEquivalencies)
}
/** Takes the URL `protocol` of the original URL, the sub-domain/host portion of the original URL as the `box` parameter,
 * and an array of pre-evaluated domain+path+params+hash equivalencies as `pathEquivalencies`. Returns an array of equivalent
 * URLs with all our desired equivalent permutations of the `protocol`, `box`, and `pathEquivalencies`. */
function getSubDomainEquivalencies (protocol: string, box: string, pathEquivalencies: string[]): string[] {
  // While not universal, a lot of sites have corresponding www. and non-www. versions of their hostname configured
  // to be equivalent in their domain DNS. So we'll add that to our permutations for equivalency checking in
  // all scenarios since we're not forcing the use of this convention but checking for any URL equivalencies
  // where this might be the active convention.
  const splitBox = box.split('.')
  if (splitBox.length > 0 && (splitBox[0] === 'www' || splitBox[0] === '')) splitBox.shift()
  const hostBox = splitBox.length > 0
    ? splitBox.join('.') + '.'
    : ''
  const expanded = pathEquivalencies.map(url => { return [`//www.${hostBox}${url}`, `//${hostBox}${url}`] })
  /* const expanded = box !== '' && box !== 'www'
    ? pathEquivalencies.map(url => { return [`//${box}.${url}`] })
    : pathEquivalencies.map(url => { return [`//www.${url}`, `//${url}`] }) */
  const protocoled = /https?:/.test(protocol)
    ? expanded.flat(2).map(url => { return [`http:${url}`, `https:${url}`] })
    : expanded.flat(2).map(url => { return [`${protocol}${url}`] })
  return protocoled.flat(2)
}

/** "Cleans" `query` to all lowercase, with all whitespaces reduced to single space, and trims that result.
 * If there's anything left the result is returned as a tokenized string array split on the spaces. Else an
 * empty array is returned. */
export function querysplit (query: string) {
  const clean = query.toLowerCase().replace(/[^\w-]+/g, ' ').trim()
  if (clean.length === 0) return []
  return clean.split(' ')
}

/** `typeof` operator doesn't distinguish between 'object' and 'array' and we want the distinction here. */
export type EnhancedType = 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'undefined' | 'object' | 'function' | 'array'
export type NestingType = 'object' | 'array'
export type AggOp = 'count' | 'sum' | 'avg' | 'min' | 'max'
export type NestedProp<T> = T | NestedMeta<T>
// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export type NestedMeta<T> = { [key in NestingType]?: NestedProp<T> }
export type SearchMetas<T> = Record<string, NestedMeta<T> | NestedProp<T>>
export type SearchPropDefaults = EnhancedType | AggOp | 'date'
/** Utility function for getting the `typeof` an object with `array` differentiated from `object`. */
export function getType (obj: any) {
  let type: EnhancedType = typeof obj
  if (type === 'object' && Array.isArray(obj)) type = 'array'
  return type
}
interface SearchMappings {
  /** A mapping of search aliases to the table field they correspond to. */
  hash: Record<string, string>
  /** The fields of the record set and their associated primative-ish type. */
  metas?: SearchMetas<SearchPropDefaults>
  /** A mapping of search operators to common filter comparisons. */
  opHash?: Record<string, string>
  /** The default fields to compare search values against when none are specified. */
  defaults: string[]
  /** Convenience reference of distinct table fields available to compare against. */
  fields: Set<string>
}
/** Get the distinct values from `hash` as the field names in an SQL table or Mongo Collection. */
export function getFields (hash: any) {
  return new Set<string>(Object.values(hash)) // Set() to just the distinct field names.
}
/** Get the keys from `hash` as the aliases to the field names in an SQL table. */
export function getAliases (hash: Record<string, string>) {
  return Object.keys(hash)
}
/** Returns an object reference to a utility representation of the relationship between search
 *  terms and the underlying `people` table. */
export function getPeopleDef (): SearchMappings {
  const hash: Record<string, string> = {
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
    'netid': 'userid',
    'net id': 'userid',
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
  const defaults: string[] = ['lastname', 'firstname', 'userid', 'phone', 'email']
  return {
    hash,
    defaults,
    fields: getFields(hash)
  } as const
}
/** What to search for. Quoted things as a single what-for or anything that's either an escaped [comma, semicolon, space]
 *  or is not a [comma, semicolon or space] - making commas, semicolons, or spaces our delimiters when not grouped by quotes. */
export const whatfors = /(?<whatfor>"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|(?:\\[,; ]|[^,; ])+)/
export const wildcardops = /(?<wildcardop>:|<=|>=|=|<|>|\b(?:contains?|(?:ends|begins|starts)\s?with|is)\b)\s*/ // Add wildcards to search?
export const likeops = /(?<likeop>\+|-|\b(?:not|and)\b\s*)/ // Like, or Not Like?

/** Returns an SQL `where` clause using `tableDef` and parsable `search` string as parameters.
 * @param {SearchMappings} tableDef - A utility object used to associate search aliases and defaults to table fields.
 * @param {string} search
 * * A string that will be parsed for tokens of simple search terms, tokens of advanced search phrases, or combos of the two.
 * @returns
 * ```
 *   { sql: string, binds: [string] }
 * ```
 * @example
 * ```
 *   getWhereClause(someTableDef,'alias1 is a, alias2 begins with b')
 *   // Returns:
 *   { sql: ' where field1 like ? and field2 like ?', binds: ['a', 'b%'] }
 * ``` */
export function getWhereClause (tableDef: SearchMappings, search: string) {
  /* Advanced search phrases consist of the following RegEx-ish form.
  (and |not |+|-)?((tableDef.hash.keys) *(contains|(ends|begins|starts) with|is|:|=|<|>) *)?(["']*|[,; ]+)<what to search for>\5+[,;]? *
  <   likeops   >  <     aliases      >  <                 wildcardops                 >   <<     \5     >      whatfor      >
  */
  const binds = []
  const fieldAliases = getAliases(tableDef.hash).join('|')
  // We need to break the RegEx down to interpolate the fieldAliases. While we're at it might as well tokenize
  // the parts into their respective purposes for easier editing if we decide to change functionality.
  const aliases = new RegExp(`\\b(?<alias>${fieldAliases})\\b\\s*`) // Aliases that translate to fields we search.
  const parser = new RegExp(`(?:${likeops.source})?(?:${aliases.source + wildcardops.source})?${whatfors.source}[,;]?\\s*`, 'gi')

  const whereClause = []
  for (const token of search.matchAll(parser)) {
    const { likeop, alias, wildcardop, whatfor } = token.groups as any
    const whatforbind = whatfor.replace(/^(["'])(.*?)\1$/, '$2') // Strip any grouping quotes.
    let wildcardbind = ''
    if (!wildcardop || /^(?:contains|:)/.test(wildcardop)) wildcardbind = `%${whatforbind}%`
    else if (/^(?:ends\s?with|>=|>)/.test(wildcardop)) wildcardbind = `%${whatforbind}`
    else if (/^(?:(?:begins|starts)\s?with|<=|<)/.test(wildcardop)) wildcardbind = `${whatforbind}%`
    else /*                        /^(?:is|=)/                */ wildcardbind = whatforbind
    // We've created our bind parameter for this token, now let's build the clause.
    let clause = '?'
    if (/^(?:not\s+|-)$/.test(likeop)) clause = `not like ${clause}`
    else /*  /^(?:and\s+|\+)$/ or !likeop */ clause = `like ${clause}`
    // Prepend our alias's SQL field name, if alias was parsed, else default to tableDef.defaults.
    if (alias) binds.push(wildcardbind) && (clause = `${tableDef.hash[alias]} ${clause}`)
    else clause = tableDef.defaults.map((field: string) => (binds.push(wildcardbind) && `(${field} ${clause})`)).join(' or ')
    whereClause.push(`(${clause})`)
  }
  return { sql: ' where ' + whereClause.join(' and '), binds }
}
type SortOptions = string | { fields: string, order: 'd' | 'desc' } | undefined
/** Takes multiple sortOption parameters after tableDef.
 * @param {SearchMappings} tableDef - A utility object used to associate search aliases and defaults to table fields.
 * @param {any[]} sortOptions
 * * object pairs of `{fields: 'comma, delimited, string' order: 'd'|'desc'}`
 * * AND/OR a `'comma, delimited, string'` of one or more fields that will get a default order of asc(ending).
 * @returns {string} an SQL sort clause as a string with `tableDef` defaults if no valid fields are specified in `sortOptions` array.
 * @example
   ```
     getSortClause(someTableDef, [{ fields: 'field1', order: 'desc'}, 'field2, field3'])
     // Returns:
     'order by field1 desc, field2 asc, field3 asc'
   ``` */
export function getSortClause (tableDef: SearchMappings, ...sortOptions: SortOptions[]) {
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
    } else throw new TypeError('getSortClause(tableDef, ...sortOptions): sortOptions must be object pairs of `fields` and `order` or comma delimited strings.')
  }
  return 'order by ' + (sortClause.length === 0 ? sortDefault + ' asc' : sortClause.join(', ')) + ', email'
}
/** Generates an SQL limit clause from base 10 numeric parameters.
 * @param {number} pageNum The page number of the result subset for subsets of size = or rounded up to `pageSizes`.
 * - Sanity checked for truthy greater than 0, else defaults to 0 by way of an empty string.
 * @param {number} pageSizes The maximum number of results allowed per page.
 * - Sanity checked for truthy greater than 0, else defaults to all results by way of an emptry string.
 * @returns an SQL limit clause as string.
 * @example
   ```
   getLimitClause(3, 6)
   // Returns:
   ' limit 12, 6'
   ``` */
export function getLimitClause (pageNum: number, pageSizes: number) {
  const limitDefault = ''
  const offset = (pageNum > 1) ? `${(pageNum - 1) * pageSizes}, ` : ''
  return (pageSizes > 0) ? ` limit ${offset}${pageSizes}` : limitDefault
}

/** Returns an object reference to a utility representation of the relationship between search
 *  terms and the underlying `Result` documents. */
export function getResultsDef (): SearchMappings {
  const hash: Record<string, string> = {
    'title': 'title',
    'page name': 'title',
    'tag': 'tags',
    'tags': 'tags',
    'url': 'url',
    'path': 'url',
    'domain': 'url',
    'subdomain': 'url',
    'hostname': 'url',
    'broken': 'currency.broken',
    'brokensince': 'currency.brokensince',
    'duplicateurl': 'currency.conflictingUrl',
    'duplicatetitle': 'currency.conflictingTitle',
    'duplicatematch': 'currency.conflictingMatch',
    'match words': 'entries.keywords',
    'keyphrase': 'entries.keywords',
    'aliases': 'entries.keywords',
    'keywords': 'entries.keywords',
    'search': 'entries.keywords',
    'query': 'entries.keywords',
    'mode': 'entries.mode',
    'type': 'entries.mode',
    'priority': 'entries.priority',
    'weight': 'entries.priority',
    'hits': 'entries.hitCountCached',
    'count': 'entries.hitCountCached'
  }
  const metas: SearchMetas<SearchPropDefaults> = {
    'title': 'string',
    'tags': { array: 'string' },
    'url': 'string',
    'currency.broken': { object: 'boolean' },
    'currency.brokensince': { object: 'date' },
    'currency.conflictingUrl': { object: { array: 'string' } },
    'currency.conflictingTitle': { object: { array: 'string' } },
    'currency.conflictingMatch': { object: { array: 'object' } },
    'entries': { array: { object: 'object' } },
    'entries.keywords': { array: { object: { array: 'string' } } },
    'entries.mode': { array: { object: 'string' } },
    'entries.priority': { array: { object: 'number' } },
    'entries.hitCountCached': { array: { object: 'number' } }
  }
  const opHash: Record<string, string> = {
    ':': 'eq',
    '=': 'eq',
    'is': 'eq',
    'contains': 'in',
    '<': 'lt',
    '<=': 'lte',
    'starts with': 'lte',
    'startswith': 'lte',
    '>': 'gt',
    '>=': 'gte',
    'ends with': 'gte',
    'endswith': 'gte'
  }
  const defaults: string[] = ['title', 'tags', 'url', 'entries.keywords']
  return { hash, metas, defaults, fields: getFields(hash) } as const
}
const ISODay = 86400000
function getFilterExpression (searchVal: string, type: NestedProp<SearchPropDefaults>, field: string, op?: string | undefined) {
  if (!op || op === 'in') { // Also `contains` on strings.
    if (type === 'string') return { $regex: searchVal, $options: 'i' }
    if (['number', 'bigint'].includes(type as string)) return { $in: searchVal.split(' ').map(str => parseInt(str)).filter(num => !isNaN(num)) }
    if (type === 'boolean') return { $eq: /^true$/i.test(searchVal) } // TODO: Think through and test how this would work in a real world search and defaults scenario.
    if (type === 'date') return { $or: searchVal.split(' ').map(str => { return { [field ?? '']: { $gte: new Date(str), $lt: new Date(str).getTime() + ISODay } } }) }
  } else if (op === 'ne') {
    if (type === 'string') return { $not: { $regex: `^${searchVal}$`, $options: 'i' } }
    if (['number', 'bigint'].includes(type as string)) return { $ne: parseInt(searchVal) }
    if (type === 'boolean') return { $neq: /^true$/i.test(searchVal) } // TODO: Think through and test how this would work in a real world search and defaults scenario.
    if (type === 'date') return { $ne: new Date(searchVal) }
  } else if (op === 'eq') {
    if (type === 'string') return { $regex: `^${searchVal}$`, $options: 'i' }
    if (['number', 'bigint'].includes(type as string)) return { $eq: parseInt(searchVal) }
    if (type === 'boolean') return { $eq: /^true$/i.test(searchVal) } // TODO: Think through and test how this would work in a real world search and defaults scenario.
    if (type === 'date') return { $eq: new Date(searchVal) }
  } else if (op === 'lt') { // Also `starts with` on strings.
    if (type === 'string') return { $regex: `^${searchVal}`, $options: 'i' }
    if (['number', 'bigint'].includes(type as string)) return { $lt: parseInt(searchVal) }
    if (type === 'boolean') return { $neq: /^true$/i.test(searchVal) }
    if (type === 'date') return { $lt: new Date(searchVal) }
  } else if (op === 'lte') { // Also `starts with` on strings.
    if (type === 'string') return { $regex: `^${searchVal}`, $options: 'i' }
    if (['number', 'bigint'].includes(type as string)) return { $lte: parseInt(searchVal) }
    if (type === 'boolean') return { $eq: /^true$/i.test(searchVal) }
    if (type === 'date') return { $lte: new Date(searchVal) }
  } else if (op === 'gt') { // Also `ends with` on strings.
    if (type === 'string') return { $regex: `${searchVal}$`, $options: 'i' }
    if (['number', 'bigint'].includes(type as string)) return { $gt: parseInt(searchVal) }
    if (type === 'boolean') return Boolean(searchVal)
    if (type === 'date') return { $gt: new Date(searchVal) }
  } else if (op === 'gte') { // Also `ends with` on strings.
    if (type === 'string') return { $regex: `${searchVal}$`, $options: 'i' }
    if (['number', 'bigint'].includes(type as string)) return { $gte: parseInt(searchVal) }
    if (type === 'boolean') return Boolean(searchVal)
    if (type === 'date') return { $gte: new Date(searchVal) }
  }
  // Not doing $in or $nin at this level as there's no advanced search syntax equivalents for them.
}

function buildFilterDocument (tableDef: SearchMappings, alias: string, searchVal: string, op: string, sub?: { field: string, subType?: NestedProp<SearchPropDefaults>, subField?: string }) {
  const fieldName = sub?.field ?? tableDef.hash[alias]
  const fieldType = sub?.subType ?? tableDef.metas?.[fieldName]
  const stepOp = /^(?:eq|in|lt|lte|gt|gte)$/.test(op) ? op : tableDef.opHash?.[op] ?? 'eq'
  if (!fieldType) {
    console.error(`buildFilterDocument - fieldType not found for fieldName "${fieldName}" of alias "${alias}".`)
    return
  } else {
    console.log(`buildFilterDocument - ${fieldName} - fieldType: ${typeof fieldType}, ${typeof fieldType === 'object' ? JSON.stringify(fieldType) : fieldType}`)
  }
  const filter: any = {}
  if (typeof fieldType === 'object') { // We have nesting to recurse.
    const fieldStack = fieldName.split('.')
    const parentField = fieldStack.shift()!
    if (fieldType.array) {
      if (typeof fieldType.array === 'object') { // Nested recurse
        const subField = fieldStack.length ? fieldStack.join('.') : fieldName
        // const
        filter[parentField] = { $elemMatch: buildFilterDocument(tableDef, alias, searchVal, stepOp, { field: fieldName, subType: fieldType.array }) }
      } else {
        filter[fieldName] = { $elemMatch: getFilterExpression(searchVal, fieldType.array, stepOp) }
      }
    } else if (fieldType.object) {
      if (typeof fieldType.object === 'object') { // Nested recurse.
        // Figure out reverse polish notation handling for 'in' op nested in date fields.
        filter[parentField] = { $eq: buildFilterDocument(tableDef, alias, searchVal, stepOp, { field: fieldName, subType: fieldType.object }) }
      } else {
        if (stepOp === 'in' && fieldType.object === 'date') {
          return ''
        }
        filter[fieldName] = getFilterExpression(searchVal, fieldType, stepOp)
      }
    }
  } else { // We're at the end of the nesting.
    filter[fieldName] = getFilterExpression(searchVal, fieldType, stepOp)
  }
}

/** Returns an MQL `match` clause using `tableDef` and parsable `search` string as parameters.
 * @param {SearchMappings} tableDef - A utility object used to associate search aliases and defaults to table fields.
 * @param {string} search
 * * A string that will be parsed for tokens of simple search terms, tokens of advanced search phrases, or combos of the two.
 * @returns
 * ```
 *   { mql: string, binds: [string] }
 * ```
 * @example
 * ```
 *   getMatchClause(someTableDef,'alias1 is a, alias2 begins with b')
 *   // Returns:
 *   { mql: '{ field1: ?, field2: /$?/i }' }
 * ``` */
export function getMatchClause (tableDef: SearchMappings, search: string) {
  /* Advanced search phrases consist of the following RegEx-ish form.
  (and |not |+|-)?((tableDef.hash.keys) *(contains|(ends|begins|starts) with|is|:|<=|>=|=|<|>) *)?(["']*|[,; ]+)<what to search for>\5+[,;]? *
  <   likeops   >  <     aliases      >  <                 wildcardops                       >   <<     \5     >      whatfor      >
  */
  const binds = []
  const fieldAliases = getAliases(tableDef.hash).join('|')
  const aliases = new RegExp(`\\b(?<alias>${fieldAliases})\\b\\s*`) // Aliases that translate to fields we search.
  const parser = new RegExp(`(?:${likeops.source})?(?:${aliases.source + wildcardops.source})?${whatfors.source}[,;]?\\s*`, 'gi')

  const matchClause = []
  console.log(`helpers.getMatchClause(..., ${search})`)
  for (const token of search.matchAll(parser)) {
    console.log(`helpers.getMatchClause - token: ${token.toString()}`)
    const { likeop, alias, wildcardop, whatfor } = token.groups as any
    const whatforbind = whatfor.replace(/^(["'])(.*?)\1$/, '$2') // Strip any grouping quotes.
    if (!alias) {
      // Build default match clause for whatforbind
      const filterObj: any = {}
      // for (const field of tableDef.defaults) {
      // }
      matchClause.push(filterObj)
      continue
    }
    const fieldName = tableDef.hash[alias]
    const fieldType = tableDef.metas?.[fieldName]
    if (!fieldType) {
      console.error(`helpers.getMatchClause - fieldType not found for fieldName "${fieldName}" of alias "${alias}".`)
      continue
    } else {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      console.log(`helpers.getMatchClause - typeof fieldType: ${typeof fieldType}: ${typeof fieldType === 'object' ? fieldType.toString() : fieldType}`)
    }
    let regExBind = ''
    if (!wildcardop || /^(?:contains|:)/.test(wildcardop))/**/ regExBind = `/${whatforbind}/i`
    else if (/^(?:ends\s?with)/.test(wildcardop)) /*        */ regExBind = `/${whatforbind}$/i`
    else if (/^(?:(?:begins|starts)\s?with)/.test(wildcardop)) regExBind = `/^${whatforbind}/i`
    else /*                     /^(?:is|=)/                 */ regExBind = whatforbind
    // We've created our bind parameter for this token, now let's build the clause.
    let clause = regExBind
    if (/^(?:<=)/.test(likeop)) clause = `{ $lte: ${clause} }`
    else if (/^(?:>=)/.test(likeop)) clause = `{ $gte: ${clause} }`
    else if (/^(?:<)/.test(likeop)) clause = `{ $lt: ${clause} }`
    else if (/^(?:>)/.test(likeop)) clause = `{ $gt: ${clause} }`
    if (/^(?:not\s+|-)$/.test(likeop)) clause = `{ $ne: ${clause} }`
    else /*  /^(?:and\s+|\+)$/ or !likeop */ clause = `${clause}`
    // Prepend our alias's property name, if alias was parsed, else default to tableDef.defaults.
    if (alias) (clause = `{'${tableDef.hash[alias]}': ${clause}}`)
    else clause = tableDef.defaults.map((field: string) => (`{'${field}': ${clause}}`)).join('\n $or ')
    matchClause.push(clause)
  }
  return { mql: '{ ' + matchClause.join('} $and {') + ' }' }
}
