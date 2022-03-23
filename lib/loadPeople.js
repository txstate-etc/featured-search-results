const db = require('mysql2-async/db').default

module.exports = async function () {
/*
  We're going to copy over the existing txstpeople table as well, update searchids accordingly, then drop the restored txstpeople table.

  First import from mysql2-async in a way that we can provide our own config to the old peoplesearch databases on phrixos.

  Copy the txstpeople table from there to ITSDB peoplesearch.
  Load searchids from that data. 
    We have a problem here we may need to solve. How do we keep the searchids in sync between both databases given the values aren't hashed but random number generations?
    Maybe we create searchids with two searchid columns? One that has the old random value, a new one that's a hash.
    If we use a hash how do we keep it from being exploited later. Perhaps in searchids, a table that should be persistent to some degree, we store an additional safety
    column to specify that netid+seachid's info has been requested as private.

  Load our current peoplesearch.people table using motion query.
*/
}
