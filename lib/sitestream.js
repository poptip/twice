var inherits      = require('util').inherits;
var TwitterStream = require('./stream');
var constants     = require('./constants').SITE_STREAM;


/**
 * Cache constants in variables.
 */
var MAX_USERS = constants.MAX_USERS;
var MAX_INITIAL_USERS = constants.MAX_INITIAL_USERS;
var MAX_USERS_PER_REQUEST = constants.MAX_USERS_PER_REQUEST;
var HOST = constants.HOST;
var RESOURCE_URL = constants.RESOURCE_URL;


/**
 * @constructor
 * @extends (TwitterStream)
 * @param (TwitterClient) client
 * @param (Array.string) follow Array of twitter user IDs.
 * @param (Object) params
 */
var SiteStream = module.exports = function(client, follow, params) {
  if (!follow) follow = [];
  else {
    if (follow.length > MAX_USERS) {
      throw new Error('follow list can not exceed ' + MAX_USERS);
    }

    if (follow.some(function(id) { return isNaN(parseInt(id, 10)); })) {
      throw new Error('twitter IDs must be integers');
    }
  }


  TwitterStream.call(this, client, RESOURCE_URL, params);

  this._init(follow);
  var initialUsers;

  var self = this;
  self.on('beforeConnect', function() {
    // add users already on stream on reconnect
    if (self._userCount) {
      self._init(Object.keys(self._users));
    }

    initialUsers = self._queuedUsers.slice(0, MAX_INITIAL_USERS);
    self.params.follow = initialUsers.join(',');
  });

  self.on('control', function(uri) {
    self.add_user_uri = HOST + uri + '/add_user.json';
    self.remove_user_uri = HOST + uri + '/remove_user.json';
    self.info_uri = HOST + uri + '/info.json';

    self._addTwitterIDs(initialUsers);

    // if there are more than MAX_INITIAL_USERS to follow,
    // they must be added later
    if (self._queuedUsers.length) {
      self._addMany(self._queuedUsers);
    }
  });

  // if there was a socket error adding users, retry
  self.on('error', function(err) {
    if (err.type === 'addUsers') {
      self.retry.bind(self, 'exponential', 'addUsers', []);
    }
  });

  // when a user who is already on this site stream revokes access to the app,
  // remove them
  self.on('token revoked', function(twitterID) {
    self._removeUser(twitterID);
  });

};

inherits(SiteStream, TwitterStream);


/**
 * Export Twitter constants
 */
SiteStream.MAX_USERS = MAX_USERS;
SiteStream.MAX_INITIAL_USERS = MAX_INITIAL_USERS;
SiteStream.MAX_USERS_PER_REQUEST = MAX_USERS_PER_REQUEST;


/**
 * Called each time before the stream has to connect.
 *
 * @param (Array.string) twitterIDs
 */
SiteStream.prototype._init = function(twitterIDs) {
  this._queuedUsers = [];
  this._queuedUsersHash = {};
  this._addToQueuedUsers(twitterIDs);
  this._users = {};
  this._userCount = 0;
};


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
 */
SiteStream.prototype.addUsers = function(twitterIDs) {
  if (twitterIDs.some(function(id) { return isNaN(parseInt(id, 10)); })) {
    throw new TypeError('twitter IDs must be integers');
  }

  var self = this;
  twitterIDs.forEach(function(twitterID) {
    if (self.hasUser(twitterID)) {
      throw new Error('This stream already contains user ' + twitterID);
    }
  });

  this._addToQueuedUsers(twitterIDs);

  if (this.userCount() > MAX_USERS) {
    throw new Error('too many users to add to this stream');
  }

  this._addMany(twitterIDs);
};


/**
 * Separates list of users by MAX_USERS_PER_REQUEST to add them.
 *
 * @param (Array.string) twitterIDs
 */
SiteStream.prototype._addMany = function(twitterIDs) {
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

  self._client.post(self.add_user_uri, params, function(err) {
    if (err && !(err instanceof SyntaxError)) {
      err.type = 'addUsers';
      err.uri = self.add_user_uri;
      err.twitterIDs = twitterIDs;
      self.emit('error', err);
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
    if (err) return self.emit('error', err);

    var usersHash = self._users = {};
    self._userCount = 0;
    data.info.users.forEach(function(user) {
      usersHash[user.id] = user.name;
      self._userCount++;
    });

    // keep track of what users from this request were successfully added
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

  twitterIDs = twitterIDs.filter(function(twitterID) {
    if (self._queuedUsersHash[twitterID]) {
      return false;
    } else {
      self._queuedUsersHash[twitterID] = true;
      return true;
    }
  });

  self._queuedUsers = self._queuedUsers.concat(twitterIDs);
};


/**
 * Returns amount of spots taken up by users and potential future users.
 *
 * @returns (number)
 */
SiteStream.prototype.userCount = function() {
  return this._userCount + this._queuedUsers.length;
};


/**
 * Returns true if site stream contains a user.
 *
 * @param (string) twitterID
 * @return (boolean)
 */
SiteStream.prototype.hasUser = function(twitterID) {
  return !!this._users[twitterID] || !!this._queuedUsersHash[twitterID];
};


/**
 * Remove a user from the stream.
 *
 * @param (string) twitterID
 * @param (Function(!Error)) callback
 */
SiteStream.prototype.removeUser = function(twitterID, callback) {
  if (isNaN(parseInt(twitterID, 10))) {
    throw new TypeError('twitter ID is not an integer');
  }
  callback = callback || function() {};

  if (this._users[twitterID]) {
    // check if this user is already in the stream
    var self = this;
    var data = { user_id: twitterID };
    self._client.post(self.remove_user_uri, data, function(err) {
      if (err) {
        err.uri = self.remove_user_uri;
        err.twitterID = twitterID;
        self.emit('error', err);
        callback(err);
        return;
      }

      self._removeUser(twitterID);
      callback(null);
    });

  } else if (this._queuedUsersHash[twitterID]) {
    // otherwise it might be queued
    this._queuedUsers.splice(this.queuedUsers.indexOf(twitterID), 1);
    delete this._queuedUsersHash[twitterID];

  } else {
    throw new Error('User ' + twitterID + ' is not in stream');
  }
  
  process.nextTick(callback.bind(null, null));
};


/**
 * Remove user.
 *
 * @param (string) twitterID
 */
SiteStream.prototype._removeUser = function(twitterID) {
  delete this._users[twitterID];
  this.emit('removeUser', twitterID);
};


/**
 * Returns info about the site stream.
 *
 * @param (Function(!Error, Object)) callback
 */
SiteStream.prototype.info = function(callback) {
  var self = this;

  self._client.get(self.info_uri, function(err, data) {
    if (err) {
      err.uri = self.info_uri;
      self.emit('error', err);
      callback(err);
      return;
    }

    callback(null, data);
  });
};
