# featured-search-results

A RESTful API for storing/retrieving featured search results as well as `Search Result Admin` app that provides
an interface to use the API for managing `Result` associations to searches, reviewing `Query` statistics, and
detecting malfunctioning urls/links associated with `Results`.

In addition featured-search-results provides directory listings associated with `PeopleSearch` and the code for
maintaining, updating, and searching directory information, including active `department` listings, is provided
with this code and the API endpoints they implement.

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

## run development environment

Add a motion token to `docker-compose.override.yml`, then

`docker compose up --build`
