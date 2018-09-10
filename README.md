# search-featured-results
A RESTful API for storing/retrieving featured search results

# endpoints
* `GET /search?q={query}` : retrieve results based on a user-provided query string
  * results include only `url` and `title`
* `GET /entry` : a list of all entries
* `POST /entry` : create a new entry, may update an existing entry with identical keyphrase
* `GET /entry/{id}` : retrieve entry by id
* `PUT /entry/{id}` : update an entry
* `DELETE /entry/{id}` : delete an entry

# create / update parameters
Use standard http body format
* `keyphrase` : may include multiple words separated by spaces
* `url` : target url when phrase matches
* `title` : title for the target url
* `mode` : `any` or `all`, optional, default: `any`
* `tags` : non-indexed tags for tracking ownership of the entry, optional, comma-separated, e.g. `liberal_arts,anthropology`

# authorization
* `GET /search` is open to the public
* All other endpoints secured by single secret key for server-to-server editing
