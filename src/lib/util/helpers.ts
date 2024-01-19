/* eslint-disable @typescript-eslint/dot-notation */
/* eslint-disable quote-props */
import type { ObjectId, PipelineStage } from 'mongoose'
import { isNotBlank } from 'txstate-utils'

export interface SortParam {
  field: string
  direction: 'asc' | 'desc'
}
export interface Paging {
  page?: number // url-param: p
  size?: number // url-param: n
  sorts: SortParam[] // url-param: s
}
export interface AdvancedSearchResult {
  matches: Record<string, any>[]
  total: number
  search: string
  pagination?: Paging
  meta?: MetaSearch
}

export function getPagingParams (params: URLSearchParams): Paging {
  const page = params.get('p') ?? undefined
  const size = params.get('n') ?? undefined
  const sorts = params.get('s') ?? undefined
  const pagination: Paging = { sorts: sorts ? JSON.parse(sorts) : [] }
  if (page) pagination.page = Number(page)
  if (size) pagination.size = Number(size)
  return pagination
}
export function stringifyPagingParams (paging: Paging): string {
  const page = paging.page ? `&p=${paging.page}` : ''
  const size = paging.size ? `&n=${paging.size}` : ''
  const sorts = paging.sorts.length ? `&s=${JSON.stringify(paging.sorts)}` : ''
  return page + size + sorts
}
export function stringifySortStage (stage: { $sort: Record<string, number> }): string {
  const sorts = Object.entries(stage.$sort).map(([field, direction]) => ({ [field]: direction > 0 ? 'asc' : 'desc' }))
  return JSON.stringify(sorts)
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
export interface SearchMappings {
  /** A mapping of search aliases to the table field they correspond to. */
  hash: Record<string, string>
  /** The fields of the record set and their associated primative-ish type. */
  metas?: Record<string, any>
  /** Any lookup definitions needed for foreign keyed collections. */
  correlations?: Record<string, (metaSearch: MetaSearch) => Promise<MetaSearch>>
  /** A mapping of search operators to common filter comparisons. */
  opHash?: Record<string, string>
  /** The default fields to compare search values against when none are specified. */
  defaults: string[]
  /** For DBs that struggle with certain sorting patterns like parallel arrays in MongoDB. */
  noSort?: Set<string>
  /** Optional projection to run that normalizes the results and excludes un-needed bits from docs in the pipeline
   *  before passing through matchCount grouping and possibly hitting its 16MB BSONobj limit. */
  pretty?: PipelineStage
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
/** What to search for. Quoted things as a single what-for or anything that's either an escaped [comma, semicolon, space]
 *  or is not a [comma, semicolon or space] - making commas, semicolons, or spaces our delimiters when not grouped by quotes. */
export const whatfors = /(?<whatfor>"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|(?:\\[,; ]|[^,; ])+)/
export const wildcardops = /(?<wildcardop>:|<=|>=|=|<|>|\b(?:contains?|(?:ends|begins|starts)\s?with|is)\b)\s*/ // Add wildcards to search?
export const likeops = /(?<likeop>\+|-|\b(?:not|and)\b\s*)/ // Like, or Not Like?
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

/** Convenient means of passing Token metadata between mutator functions. */
export interface MetaToken {
  token: RegExpMatchArray
  negation: boolean
  intersection: boolean
  alias?: string
  rawOp?: string
  searchVal: string
}
/** Interface for thunking correlation ID matching so we don't have to use MongoDB's abysmal $lookup performance.
 *  - `union/intersetSearches` are arrays to push the token match strings to.
 *  - After all search tokens have been processed and pushed to any corresponding correlation searches needed
 *  `SearchMapping.correlations[key]` will be called on the corresponding `MetaSearch` object to populate the
 *  `union/intersectIds` arrays with the corresponding ObjectId references through a recursive call to `getMongoStages`
 *  to build queries with their corresponding collection's `SearchMapping` metadata and run using that model. */
export interface Correlation {
  /** Add the token match strings to this for any non-intersect - OR - correlations needed. */
  unionSearches: string[]
  /** Populated by the corresponding SearchMapping.correlations[key] function after all search tokens are initially processed. */
  unionIds: Set<ObjectId>
  /** Add the token match strings to this for any intersect - AND - correlations needed. */
  intersectSearches: string[]
  /** Populated by the corresponding SearchMapping.correlations[key] function after all search tokens are initially processed. */
  intersectIds: Set<ObjectId>
}
export interface PagingStages {
  sort: PipelineStage
  skip?: PipelineStage
  limit: PipelineStage
}
/** Convenient means for collecting and organizing metadata about the search before building a translated query. */
export interface MetaSearch {
  search: string
  paging: Paging
  curr?: MetaToken
  correlations: Record<string, Correlation>
  unions: object[]
  intersects: object[]
  projections: Record<string, any>
  projected: { unions: object[], intersects: object[] }
  pagingStages: PagingStages | undefined
}
export interface AggregateResult {
  matches: Record<string, any>[]
  matchCount: [{ total: number }]
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
export async function getMongoStages (tableDef: SearchMappings, search: string, paging: Paging = { sorts: [] }): Promise<{ pipeline: PipelineStage[], metaSearch: MetaSearch }> {
  /* Advanced search phrases consist of the following RegEx-ish form.
  (and |not |+|-)?((tableDef.hash.keys) *(contains|(ends|begins|starts) with|is|:|<=|>=|=|<|>) *)?(["']*|[,; ]+)<what to search for>\5+[,;]? *
  <   likeops   >  <     aliases      >  <                 wildcardops                       >   <<     \5     >      whatfor      >
  */
  const fieldAliases = getAliases(tableDef.hash).join('|')
  const aliases = new RegExp(`\\b(?<alias>${fieldAliases})\\b\\s*`) // Aliases that translate to fields we search.
  const parser = new RegExp(`(?:${likeops.source})?(?:${aliases.source + wildcardops.source})?${whatfors.source}[,;]?\\s*`, 'gi')
  // console.log(parser)

  const metaSearch: MetaSearch = {
    search,
    paging,
    curr: undefined,
    correlations: {},
    unions: [],
    intersects: [],
    projections: {},
    projected: { unions: [], intersects: [] },
    pagingStages: undefined
  }
  for (const token of search.matchAll(parser)) {
    const { likeop, alias, wildcardop, whatfor } = token.groups as any
    const searchVal = whatfor.replace(/^(["'])(.*?)\1$/, '$2') // Strip any grouping quotes.
    const negation = likeop ? /^(?:not\s+|-)$/.test(likeop) : false
    const intersection = likeop ? /^(?:and\s+|\+)$/.test(likeop) : false
    metaSearch.curr = { token, negation, intersection, alias, rawOp: wildcardop, searchVal }
    if (!alias) { // Build default match clause.
      const defaults: object[] = []
      for (const field of tableDef.defaults) {
        if (field.includes('::')) {
          mutateCorrelationsAndProjections(tableDef, metaSearch, field)
          continue
        }
        defaults.push({ [field]: getFilterExpression(metaSearch.curr.searchVal, tableDef.metas?.[field] ?? 'string', metaSearch.curr.negation, field) })
      }
      if (metaSearch.curr.intersection) metaSearch.intersects.push({ $or: defaults })
      else metaSearch.unions.push(...defaults)
      continue
    }
    const fieldName = tableDef.hash[alias]
    const op = tableDef.opHash?.[wildcardop]
    // Handle Correlations and Projections.
    if (fieldName.includes('::')) {
      mutateCorrelationsAndProjections(tableDef, metaSearch, fieldName, op)
      continue
    }
    // Token corresponds to an initial stage match clause.
    const fieldType = tableDef.metas?.[fieldName]
    if (intersection) metaSearch.intersects.push({ [fieldName]: getFilterExpression(searchVal, fieldType, negation, fieldName, op) })
    else metaSearch.unions.push({ [fieldName]: getFilterExpression(searchVal, fieldType, negation, fieldName, op) })
  }
  // Add any correlated ObjectId matching using the correlation searches we built up.
  for (const key of Object.keys(metaSearch.correlations)) {
    metaSearch.correlations = (await tableDef.correlations![key](metaSearch)).correlations // Mutate metaSearch with the corresponding correlation function to populate the correlated IDs.
    if (metaSearch.correlations[key].unionIds.size) metaSearch.unions.push({ [key]: { $in: [...metaSearch.correlations[key].unionIds] } })
    if (metaSearch.correlations[key].intersectIds.size) metaSearch.intersects.push({ [key]: { $in: [...metaSearch.correlations[key].intersectIds] } })
  }
  console.log('Post Token & Correlations Processing - metaSearch:', metaSearch)
  // Pre-Filter before $addFields projections and matchings against those.
  const pipeline: PipelineStage[] = [getMatchStage(metaSearch.unions, metaSearch.intersects)]
  // Add projection.
  if (Object.keys(metaSearch.projections).length) pipeline.push({ $addFields: metaSearch.projections })
  // Add any post-projection matching.
  pipeline.push(getMatchStage(metaSearch.projected.unions, metaSearch.projected.intersects))
  // $facet `matchCount` and sorted with optionally paginated `matches`.
  const pagingObjs = getPaginationStages(tableDef, paging)
  metaSearch.pagingStages = pagingObjs.meta
  pipeline.push({ $facet: { matchCount: [{ $count: 'total' }], matches: pagingObjs.pipeline as any[] } })
  return { pipeline, metaSearch }
}
function mutateCorrelationsAndProjections (tableDef: SearchMappings, metaSearch: MetaSearch, fieldName: string, op?: string | undefined) {
  const [collection, alias] = fieldName.split('::')
  // Check if we have a function to correlate our search token to local IDs with.
  if (tableDef.correlations?.[collection] instanceof Function) {
    metaSearch.correlations[collection] ??= { unionSearches: [], unionIds: new Set<ObjectId>(), intersectSearches: [], intersectIds: new Set<ObjectId>() }
    if (metaSearch.curr!.intersection) metaSearch.correlations[collection].intersectSearches.push(metaSearch.curr!.token[0])
    else metaSearch.correlations[collection].unionSearches.push(metaSearch.curr!.token[0])
  } else if (isNotBlank(alias)) { // We're handling a projection.
    metaSearch.projections[alias] ??= tableDef.metas?.[fieldName]
    const fieldType = tableDef.metas?.[alias]
    if (metaSearch.curr!.intersection) metaSearch.projected.intersects.push({ [alias]: getFilterExpression(metaSearch.curr!.searchVal, fieldType, metaSearch.curr!.negation, alias, op) })
    else metaSearch.projected.unions.push({ [alias]: getFilterExpression(metaSearch.curr!.searchVal, fieldType, metaSearch.curr!.negation, alias, op) })
  } else console.info(`SearchMappings definition problem in 'mutateCorrelationsAndProjections' - fieldName: ${fieldName}  op: ${op}  metaSearch.curr:`, metaSearch.curr, ' tableDef.metas:', tableDef.metas)
  return metaSearch
}
function getMatchStage (unions: object[], intersects: object[]): PipelineStage {
  if (unions.length && intersects.length) return { $match: { $and: [{ $or: unions }, ...intersects] } }
  else if (intersects.length) return { $match: { $and: intersects } }
  else if (unions.length) return { $match: { $or: unions } }
  return { $match: {} }
}
function getPaginationStages (tableDef: SearchMappings, pagination: Paging): { pipeline: PipelineStage[], meta: PagingStages } {
  const sort: Record<string, any> = {}
  for (const order of pagination.sorts) {
    const field = order.field
    const value = tableDef.metas?.[field]
    if (!(typeof value === 'string' && Boolean(value)) || tableDef.noSort?.has(field)) continue
    sort[field] = order.direction === 'asc' ? 1 : -1
  }
  for (const field of tableDef.defaults) {
    if (!tableDef.noSort?.has(field)) sort[field] ??= 1
  }
  // Build our return objects: `pipeline` for immediate use and `meta` for communicating back to the caller.
  const pipeline: PipelineStage[] = []
  const meta: PagingStages = {
    sort: pipeline[pipeline.push({ $sort: sort })],
    skip: (pagination.page && pagination.size)
      ? pipeline[pipeline.push({ $skip: (pagination.page - 1) * pagination.size })]
      : undefined,
    limit: pipeline[pipeline.push({ $limit: pagination.size ?? 1000 })]
  }
  return { pipeline, meta }
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
