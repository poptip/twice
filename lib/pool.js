/**
 * pool.js
 *
 * Controls creating site streams and adding/removing users to them.
 *
 * When a user needs to be added, the pool of streams needs to be checked for
 * any available spaces. Site streams can have 1000 concurrent users at a time.
 * If there is no spaces, a new stream is created with a timeout.
 *
 * The timeout is set so that if any other users want to get in on the stream
 * before the timeout callback fires, they can do so when the stream is first
 * opened. Up to 100 users.
 */

var TwitterStream = require('./stream')
  , SiteStream = require('./sitestream')
  , twitter = require('./index')
  , EventEmitter = require('events').EventEmitter
  , util = require('util')
  , _ = require('underscore')
  ;


/**
 * Twitter may change these in the future.
 */
var MAX_USERS_PER_STREAM = 1000;
var MAX_INITIAL_USERS = 100;


/**
 * Events that will be proxied from all site streams in a pool to that pool.
 */
var PROXIED_EVENTS = [
  'connect'
, 'disconnect'
, 'reconnecting'
, 'reconnect'
, 'data'
, 'error'
, 'destroy'
, 'addUsers'
, 'addUsersError'
, 'failedToAdd'
, 'removeUser'
];


/**
 * @constructor
 * @extends (EventEmitter)
 * @param (TwitterClient) client
 * @param (Object) options
 */
var Pool = module.exports = function(client, options) {
  this.client = client;
  options = options || {};
  _.defaults(options, {
    addUserTimeout: 1000
  });

  // keeps a list of available site streams
  this.streams = [];

  // List of twitter user IDs that are waiting for new site streams.
  this.queuedUserIDs = [];

  // Keep track of users that are in a site stream with the stream associated
  // with their twitter id.
  this.users = {};

  this._debouncedAddQueuedUsers = _.debounce(this._addQueuedUsers,
                                             options.addUserTimeout);

};

util.inherits(Pool, EventEmitter);


/**
 * Adds a user to a site stream. Their tweets, replies/retweets of their tweets
 * events will be emitted by the pool.
 *
 * @param (string) twitterID
 * @param (boolean) queue
 */
Pool.prototype.addUser = function(twitterID, queue) {
  var self = this;

  if (this.users[twitterID] || ~this.queuedUserIDs.indexOf(twitterID)) {
    this.emit('error', new Error('user ' + twitterID + ' already in pool'));
    return;
  }

  if (queue) {
    this.queuedUserIDs.push(twitterID);

    if (this.queuedUserIDs.length === MAX_INITIAL_USERS) {
      // if the list of IDs is full, create a site stream for them right away
      this._addQueuedUsers();

    } else {
      // otherwise wait a bit in case other users want in
      this._debouncedAddQueuedUsers();
    }

  } else {
    this.addUsers([twitterID]);
  }
};


/**
 * Add several user IDs at once.
 *
 * @param (Array.string) twitterIDs
 */
Pool.prototype.addUsers = function(twitterIDs) {
  var self = this;

  // filter for streams with spots opened
  this.streams.filter(function(stream) {
    return stream.userCount() < MAX_USERS_PER_STREAM;
  }).forEach(function(stream) {
    // grab the first twitter IDs from the last which the stream can support
    var max = MAX_USERS_PER_STREAM - stream.userCount();
    var streamIDs = twitterIDs.splice(0, max);

    stream.addUsers(streamIDs);
  });

  // if there are still user IDs to be added, create new site streams as needed
  while (twitterIDs.length) {
    var streamIDs = twitterIDs.splice(0, MAX_USERS_PER_STREAM);
    self._createSiteStream(streamIDs);
  }
};


/**
 * Adds users that have been queued. Adding users to the queue uses up
 * less requests to the Twitter API as users are added in groups.
 */
Pool.prototype._addQueuedUsers = function() {
  this.addUsers(this.queuedUserIDs);
  this.queuedUserIDs = [];
};


/**
 * Removes a user from a site stream.
 *
 * @param (string) twitterID
 */
Pool.prototype.removeUser = function(twitterID) {
  var stream = this.users[twitterID];

  if (stream) {
    var self = this;
    stream.removeUser(twitterID, function(err) {
      if (err) return;
      delete this.users[twitterID];
    });

  } else {
    this.emit('error', new Error('user ' + twitterID + ' not present in pool'));
  }
};


/**
 * Creates a site stream and adds it to the pool.
 *
 * @param (Array.string) twitterIDs
 */
Pool.prototype._createSiteStream = function(twitterIDs) {
  var stream = new SiteStream(this.client, twitterIDs);
  this.streams.push(stream);

  var self = this;

  // proxy events from stream
  PROXIED_EVENTS.forEach(function(event) {
    stream.on(event, self.emit.bind(self, event));
  });

  stream.on('data', TwitterStream.onData.bind(self));
  stream.on('data', self.emit.bind(self, 'data'));

  stream.on('addUsers', function(twitterIDs) {
    twitterIDs.forEach(function(id) {
      self.users[id] = stream;
    });
  });

  stream.on('addUsersError', function(twitterIDs) {
  });
};
