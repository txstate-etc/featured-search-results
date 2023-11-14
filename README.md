# search-featured-results

A RESTful API for storing/retrieving featured search results as well as a admin service that provides an
interface to use the API for managing `Result` associations to searches, reviewing `Query` statistics, and
detecting malfunctioning urls/links associated with `Results`.

In addition search-featured-results provides directory listings associated with `PeopleSearch` and the code for
maintaining, updating, and searching directory information, including active `department` listings, is provided
with this code and the API endpoints they implement.

## endpoints

### searches

* `GET /search?q={query}` : Returns an array of results based on a user-provided `query` string.
  * Optionally takes an additional `asyoutype` boolean parameter which causes matching to evaluate with normal matching rules except the last word of the query which is counted as a match if the corresponding keywords start with that word instead of requiring a complete match.
    * `asyoutype` queries are not recorded in the query histories for obvious reasons.
  * Results returned from this endpoing include only `url` and `title` - `ResultBasic` representations.
* `GET /adminsearch?q={query}` : Same as `/search` except results include the `id` of the result and there's no `asyoutype` option.
* `GET /peoplesearch?q={query}` : Retrieves directory entries based on a user-provided `query` string.

### featured results

* `GET /results` : Returns an array of ALL results similar to `/result` below but the alias `entries` include a query hit-`count` total.
* `POST /result` : Creates a new result from a [`RawJsonResult`](#create--update-operations) or uses that data to update any existing result that has the same `url`.
  * If successful, returns the json object of a `ResultFull` representation of the saved result.
* `GET /result/{id}` : Retrieves a single result by `id` - `ResultFull` representation is returned.
* `PUT /result/{id}` : Updates a result by `id` and returns a `ResultFull` representation of what was saved.
* `DELETE /result/{id}` : Deletes a result by `id` and returns an `{ ok: true }` response if successful.

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
```

### query histories

* `GET /queries` : Returns an array of the top 5000 queries from the past 6 months sorted by their `hitcount` in descending order along with their most recent associated `Result` ids.

### other subjects

* `GET /counter/{id}` : ???
* `POST /counter/{id}` : ???
* `GET /departments` : Returns an array of ALL distinct departments with non-retired directory affiliations in the person directory.
* `GET /linkcheck` : Returns an array of all `Result` urls with all their associated `keywords`.

## create / update operations

Set Content-Type header on the request to `application/json` and include JSON fitting the `RawJsonResult` interface in the body.

```json
{ // RawJsonResult
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

## authorization

* `GET /search` is open to the public
* All other endpoints secured by single secret key for server-to-server editing.

## first build

Use `npm run dev` then use `ctrl-c` to immediately exit once that has generated the local development files and types.
From there you should be able to use the following sections to run tests and have `docker` generate a development instance.

## run tests

`./test.sh` in the root directory

Use `./test.sh show` to show all the logs from the other containers (useful for debugging).

## run development environment

Add a motion token to `docker-compose.override.yml`, then

`docker compose up --build`
