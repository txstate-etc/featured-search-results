/* eslint-disable quote-props */
import { isBlank } from 'txstate-utils'
import { error } from '@sveltejs/kit'
import { MessageType } from '@txstate-mws/svelte-forms'

/** Function for doing things in svelte curly bracers without generating output that gets added to the DOM. */
export function noOp (..._: any[]) { return '' }

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
  console.log('paramFromUrl', url.searchParams)
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

function statusToMessageType (status: number) {
  if (status === 200) return MessageType.SUCCESS
  if (status === 401) return MessageType.SYSTEM
  /* Currently no warnings thrown so don't waste cycles checking:
  if (status > 200 && status < 300) return MessageType.WARNING */
  return MessageType.ERROR
}

/** A set of common checks that handle the difference between validation only checks and
 * full blown throw an error checks. If they're not `validationOnly` then errors will be
 * thrown before a value can be returned. If they ARE `validationOnly` checks then an
 * array of Feedback messages will be returned, or an empty array for passing.
 * Usefull for making sure our checks are consistent - where these are used - and for
 * reducing code clutter where we optionally want to throw errors or return feedback. */
export const ValidationChecks = {
  isTrue: (condition: boolean, status: number, message: string, path: string, validationOnly: boolean = false) => {
    if (!condition) {
      if (!validationOnly) throw error(status, { message })
      const type = statusToMessageType(status)
      return [{ type, path, message }]
    } return []
  },
  isEditor: (verified: boolean, validationOnly: boolean = false) => {
    return ValidationChecks.isTrue(verified, 401, 'Not Authorized', '', validationOnly)
  },
  isBlank: (param: any, name: string, validationOnly: boolean = false) => {
    return ValidationChecks.isTrue(!isBlank(param[name]), 400, `Posted request must contain a non-empty ${name}.`, name, validationOnly)
  }
}

interface SearchMappings {
  /** A mapping of search aliases to the table field they correspond to. */
  hash: Record<string, string>
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
