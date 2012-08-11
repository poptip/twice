var inherits      = require('util').inherits;
var TwitterStream = require('./stream');
var RESOURCE_URL  = require('./constants').PUBLIC_STREAM.RESOURCE_URL;


/**
 * @constructor
 * @extends (TwitterStream)
 * @param (TwitterClient) client
 * @param (Object) params
 */
var PublicStream = module.exports = function PublicStream(client, params) {
  TwitterStream.call(this, client, RESOURCE_URL, params);
};

inherits(PublicStream, TwitterStream);
