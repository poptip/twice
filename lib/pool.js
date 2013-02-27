var inherits   = require('util').inherits;
var EventYoshi = require('eventyoshi');
var SiteStream = require('./sitestream');
var ondata     = require('./ondata');
var constants  = require('./constants');


/**
 * Get Twitter constants from SiteStream.
 */
var MAX_USERS_PER_STREAM = constants.SITE_STREAM.MAX_USERS;


/**
 * @constructor
 * @extends {EventYoshi}
 * @param {TwitterClient} client
 * @param {!Object} params
 */
var Pool = module.exports = function Pool(client, params) {
  EventYoshi.call(this);
  this.proxy('destroy', 'pause', 'resume');

  this.client = client;
  this.params = params;

  // keeps a list of available site streams
  this.streams = [];

  // Set properties for getting list of users in the pool.
  var self = this;
  ['users', 'usersInQueue', 'usersInStream'].forEach(function(list) {
    self.__defineGetter__(list, function() {
      var users = [];
      for (var i = 0, l = self.streams.length; i < l; i++) {
        users = users.concat(self.streams[i][list]);
      }
      return users;
    });
  });
};

inherits(Pool, EventYoshi);


/**
 * Adds a user to a site stream. Their tweets, replies/retweets of their tweets
 * events will be emitted by the pool.
 *
 * @param {String} twitterID
 */
Pool.prototype.addUser = function(twitterID) {
  this.addUsers([twitterID]);
};


/**
 * Add several user IDs at once.
 *
 * @param {Array.<String>} twitterIDs
 */
Pool.prototype.addUsers = function(twitterIDs) {
  var self = this;
  twitterIDs.forEach(function(twitterID) {
    if (self.hasUser(twitterID)) {
      throw Error('User ' + twitterID + ' already in pool');
    }
  });

  // Filter for streams with spots opened.
  var j = 0, k, stream;
  var siteStreams = this.streams.filter(function(stream) {
    return stream instanceof SiteStream &&
      stream.users.length < MAX_USERS_PER_STREAM;
  });

  for (var i = 0, l = siteStreams.length; i < l; i++) {
    // Exit the loop if there are no more twitter IDs.
    if (j >= twitterIDs.length) break;

    // Grab the first twitter IDs from the last which the stream can support.
    stream = siteStreams[i];
    k = j + MAX_USERS_PER_STREAM - stream.users.length;
    stream.addUsers(twitterIDs.slice(j, k));
    j = k;
  }

  // If there are still user IDs to be added, create new site streams as needed.
  while (j < twitterIDs.length) {
    k = j + MAX_USERS_PER_STREAM;
    self.createSiteStream(twitterIDs.slice(j, k));
    j = k;
  }
};


/**
 * Removes a user from a site stream.
 *
 * @param {String} twitterID
 */
Pool.prototype.removeUser = function(twitterID) {
  var stream = this.streams.filter(function(stream) {
    return stream instanceof SiteStream && stream.hasUser(twitterID);
  })[0];

  if (stream) {
    stream.removeUser(twitterID);
  } else {
    throw Error('User ' + twitterID + ' is not in pool');
  }
};


/**
 * Returns true if given user has or will be added to a site stream.
 *
 * @param {String} twitterID
 * @return {Boolean}
 */
Pool.prototype.hasUser = function(twitterID) {
  return this.streams.some(function(stream) {
    return stream instanceof SiteStream && stream.hasUser(twitterID);
  });
};


/**
 * Returns true if given user has or will be added to a site stream.
 *
 * @param {String} twitterID
 * @return {Boolean}
 */
Pool.prototype.hasUserInStream = function(twitterID) {
  return this.streams.some(function(stream) {
    return stream instanceof SiteStream && stream.hasUserInStream(twitterID);
  });
};


/**
 * Returns true if given user is queued to be added to a site stream.
 *
 * @param {String} twitterID
 * @return {Boolean}
 */
Pool.prototype.hasUserInQueue = function(twitterID) {
  return this.streams.some(function(stream) {
    return stream instanceof SiteStream && stream.hasUserInQueue(twitterID);
  });
};


/**
 * Allows users to simulate tweets.
 *
 * @param {Object} tweet
 * @param {!String} twitterID
 */
Pool.prototype.simulate = function(tweet, twitterID) {
  if (typeof twitterID === 'string') {
    tweet = { for_user: twitterID, message: tweet };
  }
  ondata.call(this, tweet);
};


/**
 * Creates a site stream and adds it to the pool.
 *
 * @param {Array.<String>} twitterIDs
 * @return {SiteStream}
 */
Pool.prototype.createSiteStream = function(twitterIDs, params) {
  var stream = this.client.createSiteStream(twitterIDs, params || this.params);
  stream.type = 'site stream';
  stream.id = this.streams.push(stream);
  this.add(stream);
  return stream;
};


/**
 * Create a public stream and route its events to the pool.
 *
 * @param {!Object} params
 * @return {PublicStream}
 */
Pool.prototype.createPublicStream = function(params) {
  var stream = this.client.createPublicStream(params);
  stream.type = 'public stream';
  this.streams.push(stream);
  this.add(stream);
  return stream;
};


/**
 * Create a sample stream and route its events to the pool.
 *
 * @param {!Object} params
 * @return {TwitterStream}
 */
Pool.prototype.createSampleStream = function(params) {
  var stream = this.client.createSampleStream(params);
  stream.type = 'sample stream';
  this.streams.push(stream);
  this.add(stream);
  return stream;
};


/**
 * Create a firehose and route its events to the pool.
 *
 * @param {!Object} params
 * @return {TwitterStream}
 */
Pool.prototype.createFirehose = function(params) {
  var stream = this.client.createFirehose(params);
  stream.type = 'firehose';
  this.streams.push(stream);
  this.add(stream);
  return stream;
};


/**
 * Create a user stream and route its events to the pool.
 *
 * @param {!Object} params
 * @return {UserStream}
 */
Pool.prototype.createUserStream = function(params) {
  var stream = this.client.createUserStream(params);
  stream.type = 'user stream';
  this.streams.push(stream);
  this.add(stream);
  return stream;
};
