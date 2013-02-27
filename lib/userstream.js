var inherits      = require('util').inherits;
var TwitterStream = require('./stream');
var constants     = require('./constants').USER_STREAM;


/**
 * @constructor
 * @extends {TwitterStream}
 * @param {TwitterClient} client
 * @param {!Object} params
 */
var UserStream = function(client, params) {
  TwitterStream.call(this, client, UserStream.RESOURCE_URL, params);
  this._createParamMethods('track');
};

inherits(UserStream, TwitterStream);


/**
 * Export Twitter constants
 */
UserStream.RESOURCE_URL = constants.RESOURCE_URL;
