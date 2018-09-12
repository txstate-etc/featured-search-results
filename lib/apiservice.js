const express = require('express')
const logger = require('morgan')
var service = require('./service')

service.app.use(logger('tiny'))
service.app.use(express.json())

module.exports = service
