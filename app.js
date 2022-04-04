// import express
const express = require('express')
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser')
const AppError = require('./AppError')
const rateLimit = require('express-rate-limit')
const config = require('config')
const app = express();
app.use(require('sanitize').middleware)
app.use(cookieParser())

//Import all routes
const github = require('./routes/githubRouter')
const API = '/api/v1/'
app.all(API + '*')

//All routes
app.use(API + 'github', github);
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json({limit: 1024102420, type: 'application/json'}))
app.use(function (req, res, next) {
  if (req.url === '/') {
    return res.status(200).end()
  }
  return next('URL: ' + req.url + ' not found')
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  if (err instanceof AppError) {
    return res.status(400).json({
      statusCode: err.status,
      statusText: err.message
    }).end()
  }
  console.error('[Handler]', err)
  return res.status(400).json({
    statusCode: 'BadRequest',
    statusText: 'Bad Request'
  })
});
app.disable('x-powered-by')
// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
})

app.use(limiter)
console.log('[Server]', 'Server running mode', config.get('env'))
app.disable('x-powered-by')

module.exports = {app}