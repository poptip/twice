var request       = require('request');
var querystring   = require('querystring');
var EventEmitter  = require('events').EventEmitter;
var TimeQueue     = require('timequeue');
var _             = require('underscore');
var TwitterStream = require('./stream');
var PublicStream  = require('./publicstream');
var UserStream    = require('./userstream');
var SiteStream    = require('./sitestream');
var Pool          = require('./pool');
var worker        = require('./worker');
var constants     = require('./constants');
var VERSION       = require('../package.json').version;
var HEADER = { 'user-agent': 'stweam/' + VERSION };


/**
 * A queue for requests to Twitter to avoid being rate limited.
 * This is shared across all Stweam instances.
 */
var queue = new TimeQueue(worker, {
  concurrency: 1
, every: Math.floor(1000 / constants.MAX_REQUESTS_PER_SECOND)
});


/**
 * @constructor
 * @param {Object} credentials
 */
var Stweam = module.exports = function Stweam(credentials) {
  this._request = request.defaults({
    headers: HEADER,
    oauth: credentials,
    maxSockets: Infinity
  });
};


/**
 * GET request.
 *
 * @param {Object|String} options
 * @param {!Function(Error, ClientResponse, Buffer|string)} callback
 * @return {EventEmitter}
 */
Stweam.prototype.get = function(options, callback) {
  var ee = new EventEmitter();
  queue.push(this, ee, 'get', options, callback);
  return ee;
};


/**
 * POST request.
 *
 * @param {String} url
 * @param {!Object} params
 * @param {!Function(Error, ClientResponse, Buffer|string)} callback
 * @return {EventEmitter}
 */
Stweam.prototype.post = function(url, params, callback) {
  var ee = new EventEmitter();
  var body = querystring
    .stringify(params)
    .replace(/\!/g, '%21')
    .replace(/\'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
  var options = {
    url: url,
    body: body,
    headers: _.extend(_.clone(HEADER), {
      'content-type': 'application/x-www-form-urlencoded; charset=utf-8'
    })
  };
  queue.push(this, ee, 'post', options, callback);
  return ee;
};


/**
 * Create a public stream with this client's credentials.
 *
 * @param {!Object} params
 * @return {PublicStream}
 */
Stweam.prototype.createPublicStream = function(params) {
  return new PublicStream(this, params);
};


/**
 * Create a sample stream with this client's credentials.
 *
 * @param {!Object} params
 * @return {TwitterStream}
 */
Stweam.prototype.createSampleStream = function(params) {
  var resource = constants.SAMPLE_STREAM.RESOURCE_URL;
  return new TwitterStream(this, resource, params);
};


/**
 * Create a firehose with this client's credentials.
 *
 * @param {!Object} params
 * @return {TwitterStream}
 */
Stweam.prototype.createFirehose = function(params) {
  var resource = constants.FIREHOSE.RESOURCE_URL;
  return new TwitterStream(this, resource, params);
};


/**
 * Create a user stream with this client's credentials.
 *
 * @param {!Object} params
 * @return {UserStream}
 */
Stweam.prototype.createUserStream = function(params) {
  return new UserStream(this, params);
};


/**
 * Create a site stream with this client's credentials.
 *
 * @param {!Array.<String>} follow
 * @param {!Object} params
 * @return {SiteStream}
 */
Stweam.prototype.createSiteStream = function(follow, params) {
  return new SiteStream(this, follow, params);
};


/**
 * Create a pool with this client's credentials.
 *
 * @param {!Object} options
 * @return {Pool}
 */
Stweam.prototype.createPool = function(options) {
  return new Pool(this, options);
};
