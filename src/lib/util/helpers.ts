/* eslint-disable @typescript-eslint/dot-notation */
/* eslint-disable quote-props */
import type { PipelineStage } from 'mongoose'
import { isNotBlank } from 'txstate-utils'

export interface SortParam {
  field: string
  direction: 'asc' | 'desc'
}
export interface Paging {
  page?: number
  size?: number
  sorts?: SortParam[]
}

/** Uses URL constructor to test if `urlString` is a value conformant to valid URL standards. */
export function isValidUrl (urlString: string | undefined | null) {
  if (!urlString) return false
  // try { return Boolean(new URL(urlString)) } catch (e) { return false }
  // Once we're able to upgrade to Node.js 19+ we can use the following instead:
  return URL.canParse(urlString)
}
/** Casts `urlString` as a new URL to check for URL validity and tests the `protocol` of that URL
 * object to see if it's a HTTP or HTTPS protocol - returning true, or false if not. */
export function isValidHttpUrl (urlString: string) {
  try { return /https?:/.test(new URL(urlString).protocol) } catch (e) { return false }
}
/** Formats URLs to:
  - lowercase the protocol and host portions of parsable urls
  - trims spaces */
export function normalizeUrl (url: string) {
  if (isValidUrl(url)) {
    const parsed = new URL(url)
    return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${parsed.pathname}${parsed.search}${parsed.hash}`
  }
  return url.trim()
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
  const splitHost = parsedUrl.hostname.toLowerCase().split('.')
  const protocol = parsedUrl.protocol.toLowerCase()
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
  if (splitBox.length && (splitBox[0] === 'www' || splitBox[0] === '')) splitBox.shift()
  const hostBox = splitBox.length
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
// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export type MappingType = Record<string, any> | EnhancedType | 'date'

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
  metas?: Record<string, any>
  /** Any lookup definitions needed for foreign keyed collections. */
  lookups?: Record<string, PipelineStage>
  /** A mapping of search operators to common filter comparisons. */
  opHash?: Record<string, string>
  /** The default fields to compare search values against when none are specified. */
  defaults: string[]
  /** For DBs that struggle with certain sorting patterns like parallel arrays in MongoDB. */
  noSort?: Set<string>
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
  return { hash, defaults, fields: getFields(hash) } as const
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

interface MetaStage {
  union: object[]
  intersect: object[]
  projection: Record<string, any>
  lookups: PipelineStage[]
  post: { union: object[], intersect: object[] }
}
/** Returns an object reference to a utility representation of the relationship between search
 *  terms and the underlying `Query` documents. */
export function getQueriesDef (): SearchMappings {
  const hash: Record<string, string> = {
    'match words': 'query',
    'keyphrase': 'query',
    'aliases': 'query',
    'keywords': 'query',
    'query': 'query',
    'search': 'query',
    'term': 'query',
    'terms': 'query',
    'title': 'results::results.title',
    'page name': 'results::results.title',
    'url': 'results::results.url',
    'path': 'results::results.url',
    'domain': 'results::results.url',
    'subdomain': 'results::results.url',
    'hostname': 'results::results.url',
    'hits': 'query::hitcount',
    'count': 'query::hitcount',
    'hitcount': 'query::hitcount',
    'lasthit': 'query::lasthit',
    'last hit': 'query::lasthit'
  }
  const metas: MappingType = {
    'query': 'string',
    'query::hitcount': { $size: '$hits' },
    'hitcount': 'number',
    'query::lasthit': { $arrayElemAt: [{ $slice: ['$hits', -1] }, 0] },
    'lasthit': 'date',
    'results::results.title': undefined,
    'results.title': 'string',
    'results::results.url': undefined,
    'results.url': 'string'
  }
  const lookups: Record<string, PipelineStage> = {
    results: {
      $lookup: {
        from: 'results',
        localField: 'results',
        foreignField: '_id',
        as: 'results',
        pipeline: [{ $project: { title: 1, url: 1 } }]
      }
    }
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
  const defaults: string[] = ['query']
  return { hash, metas, lookups, opHash, defaults, fields: getFields(hash) } as const
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
    'duplicateurl': 'currency.conflictingUrls.url',
    'duplicateurls': 'results::conflictingUrls.length',
    'duplicatetitle': 'currency.conflictingTitles.title',
    'duplicatetitles': 'currency.conflictingTitles',
    'duplicatematch': 'currency.conflictingMatchings.mode',
    'duplicatematches': 'currency.conflictingMatchings',
    'match words': 'entries.keywords',
    'keyphrase': 'entries.keywords',
    'aliases': 'entries.keywords',
    'keywords': 'entries.keywords',
    'search': 'entries.keywords',
    'query': 'entries.keywords',
    'term': 'entries.keywords',
    'terms': 'entries.keywords',
    'mode': 'entries.mode',
    'type': 'entries.mode',
    'priority': 'entries.priority',
    'weight': 'entries.priority',
    'hits': 'entries.hitCountCached',
    'count': 'entries.hitCountCached'
  }
  const metas: MappingType = {
    'title': 'string',
    'tags': { array: 'string' },
    'url': 'string',
    'currency.broken': 'boolean',
    'currency.brokensince': 'date',
    'results::conflictingUrls.length': { $size: '$currency.conflictingUrls' },
    'conflictingUrls.length': 'number',
    'currency.conflictingUrls.url': 'string',
    'currency.conflictingTitles': 'boolean',
    'currency.conflictingTitles.title': 'string',
    'currency.conflictingMatchings': 'boolean',
    'currency.conflictingMatchings.mode': 'string',
    'entries.keywords': { array: 'string' },
    'entries.mode': 'string',
    'entries.priority': 'number',
    'entries.hitCountCached': 'number'
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
  const noSort: Set<string> = new Set<string>(['entries.keywords', 'entries.mode', 'entries.priority', 'entries.hitCountCached'])
  return { hash, metas, opHash, defaults, fields: getFields(hash), noSort } as const
}
/** Returns an array of MQL aggregation stages using `tableDef`, parsable `search` string, and an array of `sorts` SortParam as parameters.
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
export function getMongoStages (tableDef: SearchMappings, search: string, sorts: SortParam[] = []): PipelineStage[] {
  /* Advanced search phrases consist of the following RegEx-ish form.
  (and |not |+|-)?((tableDef.hash.keys) *(contains|(ends|begins|starts) with|is|:|<=|>=|=|<|>) *)?(["']*|[,; ]+)<what to search for>\5+[,;]? *
  <   likeops   >  <     aliases      >  <                 wildcardops                       >   <<     \5     >      whatfor      >
  */
  const fieldAliases = getAliases(tableDef.hash).join('|')
  const aliases = new RegExp(`\\b(?<alias>${fieldAliases})\\b\\s*`) // Aliases that translate to fields we search.
  const parser = new RegExp(`(?:${likeops.source})?(?:${aliases.source + wildcardops.source})?${whatfors.source}[,;]?\\s*`, 'gi')
  // console.log(parser)

  const metaStage: MetaStage = {
    union: [],
    intersect: [],
    projection: {},
    lookups: [],
    post: { union: [], intersect: [] }
  }
  for (const token of search.matchAll(parser)) {
    const { likeop, alias, wildcardop, whatfor } = token.groups as any
    const searchVal = whatfor.replace(/^(["'])(.*?)\1$/, '$2') // Strip any grouping quotes.
    const negation = likeop ? /^(?:not\s+|-)$/.test(likeop) : false
    const intersection = likeop ? /^(?:and\s+|\+)$/.test(likeop) : false
    console.table(token)
    console.log('getMatchClause - negation:', negation, ' intersection:', intersection)
    if (!alias) { // Build default match clause.
      const defaults: object[] = []
      for (const field of tableDef.defaults) {
        if (field.includes('::')) {
          mutateLookupsAndProjections(tableDef, metaStage, field, searchVal, negation, intersection)
          console.log('getMatchClause - post-metaStage:', metaStage)
          continue
        }
        defaults.push({ [field]: getFilterExpression(searchVal, tableDef.metas?.[field] ?? 'string', negation, field) })
      }
      if (intersection) metaStage.intersect.push({ $or: defaults })
      else metaStage.union.push(...defaults)
      continue
    }
    const fieldName = tableDef.hash[alias]
    const op = tableDef.opHash?.[wildcardop]
    console.log('getMatchClause - fieldName:', fieldName, ' op:', op)
    // Handle Projections and Lookups.
    if (fieldName.includes('::')) {
      mutateLookupsAndProjections(tableDef, metaStage, fieldName, searchVal, negation, intersection, op)
      console.log('getMatchClause - post-metaStage:', metaStage)
      continue
    }
    // Get initial stage match clause.
    const fieldType = tableDef.metas?.[fieldName]
    console.log('getMatchClause - fieldType:', fieldType)
    if (intersection) metaStage.intersect.push({ [fieldName]: getFilterExpression(searchVal, fieldType, negation, fieldName, op) })
    else metaStage.union.push({ [fieldName]: getFilterExpression(searchVal, fieldType, negation, fieldName, op) })
  }
  // Pre-Filter before lookups and projections.
  const stages: PipelineStage[] = [getMatchStage(metaStage.union, metaStage.intersect)]
  // Add any lookups.
  if (metaStage.lookups.length) stages.push(...metaStage.lookups)
  // Add projection.
  if (Object.values(metaStage.projection).length) stages.push({ $addFields: metaStage.projection })
  // Add any post-projection matching.
  stages.push(getMatchStage(metaStage.post.union, metaStage.post.intersect))
  // Add any sorting.
  stages.push(getSortStage(tableDef, sorts))
  // Add count of results matched.
  stages.push({ $group: { _id: null, docs: { $push: '$$ROOT' }, totalMatches: { $sum: 1 } } })
  return stages
}
function mutateLookupsAndProjections (tableDef: SearchMappings, metaStage: MetaStage, fieldName: string, searchVal: string, negation: boolean, intersection: boolean, op?: string | undefined) {
  const [local, alias] = fieldName.split('::')
  metaStage.projection[alias] = tableDef.metas?.[fieldName]
  if (tableDef.lookups?.[local] && !metaStage.projection[local]) {
    metaStage.lookups.push(tableDef.lookups[local])
    console.table(metaStage.lookups)
  }
  const fieldType = tableDef.metas?.[alias]
  if (intersection) metaStage.post.intersect.push({ [alias]: getFilterExpression(searchVal, fieldType, negation, alias, op) })
  else metaStage.post.union.push({ [alias]: getFilterExpression(searchVal, fieldType, negation, alias, op) })
  return metaStage
}
function getMatchStage (unions: object[], intersects: object[]): PipelineStage {
  if (unions.length && intersects.length) return { $match: { $and: [{ $or: unions }, ...intersects] } }
  else if (intersects.length) return { $match: { $and: intersects } }
  else if (unions.length) return { $match: { $or: unions } }
  return { $match: {} }
}
function getSortStage (tableDef: SearchMappings, sortOrder: SortParam[]): PipelineStage {
  const sort: Record<string, any> = {}
  for (const order of sortOrder) {
    const field = order.field
    if (tableDef.noSort?.has(field)) continue
    sort[field] = order.direction === 'asc' ? 1 : -1
  }
  for (const field of tableDef.defaults) {
    if (!sort[field] && !tableDef.noSort?.has(field)) sort[field] = 1
  }
  return { $sort: sort }
}
function getFilterExpression (searchVal: string, type: MappingType, negation?: boolean, field?: string, op?: string | undefined): object {
  if (negation) return { $not: getFieldExpression(searchVal, type, field, op) }
  return getFieldExpression(searchVal, type, field, op)
}
const ISODay = 86400000
function getFieldExpression (searchVal: string, type: MappingType, field?: string, op?: string | undefined): Record<string, any> {
  if (typeof type === 'object') {
    if (type.object) return getFieldExpression(searchVal, type.object, op)
    else if (type.array) {
      if (type.array === 'count') {
        const expr: Record<string, any> = getFieldExpression(searchVal, 'number', op)
        for (const key in expr) {
          expr[key] = [{ $size: `$${field}` }, expr[key]]
        }
        return { $expr: expr }
      }
      return { $elemMatch: getFieldExpression(searchVal, type.array, op) }
    }
  }
  if (op === undefined || op === 'in') { // Also `contains` on strings.
    if (type === 'string') return { $regex: searchVal, $options: 'i' }
    if (['number', 'bigint'].includes(type as string)) return { $in: searchVal.split(' ').map(str => parseInt(str)).filter(num => !isNaN(num)) }
    if (type === 'boolean') return { $eq: /^true$/i.test(searchVal) }
    if (type === 'date') return { $gte: new Date(searchVal), $lt: new Date(searchVal).getTime() + ISODay }
  } else if (op === 'ne') {
    if (type === 'string') return { $not: { $regex: `^${searchVal}$`, $options: 'i' } }
    if (['number', 'bigint'].includes(type as string)) return { $ne: parseInt(searchVal) }
    if (type === 'boolean') return { $neq: /^true$/i.test(searchVal) }
    if (type === 'date') return { $lt: new Date(searchVal), $gt: new Date(searchVal).getTime() + ISODay }
  } else if (op === 'eq') {
    if (type === 'string') return { $regex: `^${searchVal}$`, $options: 'i' }
    if (['number', 'bigint'].includes(type as string)) return { $eq: parseInt(searchVal) }
    if (type === 'boolean') return { $eq: /^true$/i.test(searchVal) }
    if (type === 'date') return { $gte: new Date(searchVal), $lt: new Date(searchVal).getTime() + ISODay }
  } else if (op === 'lt') { // Also `starts with` on strings.
    if (type === 'string') return { $regex: `^${searchVal}`, $options: 'i' }
    if (['number', 'bigint'].includes(type as string)) return { $lt: parseInt(searchVal) }
    if (type === 'boolean') return { $neq: /^true$/i.test(searchVal) }
    if (type === 'date') return { $lt: new Date(searchVal) }
  } else if (op === 'lte') { // Also `starts with` on strings.
    if (type === 'string') return { $regex: `^${searchVal}`, $options: 'i' }
    if (['number', 'bigint'].includes(type as string)) return { $lte: parseInt(searchVal) }
    if (type === 'boolean') return { $eq: /^true$/i.test(searchVal) }
    if (type === 'date') return { $lte: new Date(searchVal).getTime() + ISODay }
  } else if (op === 'gt') { // Also `ends with` on strings.
    if (type === 'string') return { $regex: `${searchVal}$`, $options: 'i' }
    if (['number', 'bigint'].includes(type as string)) return { $gt: parseInt(searchVal) }
    if (type === 'boolean') return { $eq: /^true$/i.test(searchVal) }
    if (type === 'date') return { $gt: new Date(searchVal).getTime() + ISODay }
  } else if (op === 'gte') { // Also `ends with` on strings.
    if (type === 'string') return { $regex: `${searchVal}$`, $options: 'i' }
    if (['number', 'bigint'].includes(type as string)) return { $gte: parseInt(searchVal) }
    if (type === 'boolean') return { $eq: /^true$/i.test(searchVal) }
    if (type === 'date') return { $gte: new Date(searchVal) }
  }
  throw new Error(`getFilterExpression - type:op "${JSON.stringify(type)}:${op}" not found. - Should never reach this error.`)
}
