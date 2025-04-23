import { json } from '@sveltejs/kit'
import { Result } from '$lib/models/result.js'
import { Query } from '$lib/models/query.js'

/*
Considerations:
  - `asyoutype` is a boolean parameter that indicates whether the search is being done as the user types.
    > Providing AsYouType results to our users as they search using our search bar is a feature we want
      to provide for users of our site and is easy enough to request of Google but we have to pay Google
      for use of AsYouType searches. This whole project was initially started as a work around to provide
      our own AsYouType results so we don't have to pay Google for that service - hence the Featured Results
      that get displayed in our site's search bar as the user types and the Featured Results listings that
      get prepended to the Google search results when the user submits their search query.
    > Currently `asyoutype` is a boolean parameter but I think we should make `asyoutype` a number parameter
      that indicates which word in the search input is the word the cursor is on. We could then update
      `Result.entryMatchesQuery(..)` to apply any `startsWith` `Keyword` mode matching to the corresponding
      word in query input being typed to. This would allow us to provide AsYouType result matching
      contextualized to the users focus in the input field. We could default `asyoutype` to a boolean value
      using current behavior if there are no search query words that correspond to `asyoutype` being passed
      as a cursor position.
      > This wouldn't apply to `Result.entry.MatchesOneWordQuery` as the cursor position should always be 0.
      > Would need to ensure callers are passing `asyoutype` in a way that distinguishes between boolean and
        number values in a non-truthy way:
        (1 ?= true | 2nd word)
        (0 ?= false | 1st word)
      > Considered interpreting it as a boolean truthy value if the number passed is less than 2 and a number
        value if 2 or greater, or the value is numeric and predicated by an 'i' or 'n' character to indicate
        index or nth position. DECIDED AGAINST THIS APPROACH on grounds that it starts to clutter the caller
        interface with too many options. Boolean or Number - no conditional clutter.
      > INSTEAD: Introduce a new `asyoutypeindex` parameter that is a number and indicates the index of the
        word in the search input that the cursor is on. This eliminates possible confusion on the meaning of
        the value passed. This also allows us to keep the `asyoutype` parameter as a boolean for backwards
        compatibility with existing code and callers.
  - Query Length and Actionable Results
    > It turns out that most searches of less than 3 characters end up getting a lot of inactionable results
      from our own Featured Results as well as from the Google search results. To avoid waisted bandwidth
      and processing to provide a bunch of results the user likely doesn't want we want to limit the search
      length to 3 characters or more EXCEPT for searches that match with `keyword` matchings in our Featured
      Results that are also less than 3 characters. Because of this the following request handler inspects
      the query to see if our exception case applies to it and routes to a simpler search function if it does
      else it routes to the more complex compound search function. We apply this forked logic to both the
      AsYouType and user submitted search requests.
  - One Word Queries
    > Since the matching mode rules reduce to being equivalent when applied to only one word we can treat one
      word queries as a special case that we can both optimize for and provide exceptions for in our search
      query length minimum.
    > Before even comparing one word queries to matchings (`Result.entries.*`) we can check if  `Keyword` and
     `Phrase` matchings are longer than one word and filter those from possible matches before checking.
    > With one word search queries we can provide exceptions for the minimum length requirement since a more
      simplified and efficient matching logic can be applied.
    > Lower Limit Exception - In the one word matching logic routine we'll want to inspect the length of the
      single search query word and only return results if the `Result.entries.keywords[]` entry exactly matches
      the search word when the search query word length is less than 3 characters. Otherwise we can continue to
      apply the `Result.entries.keywords..startsWith(searchWord)` matching logic that we usually apply.
*/
const oneWordQueryPattern = /^\s*\w+\s*$/
function isOneWordQuery (query: string) { return oneWordQueryPattern.test(query) }

/** @type {import('./$types').RequestHandler} */
export async function GET ({ url, setHeaders }) {
  const query = (url.searchParams.get('q') as string) ?? undefined
  if (!query?.length || query.length > 1024) return json([])
  /** Not currently using this as an index as discussed in Considerations note as we'd need to guarantee callers
  are passing `asyoutype` in a way that distinguishes between boolean and number values in a non-truthy way.
  const asYouTypeFocusIndex = url.searchParams.get('asyoutypeindex') as number | null ?? undefined */
  const asYouType = !!url.searchParams.get('asyoutype')
  const isOneWord = isOneWordQuery(query)
  if (query.length < 3 && !isOneWord) return json([])
  const results = isOneWord ? await Result.findByOneWordQuery(query) : await Result.findByQuery(query/*, asYouTypeFocusIndex */)
  const ret = results.map(result => result.basic())
  if (!asYouType) Query.record(query, results)
  return json(ret)
}
