/* eslint-disable quote-props */
import { isBlank, isNotBlank } from 'txstate-utils'
import { error } from '@sveltejs/kit'
import { MessageType } from '@txstate-mws/svelte-forms'

/** Uses URL constructor to test if `urlString` is a value conformant to valid URL standards. */
export function isValidUrl (urlString: string) {
  try { return Boolean(new URL(urlString)) } catch (e) { return false }
  // Once we're able to upgrade to Node.js 19+ we can use the following instead:
  // return URL.canParse(urlString)
}

export function isValidHttpUrl (urlString: string) {
  try { return /https?:/.test(new URL(urlString).protocol) } catch (e) { return false }
}

const domainEqivalencies: Record<string, string[]> = {
  'txstate.edu': ['txst.edu', 'txstate.edu'],
  'txst.edu': ['txst.edu', 'txstate.edu']
}
/** Gets permutations of `url` that are its equivalents given our domain and sub-domain equivalencies as well as common
 * routing equivalencies. Usefull for checking uniqueness integrity of indexed URLs beyond their simple string values. */
export function getUrlEquivalencies (url: string): string[] {
  if (!isValidUrl(url)) return []
  const parsedUrl = new URL(url)
  const splitHost = parsedUrl.hostname.split('.')
  const protocol = parsedUrl.protocol
  const box = splitHost.length > 2 ? splitHost[0] : ''
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
function getEquivalencies (protocol: string, box: string, domain: string, port: string, cleanedPath: string, params: string, hash: string): string[] {
  const base = `${domain}${port}${cleanedPath}`
  const fullParams = `${params}${hash}`
  const pathEquivalencies = [`${base}${fullParams}`, `${base}/${fullParams}`]
  return getSubDomainEquivalencies(protocol, box, pathEquivalencies)
}
function getSubDomainEquivalencies (protocol: string, box: string, pathEquivalencies: string[]): string[] {
  const expanded = box !== '' && box !== 'www'
    ? pathEquivalencies.map(url => { return [`//${box}.${url}`] })
    : pathEquivalencies.map(url => { return [`//www.${url}`, `//${url}`] })
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

/** Extracts and returns the `param: string` value from `url`.
 * @param {URL} url - The URL to extract id from.
 * @param {string} param - The name of the parameter to extract a value from.
 * @param {boolean} required - Optional specification of whether a 400 error should be thrown if `param`'s value is blank or missing.
 * @throws error(400, {message: `${param} is required.` }) - if `param` is blank or missing. */
export function paramFromUrl (url: URL, param: string, required: boolean = false) {
  const value = (url.searchParams.get(param) ?? undefined)?.trim()
  if (required && isBlank(value)) throw error(400, { message: `${param} is requried.` })
  return value
}

/** Extracts and returns the `id` prameter from `url`.
 * @param {URL} url - The URL to extract id from.
 * @throws error(400, {message: 'id is required.' }) - if `id` is blank or missing.
 * @throws error(400, {message: 'Bad id format...' }) - if `id` is not a hexadecimal. */
export function idFromUrl (url: URL) {
  const id = paramFromUrl(url, 'id', true)
  if (!/^[a-f0-9]+$/i.test(id!)) throw error(400, { message: 'Bad id format. Should be a hex string.' })
  return id
}

/** Returns the associcated `Feedback MessageType` from common HTML status codes and ranges. */
export function statusToMessageType (status: number) {
  if (status === 200) return MessageType.SUCCESS
  if ([401, 403, 404].includes(status)) return MessageType.SYSTEM
  if (status > 200 && status < 300) return MessageType.WARNING
  return MessageType.ERROR
}
/** A set of common checks that handle the difference between validation only checks and
 * full blown throw an error checks. If they're not `validationOnly` then errors will be
 * thrown before a value can be returned. If they ARE `validationOnly` then an array of
 * Feedback messages will be returned, or an empty array if the check passed.
 * Usefull for making sure our checks are consistent - where these are used - and for
 * reducing code clutter where we optionally want to throw errors or return feedback.
 * @note Mongoose should be centralizing our document properties validation and formatting.
 * Hence these checks are more for whether the API was provided everything it needs to
 * interact with Mongoose. */
export const ValidationChecks = {
  ifFails: (condition: boolean, status: number, message: string, path: string, validationOnly: boolean = false) => {
    if (!condition) {
      if (!validationOnly) throw error(status, { message })
      const type = statusToMessageType(status)
      return [{ type, path, message }]
    } return []
  },
  /** Careful with isEditor. If `validationOnly` this will return a message but not throw 403.
   * It's up to the caller to inspect returned messages and throw 403 if Not Authorized. */
  isEditor: (verified: boolean, validationOnly: boolean = false) => {
    return ValidationChecks.ifFails(verified, 403, 'Not Authorized', '', validationOnly)
  },
  isBlank: (param: any, name: string, validationOnly: boolean = false) => {
    return ValidationChecks.ifFails(!isBlank(param[name]), 400, `Posted request must contain a non-empty ${name}.`, name, validationOnly)
  }
}

/** `typeof` operator doesn't distinguish between 'object' and 'array' and we want the distinction here. */
export type EnhancedTypes = 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'undefined' | 'object' | 'function' | 'array'
export type EnhancedTypesSubProp = Record<string, EnhancedTypes>
export type EnhancedTypesArray = Record<'array', EnhancedTypes | EnhancedTypesSubProp>
/** Utility function for getting the `typeof` an object with `array` differentiated from `object`. */
export function getType (obj: any) {
  let type: EnhancedTypes = typeof obj
  if (type === 'object' && Array.isArray(obj)) type = 'array'
  return type
}
interface SearchMappings {
  /** A mapping of search aliases to the table field they correspond to. */
  hash: Record<string, string>
  metas?: Record<string, EnhancedTypes | EnhancedTypesArray>
  /** The default fields to compare search values against when none are specified. */
  defaults: string[]
  /** Convenience reference of distinct table fields available to compare against. */
  fields: Set<string>
}
/** Get the distinct values from `hash` as the field names in an SQL table. */
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
    'broken': 'brokensince',
    'brokensince': 'brokensince',
    'match words': 'entries.keywords',
    'keyphrase': 'entries.keywords',
    'aliases': 'entries.keywords',
    'keywords': 'entries.keywords',
    'mode': 'entries.mode',
    'type': 'entries.mode',
    'priority': 'entries.priority',
    'weight': 'entries.priority',
    'search': 'query',
    'query': 'query',
    'hits': 'queries.count',
    'count': 'queries.count'
  }
  const metas: Record<string, EnhancedTypes | EnhancedTypesArray> = {
    'title': 'string',
    'tags': { 'array': 'string' },
    'url': 'string',
    'priority': 'number',
    'brokensince': 'string',
    'entries.keywords': { 'array': { 'keywords': 'array' } },
    'entries.mode': { 'array': { 'mode': 'string' } },
    'entries.priority': { 'array': { 'priority': 'number' } },
    'queries.count': { 'array': { 'count': 'number' } },
    'query': 'string'
  }
  const defaults: string[] = ['title', 'url', 'tags', 'entries.keywords', 'entries.mode']
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
    else if (/^(?:ends\s?with|>)/.test(wildcardop)) wildcardbind = `%${whatforbind}`
    else if (/^(?:(?:begins|starts)\s?with|<)/.test(wildcardop)) wildcardbind = `${whatforbind}%`
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
 *   { mql: '{ field1: ?, field2: /$?/i }', binds: ['a', 'b'] }
 * ``` */
export function getMatchClause (tableDef: SearchMappings, search: string) {
  /* Advanced search phrases consist of the following RegEx-ish form.
  (and |not |+|-)?((tableDef.hash.keys) *(contains|(ends|begins|starts) with|is|:|<=|>=|=|<|>) *)?(["']*|[,; ]+)<what to search for>\5+[,;]? *
  <   likeops   >  <     aliases      >  <                 wildcardops                       >   <<     \5     >      whatfor      >
  */
  const binds = []
  // TODO: Need a way of differentiationg between numbers, strings, dates, arrays, and objects.
  /* const arrays = tableDef.fields.reduce((acc, cur) => {
    if (cur.includes('.')) {
      const [field, subfield] = cur.split('.')
      if (!acc[field]) acc[field] = []
      acc[field].push(subfield)
    }
  }, []) */
  const fieldAliases = getAliases(tableDef.hash).join('\b|')
  // We need to break the RegEx down to interpolate the fieldAliases. While we're at it might as well tokenize
  // the parts into their respective purposes for easier editing if we decide to change functionality.
  const aliases = new RegExp(`\\b(?<alias>${fieldAliases})\\b\\s*`) // Aliases that translate to fields we search.
  const parser = new RegExp(`(?:${likeops.source})?(?:${aliases.source + wildcardops.source})?${whatfors.source}[,;]?\\s*`, 'gi')

  const matchClause = []
  for (const token of search.matchAll(parser)) {
    const { likeop, alias, wildcardop, whatfor } = token.groups as any
    const whatforbind = whatfor.replace(/^(["'])(.*?)\1$/, '$2') // Strip any grouping quotes.
    let regExBind = ''
    if (!wildcardop || /^(?:contains|:)/.test(wildcardop))/**/ regExBind = `/${whatforbind}/i`
    else if (/^(?:ends\s?with)/.test(wildcardop)) /*        */ regExBind = `/${whatforbind}$/i`
    else if (/^(?:(?:begins|starts)\s?with)/.test(wildcardop)) regExBind = `/^${whatforbind}/i`
    else /*                     /^(?:is|=)/                 */ regExBind = whatforbind
    // We've created our bind parameter for this token, now let's build the clause.
    let clause = '?'
    if (/^(?:<=)/.test(likeop)) clause = `{ $lte: ${clause} }`
    else if (/^(?:>=)/.test(likeop)) clause = `{ $gte: ${clause} }`
    else if (/^(?:<)/.test(likeop)) clause = `{ $lt: ${clause} }`
    else if (/^(?:>)/.test(likeop)) clause = `{ $gt: ${clause} }`
    if (/^(?:not\s+|-)$/.test(likeop)) clause = `{ $ne: ${clause} }`
    else /*  /^(?:and\s+|\+)$/ or !likeop */ clause = `${clause}`
    // Prepend our alias's property name, if alias was parsed, else default to tableDef.defaults.
    if (alias) binds.push(regExBind) && (clause = `${tableDef.hash[alias]}: ${clause}`)
    else clause = tableDef.defaults.map((field: string) => (binds.push(regExBind) && `(${field} ${clause})`)).join(' or ')
    matchClause.push(`(${clause})`)
  }
  return { sql: ' where ' + matchClause.join(' and '), binds }
}
