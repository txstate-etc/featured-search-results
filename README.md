# search-featured-results

A RESTful API for storing/retrieving featured search results as well as a admin service
that provides an interface to use the API for managing `result` associations to
searches.

## endpoints

* `GET /search?q={query}` : retrieve results based on a user-provided query string
  * results include only `url` and `title` - basic result
* `GET /results` : a list of all results
* `POST /result` : create a new result, will replace an existing result if there is an identical url
* `GET /result/{id}` : retrieve result by id
* `PUT /result/{id}` : update a result
* `DELETE /result/{id}` : delete a result
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
