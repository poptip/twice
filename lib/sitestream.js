var inherits      = require('util').inherits;
var TwitterStream = require('./stream');
var constants     = require('./constants').SITE_STREAM;
var TimeQueue     = require('timequeue');


/**
 * @constructor
 * @extends {TwitterStream}
 * @param {TwitterClient} client
 * @param {Array.<String>} follow Array of twitter user IDs.
 * @param {!Object} params
 */
var SiteStream = module.exports = function(client, follow, params) {
  if (!follow) follow = [];
  else {
    if (follow.length > SiteStream.MAX_USERS) {
      throw Error('Follow list cannot exceed ' + SiteStream.MAX_USERS);
    }

    if (follow.some(function(id) { return isNaN(parseInt(id, 10)); })) {
      throw new TypeError('Twitter IDs must be integers');
    }
  }


  TwitterStream.call(this, client, SiteStream.RESOURCE_URL, params);
  this._tweets = this._tweets || [];
  this._tweetsHash = this._tweetsHash || {};
  this._init(follow);
  var initialUsers;
  var self = this;

  // Create queue for requests.
  self._queue = new TimeQueue(function worker(method, path, params, callback) {
    function makeRequest() {
      var uri = SiteStream.HOST + self.control_uri + '/' + path + '.json';
      if (method === 'get') {
        self._client.get(uri, callback);
      } else if (method === 'post') {
        self._client.post(uri, params, callback);
      }
    }

    if (self.connected && self.control_uri) {
      process.nextTick(makeRequest);
    } else {
      self.once('control', makeRequest);
    }
  });

  // Clear `control_uri` when stream disconnects.
  self.on('end', function onEnd() {
    delete self.control_uri;
  });

  if (follow.length) {
    process.nextTick(function() {
      self.emit('addUsersToQueue', follow);
    });
  }

  self.on('beforeConnect', function() {
    // Add users already on stream on reconnect.
    if (self.users.length) {
      self._init(self.users);
    }

    initialUsers = self.usersInQueue.slice(0, SiteStream.MAX_INITIAL_USERS);
    self.params.follow = initialUsers.join(',');
  });

  self.on('control', function(uri) {
    self.control_uri = uri;

    if (initialUsers.length) {
      self._addTwitterIDs(initialUsers);
    }

    // If there are more than MAX_INITIAL_USERS to follow,
    // they must be added later.
    var additionalQueuedUsers = self.usersInQueue
      .slice(Math.min(initialUsers.length, SiteStream.MAX_INITIAL_USERS));
    if (additionalQueuedUsers.length) {
      self._addMany(additionalQueuedUsers);
    }
  });

  // When a user who is already on this site stream revokes access to the app,
  // remove them.
  self.on('token revoked', function(twitterID) {
    self._removeUser(twitterID);
  });

};

inherits(SiteStream, TwitterStream);


/**
 * Export Twitter constants
 */
SiteStream.MAX_USERS = constants.MAX_USERS;
SiteStream.MAX_INITIAL_USERS = constants.MAX_INITIAL_USERS;
SiteStream.MAX_USERS_PER_REQUEST = constants.MAX_USERS_PER_REQUEST;
SiteStream.HOST = constants.HOST;
SiteStream.RESOURCE_URL = constants.RESOURCE_URL;


/**
 * Called each time before the stream has to connect.
 *
 * @param {Array.<String>} twitterIDs
 */
SiteStream.prototype._init = function(twitterIDs) {
  this.users = twitterIDs;
  this.usersInStream = [];
  this._usersInStreamHash = {};
  this.usersInQueue = twitterIDs;
  var hash = this._usersInQueueHash = {};
  twitterIDs.forEach(function(id) {
    hash[id] = true;
  });
};


/**
 * Add a user to the stream.
 *
 * @param {String} twitterID
 */
SiteStream.prototype.addUser = function(twitterID) {
  this.addUsers([twitterID]);
};


/**
 * Add several users to the stream at once. Breaks up requests into groups
 * of MAX_USERS_PER_REQUEST.
 *
 * @param {Array.<String>} twitterIDs
 */
SiteStream.prototype.addUsers = function(twitterIDs) {
  if (twitterIDs.some(function(id) { return isNaN(parseInt(id, 10)); })) {
    throw new TypeError('Twitter IDs must be integers');
  }

  var self = this;
  twitterIDs.forEach(function(twitterID) {
    if (self.hasUser(twitterID)) {
      throw Error('This stream already contains user ' + twitterID);
    }
  });

  if (this.users.length + twitterIDs.length > SiteStream.MAX_USERS) {
    throw Error('Too many users to add to this stream');
  }

  this.users = this.users.concat(twitterIDs);
  this.usersInQueue = this.usersInQueue.concat(twitterIDs);
  this.emit('addUsersToQueue', twitterIDs);

  var hash = this._usersInQueueHash;
  twitterIDs.forEach(function(id) {
    hash[id] = true;
  });

  if (this.connected) {
    this._addMany(twitterIDs);
  }
};


/**
 * Separates list of users by MAX_USERS_PER_REQUEST to add them.
 *
 * @param {Array.<String>} twitterIDs
 */
SiteStream.prototype._addMany = function(twitterIDs) {
  var i = 0;
  while (i < twitterIDs.length) {
    var j = i + SiteStream.MAX_USERS_PER_REQUEST;
    this._addUsers(twitterIDs.slice(i, j));
    i = j;
  }
};


