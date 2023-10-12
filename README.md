# search-featured-results

A RESTful API for storing/retrieving featured search results as well as a admin service
that provides an interface to use the API for managing `result` associations to
searches.

## endpoints

* `GET /search?q={query}` : retrieve results based on a user-provided query string
  * optionally takes an additional `asyoutype` boolean parameter which causes matching to evaluate with normal matching rules except the last word of the query which is counted as a match if the corresponding keywords start with that word instead of requiring a complete match
    * `asyoutype` queries are also not recorded in the query histories
  * results include only `url` and `title` - basic result
* `GET /results` : an array of ALL results
  * The json returned is like `/result` below but the alias `entries` include a query hitcount total
* `POST /result` : create a new result from a `RawJsonResult` or use data to update any existing result with the same `url`
  * Returns the json object of a `ResultFull` representation of the result
* `GET /result/{id}` : retrieve a single result by `id` - `ResultFull` representation is returned
* `PUT /result/{id}` : update a result by `id` and return a `ResultFull` representation of what was saved
* `DELETE /result/{id}` : delete a result by `id` return an `{ ok: true }` response if successful
* `GET /queries` : a list of recent search queries
* `GET /adminsearch` : ???
* `GET /counter/{id}` : ???
* `POST /counter/{id}` : ???
* `GET /departments` : a list of departments with non-retired directory affiliations
* `GET /linkcheck` : a list of all `result` urls with all their associated `keywords`
* `GET /peoplesearch?q={query}` : retrieve directory entries based on a user-provided query string

## create / update operations

Include JSON in the body, set Content-Type header on the request to `application/json`.:w

```json
{
  "url": string,
  "title": string,
  "entries": [{
    "keyphrase": string,
    /* case-insensitive space delimited list, will be stored as lower case keyword array */
    "mode": 'keyword'|'phrase'|'exact'
    /* keyword: all words must be present, but in any order
     * phrase: all words must be present, in order
     * exact: query must match exactly */
  }],
  "tags": [string]
  /* non-indexed tags for tracking ownership of the entry
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
