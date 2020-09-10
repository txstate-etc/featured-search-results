"use strict"

class Helpers {
  static querysplit (query) {
    const clean = query.toLowerCase().replace(/[^\w-]+/g, ' ').trim()
    if (clean.length === 0) return []
    return clean.split(' ')
  }
  static getPeopleHash() { 
    // First property's value determines default in getSortOp
    const hash = {
      'lastname':  'lastname',
      'last name': 'lastname',
      'last':      'lastname',
      'firstname':   'firstname',
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
    return hash
  }
  static getFields(hash){ // Get the values from the hash as the field names in the SQL table.
    return new Set(Object.values(hash)) // Set() to just the distinct field names.
  }
  static getTerms(hash){ // Get the keys from the hash as the aliases to the field names in the SQL table.
    return Object.keys(hash)
  }
  static getWhereClause(hash, search) {
    const fieldTerms = this.getTerms(hash).join('|')
    const fields     = this.getFields(hash)
    // Handle the most likely case that they send us a single token to query for.
    if ( search.split(' ').length === 1 ) return ' where ' + (Array.from(fields).map(field => `${field} like '${search}%'`).join(' or '))

    // We need to break the RegEx down to string in the fieldTerms. While we're at it might as well tokenize
    // the parts into their respective purposes for easier editing if we decide to change functionality.
    const whatfors          = /(?<whatfor>"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|(?:\\[,; ]|[^,; ])+)/      // What to search for.
    const wildcardops       = /(?<wildcardop>:|=|<|>|contains?|(?:ends|begins|starts)\s?with|is)\s*/ // Add wildcards to search?
    const likeops           = /(?<likeop>\+|-|not\s+|and\s+)/                                        // Like, or Not Like?
    const terms  = new RegExp('(?<term>'+fieldTerms+')\\s*')                                         // Terms that translate to fields we search.
    const parser = new RegExp('(?:'+likeops.source+')?(?:'+terms.source + wildcardops.source+')?'+whatfors.source+'[,;]?\\s*','gi')
    // /(?:(?<likeop>\+|-|not\s+|and\s+))?(?:(?<term>$fieldTerms)\s*(?<wildcardop>:|=|<|>|contains?|(?:ends|begins|starts)\s?with|is)\s*)?(?<whatfor>"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|(?:\\[,; ]|[^,; ])+)[,;]?\s*/gi
    let whereClause = []
    const tokens = search.matchAll(parser)
    for ( const token of tokens) { // Build our where clause parts out of the tokens building right to left within each part.
      const {likeop, term, wildcardop, whatfor} = token.groups 
      // Start building our clause with what we're searching for stripped of any grouping quotes.
      let clause = whatfor.replace(/(?:^["']|["']$)/g,'')
      // Add SQL wildcard symbols for all cases except advanced search is|= or misspelled wildcardop.
      if (!wildcardop || /^(?:(?:begins|starts)\s?with|<)/.test(wildcardop)) clause =  `${clause}%`
      else if (                       /^(?:ends\s?with|>)/.test(wildcardop)) clause = `%${clause}`
      else if (                          /^(?:contains|:)/.test(wildcardop)) clause = `%${clause}%`
      // else if (                             /^(?:is|=)/.test(wildcardop)) Don't add wildcards to clause.
      // SQL query will search using like comparisons. The likeop determines negative or positive like if specified, else default to like.
      if (!likeop || /^(?:and\s+|\+)$/.test(likeop)) clause =     `like '${clause}'`
      else if (      /^(?:not\s+|-)$/.test(likeop))  clause = `not like '${clause}'` 
      // Prepend our term's SQL field name, if term is specified, else default to ALL.
      if (term) clause = `${hash[term]} ${clause}`
      else clause = Array.from(fields).map(field => `(${field} ${clause})`).join(' or ')// Didn't specify search term. Try quering against all SQL fields we search.
      whereClause.push(`(${clause})`)
    }
    return ' where '+whereClause.join(' and ')
  }
  static getSortClause(hash, sortOption) {
    const sortDefault = Object.values(hash)[0]
    return ' order by ' + ((sortOption && this.getFields(hash).has(sortOption)) ? sortOption : sortDefault)
  }
  static getLimitClause(limit) {
    const limitDefault = ''
    return (limit > 0) ? ' limit '+parseInt(Math.round(limit),10) : limitDefault
  }
}

module.exports = Helpers