/**
 * Does the actual adding by requesting to the stream control uri.
 *
 * @param {Array.<String>} twitterIDs
 */
SiteStream.prototype._addUsers = function(twitterIDs) {
  var self = this;
  var params = { user_id: twitterIDs.join(',') };

  self.post('add_user', params, function onAddUser(err) {
    if (err) {
      err.type = 'addUsers';
      err.twitterIDs = twitterIDs;
      err.length = twitterIDs.length;
      self.emit('error', err);
      self.retry('exponential', '_addUsers', twitterIDs);
      return;
    }

    self._addTwitterIDs(twitterIDs);
  });
};


/**
 * Add successfully added user IDs to this stream's records.
 *
 * @param {Array.<String>} twitterIDs
 */
SiteStream.prototype._addTwitterIDs = function(twitterIDs) {
  var self = this;

  // Get info from twitter to double check that users were added.
  self.info(function(err, data) {
    if (err) return self.emit('error', err);
    if (!data.info || !data.info.users || !Array.isArray(data.info.users)) {
      err = Error('Invalid response');
      err.data = data;
      return self.emit('error', err);
    }

    // Clean up queued users list.
    twitterIDs.forEach(function(twitterID) {
      delete self._usersInQueueHash[twitterID];
    });

    // Update list of users in stream.
    var users = self.usersInStream = [];
    var usersHash = self._usersInStreamHash = {};
    data.info.users.forEach(function(user) {
      delete self._usersInQueueHash[user.id];
      users.push(user.id);
      usersHash[user.id] = user.name;
    });

    self.usersInQueue = Object.keys(self._usersInQueueHash);

    // Update list of all users.
    self.users = users.concat(self.usersInQueue);

    // Keep track of what users from this request were successfully added.
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

    // Emit events.
    if (addedUsers.length) {
      self.emit('addUsersToStream', addedUsers, addedUsersHash);
    }

    if (failedToAdd.length) {
      self.emit('failedToAddUsers', failedToAdd);
    }
  });
};


/**
 * Returns true if site stream contains a user.
 *
 * @param {String} twitterID
 * @return {Boolean}
 */
SiteStream.prototype.hasUser = function(twitterID) {
  return this.hasUserInStream(twitterID) || this.hasUserInQueue(twitterID);
};


/**
 * Returns true if user is in stream being listened to.
 *
 * @param {String} twitterID
 * @return {Boolean}
 */
SiteStream.prototype.hasUserInStream = function(twitterID) {
  return !!this._usersInStreamHash[twitterID];
};


/**
 * Returns true if user is in queue.
 *
 * @param {String} twitterID
 * @return {Boolean}
 */
SiteStream.prototype.hasUserInQueue = function(twitterID) {
  return !!this._usersInQueueHash[twitterID];
};


/**
 * Remove a user from the stream by using the control endpoint.
 *
 * @param {String} twitterID
 * @param {Function(!Error)} callback
 */
SiteStream.prototype.removeUser = function(twitterID, callback) {
  if (isNaN(parseInt(twitterID, 10))) {
    throw new TypeError('Twitter ID is not an integer');
  }
  callback = callback || function() {};

  if (!this.hasUser(twitterID)) {
    throw Error('User ' + twitterID + ' is not in stream');
  }

  var self = this;
  var data = { user_id: twitterID };
  // The POST request to remove the user will still be made even if they
  // are queued because the request to add them
  // might have already gone through.
  self.post('remove_user', data, function onRemoveUser(err) {
    if (err) {
      err.twitterID = twitterID;
      callback(err);
      return;
    }

    self._removeUser(twitterID);
    callback(null);
  });
};


/**
 * Remove user from underlying stream variables.
 *
 * @param {String} twitterID
 */
SiteStream.prototype._removeUser = function(twitterID) {
  // Remove from list of all users.
  this.users.splice(this.users.indexOf(twitterID), 1);

  // Remove from list of users in stream if in there.
  if (this._usersInStreamHash[twitterID]) {
    this.usersInStream.splice(this.usersInStream.indexOf(twitterID), 1);
    delete this._usersInStreamHash[twitterID];

  } else if (this._usersInQueueHash[twitterID]) {
    // Otherwise it might be queued.
    this.usersInQueue.splice(this.usersInQueue.indexOf(twitterID), 1);
    delete this._usersInQueueHash[twitterID];
  }

  this.emit('removeUser', twitterID);
};


/**
 * Returns info about the site stream.
 *
 * @param {Function(!Error, Object)} callback
 */
SiteStream.prototype.info = function(callback) {
  this.get('info', callback);
};


/**
 * Queue a request for this site stream.
 *
 * @param {String} method
 * @param {String} path
 * @param {Object} params
 * @param {Function(!Error, Object)} callback
 */
SiteStream.prototype._request = function(method, path, params, callback) {
  this._queue.push(method, path, params, callback);
};


/**
 * GET request.
 *
 * @param {String} path
 * @param {Function(!Error, Object)} callback
 */
SiteStream.prototype.get = function(path, callback) {
  this._request('get', path, null, callback);
};


/**
 * POST request.
 *
 * @param {String} path
 * @param {Object} params
 * @param {Function(!Error, Object)} callback
 */
SiteStream.prototype.post = function(path, params, callback) {
  this._request('post', path, params, callback);
};
