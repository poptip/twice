var inherits      = require('util').inherits;
var TwitterStream = require('./stream');
var constants     = require('./constants').USER_STREAM;


/**
 * @constructor
 * @extends {TwitterStream}
 * @param {TwitterClient} client
 * @param {!Object} params
 */
var PublicStream = module.exports = function(client, params) {
  TwitterStream.call(this, client, PublicStream.RESOURCE_URL, params);
  this._createParamMethods('track');
  this._createParamMethods('follow');
};

inherits(PublicStream, TwitterStream);


/**
 * Export Twitter constants
 */
PublicStream.RESOURCE_URL = constants.RESOURCE_URL;
