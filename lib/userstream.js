var inherits      = require('util').inherits;
var TwitterStream = require('./stream');
var util          = require('./util');
var constants     = require('./constants').USER_STREAM;


/**
 * @constructor
 * @extends {TwitterStream}
 * @param {TwitterClient} client
 * @param {!Object} params
 */
var UserStream = module.exports = function(client, params) {
  TwitterStream.call(this, client, UserStream.RESOURCE_URL, params);
  util.initParamMethods(this, 'track');
};

inherits(UserStream, TwitterStream);
util.createParamMethods(UserStream, 'track');


/**
 * Export Twitter constants
 */
UserStream.RESOURCE_URL = constants.RESOURCE_URL;
