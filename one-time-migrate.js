/* Run from mongosh shell connected to associated landscape's database to:
  1. Map old priority values to new priority/weight values.
  2. Update results that made it into the old dataset without having their title or url trimmed.
    2.1 Deal with duplicate key errors that may be thrown when trying to update untrimmed urls.

  Should only need to run this once per refresh from the old dataset or on landscapes still running the old dataset.
*/

// Update priority values.
db.results.updateMany({ 'entries.priority': 3 }, { $set: { 'entries.$[e].priority': 92 } }, { arrayFilters: [{ 'e.priority': 3 }] })
db.results.updateMany({ 'entries.priority': 2 }, { $set: { 'entries.$[e].priority': 72 } }, { arrayFilters: [{ 'e.priority': 2 }] })
// No priorities had a value of 1.
db.results.updateMany({ 'entries.priority': 0 }, { $set: { 'entries.$[e].priority': 50 } }, { arrayFilters: [{ 'e.priority': 0 }] })
db.results.updateMany({ 'entries.priority': -1 }, { $set: { 'entries.$[e].priority': 32 } }, { arrayFilters: [{ 'e.priority': -1 }] })
db.results.updateMany({ 'entries.priority': -2 }, { $set: { 'entries.$[e].priority': 22 } }, { arrayFilters: [{ 'e.priority': -2 }] })
db.results.updateMany({ 'entries.priority': -3 }, { $set: { 'entries.$[e].priority': 2 } }, { arrayFilters: [{ 'e.priority': -3 }] })

// Update untrimmed titles.
db.results.find({ $or: [{ title: { $regex: '^\\s+.*' } }, { title: { $regex: '.*\\s+$' } }] }).forEach(doc => {
  doc.title = doc.title.trim();
  try { db.results.replaceOne({ _id: doc._id }, doc) }
  catch (e) { console.log(e) }
})
// Update untrimmed urls. - May throw errors due to duplicate keys on url but first we want to try simple trimming first.
db.results.find({ $or: [{ url: { $regex: '^\\s+.*' } }, { url: { $regex: '.*\\s+$' } }] }).forEach(doc => {
  doc.url = doc.url.trim();
  try { db.results.replaceOne({ _id: doc._id }, doc) }
  catch (e) { console.log(e) }
})
/* Expected Errors Thrown (there may be more):
  MongoServerError: E11000 duplicate key error collection: search-featured-results.results index: url_1 dup key: { : "https://www.txst.edu/research/" }
  MongoServerError: E11000 duplicate key error collection: search-featured-results.results index: url_1 dup key: { : "https://www.txst.edu/technology/" }
  MongoServerError: E11000 duplicate key error collection: search-featured-results.results index: url_1 dup key: { : "https://www.txst.edu/continuinged/" }
  MongoServerError: E11000 duplicate key error collection: search-featured-results.results index: url_1 dup key: { : "https://www.shuttle.txst.edu/" }
  MongoServerError: E11000 duplicate key error collection: search-featured-results.results index: url_1 dup key: { : "https://www.txst.edu/clas/schoolpsychology/" }
  MongoServerError: E11000 duplicate key error collection: search-featured-results.results index: url_1 dup key: { : "https://www.admissions.txst.edu/" }
  MongoServerError: E11000 duplicate key error collection: search-featured-results.results index: url_1 dup key: { : "https://www.fss.txst.edu/" }
*/
// Next we'll try updating remaining untrimmed urls replacing tailing spaces that follow a '/' with a single '.'
db.results.find({ url: { $regex: '.*\\s+$' } }).forEach(doc => {
  doc.url = doc.url.replace(/\/\s+$/, '/.');
  try { db.results.replaceOne({ _id: doc._id }, doc) }
  catch (e) { console.log(e) }
})
// List any remaining untrimmed urls we might have missed.
db.results.find({ $or: [{ title: { $regex: '^\\s+.*' } }, { title: { $regex: '.*\\s+$' } }] })
