# featured-search-results

A RESTful API for storing/retrieving featured search results as well as `Search Result Admin` app that provides
an interface to use the API for managing `Result` associations to searches, reviewing `Query` statistics, and
detecting malfunctioning urls/links associated with `Results`.

In addition featured-search-results provides directory listings associated with `PeopleSearch` and the code for
maintaining, updating, and searching directory information, including active `department` listings, is provided
with this code and the API endpoints they implement.

## terminology

* __`Result`__ - A result is URL we associate with different types of search _`Matchings`_ that can be found in searches submitted to this service. A part of each result's definition is a _`Display Title`_, the _`Target URL`_, a list of _`Matchings`_, and a percentile _`Weight`_ for use in prioritizing which matchings take precedence when there's multiple Matchings with hits (possibly across multiple Results) - higher weight takes precedence.
  * _`Matchings`_ - These associate individual or sets of words to be matched with the search by a _`Matching Type`_ which determines the matching logic to use with the words defined for the Matching.
  * _`Matching Types`_ - All comparisons are done case insensitive.
    * _`Exact`_ - The words in the matching's definition must exactly match the search submitted.
    * _`Phrase`_ - The words in the matching's definition must be present anywhere in the search submitted but in the order found in the matching's definition.
    * _`Keyword`_ - The words in the matching's definition must be present in the search submitted but the order in which they're found doesn't matter.
* __`Query`__ - The visitor search requests submitted to the service. These are logged along with the timestamp of submission and any matching `Results` that the system responded with. An interval task runs roughly every 27 minutes to expire logged Queries that are over 6 months old and recalculate associated hit counts.
* _`Search Types`_
  * _`Visitor Searches`_ - These are searches routed through the API's `/search` endpoint. These get logged as Queries as described above. These can be `asyoutype` searches that are run to pre-fetch results for autocompletion or actual search submissions. Both are handled in the same place but have slightly different limitations, in particular that `asyoutype` searches require a minimum of three characters before they get run against the featured Result definitions.
  * _`Admin Search`_ - These are searches done against the meta data used to configure and help manage this service. These are done through the Admin interface for this service and are not included in the Query hitcount and last hit metrics.
  * _`People Search`_ - These are searches against publicly accessible directory inforamtion about active faculty and staff.
  * _`Department Search`_ - This just gets a list of departments associated with active personel.

## api endpoints

### public endpoints

These are all non-authenticated endpoints open to any requests with network access to the serving hosts.

* `GET /search?q={query}` : Returns an array of results based on a user-provided `query` string.
  * Optionally takes an additional `asyoutype` boolean parameter which causes matching to evaluate with normal matching rules except the last word of the query which is counted as a match if the corresponding keywords start with that word instead of requiring a complete match.
    * `asyoutype` queries are not recorded in the query histories for obvious reasons.
  * Results returned from this endpoing include only `url` and `title` - `ResultBasic` representations.
* `GET /adminsearch?q={query}` : Same as `/search` except results include the `id` of the result and there's no `asyoutype` option.
* `GET /peoplesearch?q={query}` : Retrieves directory entries based on a user-provided `query` string.
* `GET /departments` : Returns an array of ALL distinct departments with non-retired directory affiliations in the person directory.
* `GET /linkcheck` : Returns an array of all `Result` urls with all their associated `keywords`.

### authenticated endpoints

