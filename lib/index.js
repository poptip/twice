var request       = require('request');
var querystring   = require('querystring');
var streamify     = require('streamify');
var TimeQueue = require('timequeue');
var TwitterStream = require('./stream');
var worker         = require('./worker');
var constants     = require('./constants');
var VERSION       = require('../package.json').version;


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
    headers: { 'user-agent': 'stweam/' + VERSION },
    oauth: credentials,
  });
};


/**
 * GET request.
 *
 * @param {Object|String} options
 * @param {!Function(Error, ClientResponse, Buffer|string)} callback
 */
Stweam.prototype.get = function(options, callback) {
  var stream = streamify();
  queue.push(this, stream, 'get', options, callback);
  return stream;
};


/**
 * POST request.
 *
 * @param {String} url
 * @param {!Object} params
 * @param {!Function(Error, ClientResponse, Buffer|string)} callback
 */
Stweam.prototype.post = function(url, params, callback) {
  var stream = streamify();
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
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=utf-8'
    }
  };
  queue.push(this, stream, 'post', options, callback);
  return stream;
};


/**
 * Similar streams.
 */
[ 'Public Stream'
, 'Sample Stream'
, 'Firehose'
, 'User Stream'
].forEach(function(name) {
  var resource = constants[name.replace(' ', '_').toUpperCase()].RESOURCE_URL;

  Stweam.prototype['create' + name.replace(' ', '')] = function(arg1) {
    return new TwitterStream(this, resource, arg1);
  };
});


/**
 * Create constructor methods for rest of stream types.
 */
[ 'Stream'
, 'SiteStream'
, 'Pool'
].forEach(function(name) {
  var Obj = require('./' + name.toLowerCase());

  Stweam.prototype['create' + name] = function(arg1, arg2) {
    return new Obj(this, arg1, arg2);
  };

  // Export data type.
  Stweam[name] = Obj;
});
