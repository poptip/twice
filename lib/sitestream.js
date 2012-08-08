/**
 * sitestream.js
 *
 * Twitter site stream
 */
var TwitterStream = require('./stream')
  , util = require('util')
  ;


/**
 * Twitter may change these in the future.
 */
var MAX_USERS_PER_STREAM = 1000;
var MAX_INITIAL_USERS = 100;
var MAX_USERS_PER_REQUEST = 100;
var REST_BASE = 'https://sitestream.twitter.com';


/**
 * @constructor
 * @extends (TwitterStream)
 * @param (TwitterClient) client
 * @param (Array.string) follow Array of twitter user IDs.
 */
var SiteStream = module.exports = function(client, follow) {
  if (follow.length > MAX_USERS_PER_STREAM) {
    throw new Error('follow list can not exceed ' + MAX_USERS_PER_STREAM);
  }

  var id = follow[0];
  if (follow.some(function(id) { return isNaN(parseInt(id, 10)); })) {
    throw new Error('twitter IDs must be integers');
  }

  var self = this;

  TwitterStream.call(this, client, 'site', {});
  this._queuedUsers = [];
  this._queuedUsersHash = {};
  this._addToQueuedUsers(follow);
  this.users = [];
  var initialUsers;

  self.on('beforeConnect', function() {
    // add users already on stream on reconnect
    if (self.users.length) {
      self._queuedUsers = [];
      self._queuedUsersHash = {};
      self._addToQueuedUsers(self.users);
      self.users = [];
    }

    initialUsers = self._queuedUsers.slice(0, MAX_INITIAL_USERS);
    self.params.follow = initialUsers.join(',');
  });

  self.on('first', function(data) {
    var control_uri = data.control.control_uri;
    self.add_user_uri = REST_BASE + control_uri + '/add_user.json';
    self.remove_user_uri = REST_BASE + control_uri + '/remove_user.json';
    self.info_uri = REST_BASE + control_uri + '/info.json';

    self._addTwitterIDs(initialUsers);

    // if there are more than MAX_INITIAL_USERS to follow,
    // they must be added later
    if (self._queuedUsers.length) {
      self.addUsers(self._queuedUsers, true);
    }
  });

  self.on('addUsersError', self.retry.bind(self, 5000, 'addUsers'));

};

util.inherits(SiteStream, TwitterStream);


/**
 * Add a user to the stream.
 *
 * @param (string) twitterID
 */
SiteStream.prototype.addUser = function(twitterID) {
  this.addUsers([twitterID]);
};


/**
 * Add several users to the stream at once. Breaks up requests into groups
 * of MAX_USERS_PER_REQUEST.
 *
 * @param (Array.string) twitterIDs
 * @param (boolean) alreadyQueued
 */
SiteStream.prototype.addUsers = function(twitterIDs, alreadyQueued) {
  if (twitterIDs.some(function(id) { return isNaN(parseInt(id, 10)); })) {
    throw new Error('twitter IDs must be integers');
  }

  if (!alreadyQueued) {
    this._addToQueuedUsers(twitterIDs);
  }

  if (this.userCount() > MAX_USERS_PER_STREAM) {
    throw new Error('too many users to add to this stream');
  }

  while (twitterIDs.length) {
    var requestIDs = twitterIDs.splice(0, MAX_USERS_PER_REQUEST);
    this._addUsers(requestIDs);
  }
};


/**
 * Does the actual adding by requesting to the stream control uri.
 *
 * @param (Array.string) twitterIDs
 */
SiteStream.prototype._addUsers = function(twitterIDs) {
  var self = this;
  var params = { user_id: twitterIDs.join(',') };

  self.client.post(self.add_user_uri, params, function(err) {
    if (err && !(err instanceof SyntaxError)) {
      self.emit('addUsersError', twitterIDs);
      var data = { uri: self.add_user_uri, twitterIDs: twitterIDs };
      self.emit('error', err, data);
      return;
    }

    self._addTwitterIDs(twitterIDs);
  });
};


/**
 * Add successfully added user IDs to this stream's records.
 *
 * @param (Array.string) twitterIDs
 */
SiteStream.prototype._addTwitterIDs = function(twitterIDs) {
  var self = this;

  // clean up queued users list
  twitterIDs.forEach(function(twitterID) {
    delete self._queuedUsersHash[twitterID];
  });

  self._queuedUsers = Object.keys(self._queuedUsersHash);

  // get info from twitter to doublecheck users were added
  self.info(function(err, data) {
    if (err) return;

    var usersHash = {};
    data.info.users.forEach(function(user) {
      usersHash[user.id] = user.name;
    });

    // keep track of what users were successfully added
    var addedUsers = [];
    var addedUsersHash = {};
    var failedToAdd = [];

    twitterIDs.forEach(function(twitterID) {
      if (usersHash[twitterID]) {
        addedUsers.push(twitterID);
        addedUsersHash[twitterID] = usersHash[twitterID];
      } else {
        failedToAdd.push(twitterID);
      }
    });

    // update list of users on site stream
    if (addedUsers.length) {
      self.users = self.users.concat(addedUsers);
      self.emit('addUsers', addedUsers, addedUsersHash);
    }

    if (failedToAdd.length) {
      self.emit('failedToAdd', failedToAdd);
    }
  });
};


/**
 * Add twitter IDs to private queue.
 *
 * @param (Array.string) twitterIDs
 */
SiteStream.prototype._addToQueuedUsers = function(twitterIDs) {
  var self = this;

  twitterIDs.forEach(function(twitterID) {
    self._queuedUsersHash[twitterID] = true;
  });

  self._queuedUsers = self._queuedUsers.concat(twitterIDs);
};


/**
 * Returns amount of spots taken up by users and potential users.
 *
 * @returns (number)
 */
SiteStream.prototype.userCount = function() {
  return this.users.length + this._queuedUsers.length;
};


/**
 * Remove a user from the stream.
 *
 * @param (string) twitterID
 * @param (Function(!Error)) callback
 */
SiteStream.prototype.removeUser = function(twitterID, callback) {
  if (isNaN(parseInt(twitterID, 10))) {
    throw new Error('twitter ID is not an integer');
  }

  var self = this;

  self.client.post(self.remove_user_uri, { user_id: twitterID }, function(err) {
    if (err) {
      var data = { uri: self.remove_user_uri, twitterID: twitterID };
      self.emit('error', err, data);
      callback(err);
      return;
    }

    delete self.users.splice(self.users.indexOf(twitterID), 1);
    self.emit('removeUser', twitterID);
    callback(null);
  });
};


/**
 * Returns info about the site stream.
 *
 * @param (Function(!Error, Object)) callback
 */
SiteStream.prototype.info = function(callback) {
  var self = this;

  self.client.get(self.info_uri, function(err, data) {
    if (err) {
      err.uri = self.info_uri;
      self.emit('error', err);
      callback(err);
      return;
    }

    callback(null, data);
  });
};
