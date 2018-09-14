var mongoose = require('mongoose')

// database config
var db_host = process.env.DB_HOST || 'localhost';
var db_port = process.env.DB_PORT || '27017';
var db_authdb = process.env.DB_AUTHDATABASE || '';
var db_user = process.env.DB_USER || '';
var db_pw = process.env.DB_PASSWORD || '';
var db_name = process.env.DB_DATABASE || 'default_database';
var db_userpassword_prefix = '';
if (db_user.length > 0 && db_pw.length > 0) db_userpassword_prefix = db_user+':'+db_pw+'@';
var db_authdb_suffix = '';
if (db_authdb.length > 0) db_authdb_suffix = '?authSource='+db_authdb;

// start up
var db_connect = function () {
  return new Promise((resolve, reject) => {
    mongoose.connect('mongodb://'+db_userpassword_prefix+db_host+':'+db_port+'/'+db_name+db_authdb_suffix, {
      ssl: process.env.DB_SSL == 'true' ? true : false,
      reconnectTries: Number.MAX_VALUE,
      reconnectInterval: 500,
      poolSize: 50,
      useNewUrlParser: true
    })
    .then(function () {
      console.log("DB connection alive")
      resolve()
    })
    .catch(function (err) {
      console.log(err)
      console.log('trying again in 5 seconds')
      setTimeout(db_connect, 5000)
    })
  })
}

var close = function () {
  return mongoose.disconnect()
}

module.exports = {
  connect: db_connect,
  disconnect: close
}
