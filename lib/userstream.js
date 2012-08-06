/**
 * userstream.js
 *
 * Twitter user stream
 */
var TwitterStream = require('./stream')
  , util = require('util')
  ;


/**
 * @constructor
 * @extends (TwitterStream)
 * @param (TwitterClient) client
 * @param (string) track
 */
var UserStream = module.exports = function(client, track) {
  TwitterStream.call(this, client, 'user', track ? { track: track } : null);

  this.on('data', TwitterStream.onData.bind(this));
};

util.inherits(UserStream, TwitterStream);