The following endpoints are secured behind authenticated access via [unified-auth](https://git.txstate.edu/mws/unified-authentication) and require membership
in the `App-MWS-featured-search` AD Group in PROD or the `$$staff-current` AD Group in QUAL.

#### featured results

Endpoints for manipulating the Mongo document store of Result document records. `GET` and `POST` operations inspect for an
optional `validateonly` parameter (no value) to perform their normal tasks but not actually save the data - or throw errors
when there are problems - but instead return a `Feedback` array describing any validation issues along with what they would
otherwise have returned in the event of an actual submission of the data.

* `GET /results` : Returns an array of ALL results similar to `/result` below but the alias `entries` include a query hit-`count` total.
* `POST /result` : Creates a new result from a `RawJsonResult` or uses that data to update any existing result that has the same `url`.
  * If successful, returns the json object of a `ResultFull` representation of the saved result.
* `GET /result/[id]` : Retrieves a single result by `id` - `ResultFull` representation is returned.
* `PUT /result/[id]` : Updates a result by `id` and returns a `ResultFull` representation of what was saved.
* `DELETE /result/[id]` : Deletes a result by `id` and returns an `{ ok: true }` response if successful.

```json
{ // ResultFull
  "url": string,
  "title": string,
  "id": string,
  "brokensince": Date | null,
  "entries": [{ // These are in priority descending order.
    "keyphrase": string,
    "mode": ResultModes,
    "priority": number
  }],
  "priority": number,
  "tags": [string]
}
{ // RawJsonResult - For submitting saveable/updatable Result entries.
  "url": string,
  "title": string,
  "entries": [{
    "keyphrase": string,
    /* case-insensitive space delimited list, will be stored as lower case keyword array */
    "mode": 'keyword'|'phrase'|'exact'
    /* keyword: the query must contain all keyphrase words, but in any order
     * phrase: the query must contain the keyphrase exactly as it is ordered
     * exact: the query must match the keyphrase exactly */
  }],
  "tags": [string]
  /* non-indexed tags for tracking ownership/association of the entry
   * optional, comma-separated
   * e.g. `liberal_arts,anthropology` */
}
```

#### query histories

* `GET /queries` : Returns an array of the top 5000 queries from the past 6 months sorted by their `hitcount` in descending order along with their most recent associated `Result` ids.

#### other subjects

* `GET /counter/[id]` : Get the count from a counter.
* `POST /counter/[id]` : Increment the count of a counter

## app endpoints

All `Search Result Admin` (app) endpoints are secured behind authenticated access via [unified-auth](https://git.txstate.edu/mws/unified-authentication) and require membership in the `App-MWS-featured-search` AD Group in PROD or the `$$staff-current` AD Group in QUAL.

* `/queries` - Search and sort visitor queries as an aid in finding tuning needed for our featured search Results.
* `/results` - Search and sort our featured search Result records that are used to tune matching and prioritization of search query words/terms to featured URLs.
* `/results/create` - A validated form for creating new search Result records and submitting them to the API `/result` endpoint as a POST. Results posted can continue to be edited here after they've been successfully submitted. In addtion, the as-you-type validation will detect any existing Result records that match the url you are specifying and update the form with any exsiting values not a part of your current editing session - including ones with `txst.edu | txstate.edu` equivalents.
* `/results/[id]` - A validated form (same editor component used above) for editing search Results. Works as above.

## first build

Use `npm run dev` then use `ctrl-c` to immediately exit once that has generated the local development files and types.
From there you should be able to use the following sections to run tests and have `docker` generate a development instance.

## subsequent updates

If you're planning on pushing an image to qual make sure to both update the version number to signify the change in builds but also to tag the commit the build is built from with the same version number. This helps us to correlate archived logs to both their associated build and the code commit associated with that build. You can use the `qual.sh` script and pass it a version number for a convenient way to push a versioned build image to the registry. It's up to you to tag your commit and push it with `git push orgin --tags` if you don't use the `qual.sh` script.

## run tests

`./test.sh` in the root directory

Use `./test.sh show` to show all the logs from the other containers (useful for debugging).

  > __TODO:__ We're currently in the process of implementing the tests in Playwright. The `test.sh` script will run the build to get all the services running with a Playwright instance that can be configured and have tests written for this service but the configuraiton and test definitions remain to be done in a way that will integrate with our continuous integration framework.
  >> In the mean time manual tests need be run against your Dev and Qual instances.
  >> * Test admin login and that admin pages load.
  >> * Test API functionality.
  >> * Test search syntaxes in Admin pages and that API /search endpoint can handle different search expectations for 'asyoutype' or not.
  >> * Test Result creation and Query logging ensuring data is saved correctly and UI is dynamically updating without glitches.
  >> * Test validations in Result Creation: Title, URL equivalencies, Matchings...
  >> * Test that searches are getting valid featured results given Result definitions for matching types and weights.
  >> * Test pagination.

## run development environment

Add a motion token to `docker-compose.override.yml`, then

`docker compose up --build`
