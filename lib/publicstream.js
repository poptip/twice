var inherits      = require('util').inherits;
var TwitterStream = require('./stream');
var util          = require('./util');
var constants     = require('./constants').PUBLIC_STREAM;


/**
 * @constructor
 * @extends {TwitterStream}
 * @param {TwitterClient} client
 * @param {!Object} params
 */
var PublicStream = module.exports = function(client, params) {
  TwitterStream.call(this, client, PublicStream.RESOURCE_URL, params);
  util.initParamMethods(this, 'track');
  util.initParamMethods(this, 'follow');
};

inherits(PublicStream, TwitterStream);
util.createParamMethods(PublicStream, 'track');
util.createParamMethods(PublicStream, 'follow');


/**
 * Export Twitter constants
 */
PublicStream.RESOURCE_URL = constants.RESOURCE_URL;
