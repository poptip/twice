var inherits      = require('util').inherits;
var TwitterStream = require('./stream');
var utils         = require('./utils');
var constants     = require('./constants').PUBLIC_STREAM;


/**
 * @constructor
 * @extends {TwitterStream}
 * @param {TwitterClient} client
 * @param {!Object} params
 */
var PublicStream = module.exports = function(client, params) {
  TwitterStream.call(this, client, PublicStream.RESOURCE_URL, params);
  utils.initParamMethods(this, 'track');
  utils.initParamMethods(this, 'follow');
};

inherits(PublicStream, TwitterStream);
utils.createParamMethods(PublicStream, 'track');
utils.createParamMethods(PublicStream, 'follow');


/**
 * Export Twitter constants
 */
PublicStream.RESOURCE_URL = constants.RESOURCE_URL;
