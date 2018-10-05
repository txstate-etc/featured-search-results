# search-featured-results
A RESTful API for storing/retrieving featured search results

# endpoints
* `GET /search?q={query}` : retrieve results based on a user-provided query string
  * results include only `url` and `title`
* `GET /results` : a list of all results
* `POST /result` : create a new result, will replace an existing result if there is an identical url
* `GET /result/{id}` : retrieve result by id
* `PUT /result/{id}` : update a result
* `DELETE /result/{id}` : delete a result
* `GET /queries` : a list of recent search queries

# create / update operations
Include JSON in the body, set Content-Type header on the request to `application/json`
```
{
  "url": string
  "title": string
  "entries": [{
    "keyphrase": string,
    /* case-insensitive, will be stored lower case */
    "mode": enum('keyword','phrase','exact')
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

# authorization
* `GET /search` is open to the public
* All other endpoints secured by single secret key for server-to-server editing
