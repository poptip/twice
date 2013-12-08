var inherits      = require('util').inherits;
var TwitterStream = require('./stream');
var utils         = require('./utils');
var constants     = require('./constants').USER_STREAM;


/**
 * @constructor
 * @extends {TwitterStream}
 * @param {TwitterClient} client
 * @param {!Object} params
 */
var UserStream = module.exports = function(client, params) {
  TwitterStream.call(this, client, UserStream.RESOURCE_URL, params);
  utils.initParamMethods(this, 'track');
};

inherits(UserStream, TwitterStream);
utils.createParamMethods(UserStream, 'track');


/**
 * Export Twitter constants
 */
UserStream.RESOURCE_URL = constants.RESOURCE_URL;
