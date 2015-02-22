var Stweam     = require('..');
var SiteStream = require('../lib/sitestream');
var spy        = require('sinon').spy;

/**
 * Mock POST/GET requests of site streams and the connection functions.
 *
 * @param {null|Array.<String>} users List of Twitter IDs to add to the stream
 *   when it is initiated.
 * @param {Boolean} connected Wether or not this stream will be considered
 *   connected.
 * @return {SiteStream}
 */
function createSiteStream(users, connected) {
  var client = new Stweam();
  client.get = client.post = function request(uri, params, callback) {
    callback = callback || params;
    process.nextTick(callback.bind(null, null));
  };

  var stream = client.createSiteStream(users);

  if (connected) {
    stream.connected = true;
    stream.control_uri = '/a';
    stream.connect = function() {};
  } else {
    stream.connect = function() {
      var self = this;
      self.emit('beforeConnect');
      process.nextTick(function() {
        self.connected = true;
        self.emit('connect');
        process.nextTick(self.emit.bind(self, 'control', '/a'));
      });
    };
  }

  return stream;
}


/**
 * Creates a list of Twitter IDs that can be used for tests.
 *
 * @param {Number} amount
 * @return {Array.<String>}
 */
function createUsers(amount) {
  var users = new Array(amount);
  for (var i = 0; i < amount; i++) {
    users[i] = ~~(Math.random() * 1e9) + '';
  }
  return users;
}


exports['create site stream'] = {
  'with more users than able to': function(test) {
    var users = createUsers(SiteStream.MAX_USERS * 2);

    test.throws(function() {
      createSiteStream(users);
    }, /Follow list cannot exceed/);

    test.done();
  },

  'with incorrect Twitter IDs': function(test) {
    test.throws(function() {
      createSiteStream([1234, NaN]);
    }, 'Twitter IDs must be integers');

    test.done();
  },

  'successfully with': {
    'no users': function(test) {
      var stream = createSiteStream(null);

      stream.on('control', function() {
        test.equal(stream.control_uri, '/a');
        test.equal(stream.users.length, 0);
        test.equal(stream.usersInStream.length, 0);
        test.equal(stream.usersInQueue.length, 0);
        test.equal(stream.failedToAddUsers.length, 0);

        test.done();
      });

      stream.on('addUsersToQueue', function() {
        throw new Error('`addUsersToQueue` should not be emitted.');
      });

      stream.on('addUsersToStream', function() {
        throw new Error('`addUsersToStream` should not be emitted.');
      });

      stream.on('failedToAddUsers', function() {
        throw new Error('`failedToAddUsers` should not be emitted.');
      });

      stream.info = function() {
        throw new Error('Should not call SiteStream#info()');
      };
    },
    'some users': function(test) {
      var stream = createSiteStream(['1', '1234']);

      stream.on('beforeConnect', function() {
        test.equal(stream.params.follow, '1,1234');
      });

      stream.info = function(callback) {
        process.nextTick(callback.bind(this, null, {
          info: {
            users: [
              { id: '1', name: 'roly' },
              { id: '1234', name: 'yolo' },
            ]
          }
        }));
      };

      test.ok(stream.hasUser('1'));
      test.ok(!stream.hasUserInStream('1'));
      test.ok(stream.hasUserInQueue('1'));

      test.ok(stream.hasUser('1234'));
      test.ok(!stream.hasUserInStream('1234'));
      test.ok(stream.hasUserInQueue('1234'));

      test.ok(!stream.hasUser('roly'));
      test.ok(!stream.hasUserInStream('roly'));
      test.ok(!stream.hasUserInQueue('roly'));

      var addUsersToQueueSpy = spy();
      stream.on('addUsersToQueue', addUsersToQueueSpy);

      stream.on('addUsersToQueue', function(users) {
        test.equal(users.length, 2);
        test.equal(users[0], '1');
        test.equal(users[1], '1234');
      });

      var addUsersToStreamSpy = spy();
      stream.on('addUsersToStream', addUsersToStreamSpy);

      stream.on('failedToAddUsers', function() {
        throw new Error('`failedToAddUsers` should not be emitted.');
      });

      stream.on('addUsersToStream', function(users, hash) {
        test.equal(stream.users.length, 2);
        test.equal(stream.usersInStream.length, 2);
        test.equal(stream.usersInQueue.length, 0);
        test.equal(stream.failedToAddUsers.length, 0);

        test.ok(stream.hasUser('1'));
        test.ok(stream.hasUserInStream('1'));
        test.ok(!stream.hasUserInQueue('1'));

        test.ok(stream.hasUser('1234'));
        test.ok(stream.hasUserInStream('1234'));
        test.ok(!stream.hasUserInQueue('1234'));

        test.ok(!stream.hasUser('2'));
        test.ok(!stream.hasUserInStream('2'));
        test.ok(!stream.hasUserInQueue('2'));

        test.equal(users[0], '1');
        test.equal(users[1], '1234');
        test.deepEqual(hash, { '1': 'roly', '1234': 'yolo' });

        test.ok(addUsersToQueueSpy.calledOnce);
        test.ok(addUsersToStreamSpy.calledOnce);

        test.done();
      });
    },
    'more users than maximum to start with': function(test) {
      var totalUsers = SiteStream.MAX_INITIAL_USERS * 2;
      var users = createUsers(totalUsers);
      var stream = createSiteStream(users);

      users.forEach(function(twitterID) {
        test.ok(stream.hasUser(twitterID));
        test.ok(!stream.hasUserInStream(twitterID));
        test.ok(stream.hasUserInQueue(twitterID));
      });

      stream.on('connect', function() {
        test.equal(stream.params.follow, users.slice(0, 100).join(','));
      });

      var infoSpy = spy();
      stream.info = function(callback) {
        infoSpy();

        process.nextTick(function() {
          var usersHash = users
            .slice(0, SiteStream.MAX_INITIAL_USERS + totalUsersAdded)
            .map(function(twitterID) {
              return {
                id: twitterID,
                name: (~~(Math.random() * 1e9)).toString(16)
              };
            });
          callback(null, {
            info: { users: usersHash }
          });
        });
      };

      var addUsersToQueueSpy = spy();
      stream.on('addUsersToQueue', addUsersToQueueSpy);

      stream.on('addUsersToQueue', function(users) {
        test.equal(users.length, totalUsers);
      });

      var addUsersToStreamSpy = spy();
      stream.on('addUsersToStream', addUsersToStreamSpy);

      stream.on('failedToAddUsers', function() {
        throw new Error('`failedToAddUsrs` should not be emitted.');
      });

      var totalUsersAdded = 0;
      stream.on('addUsersToStream', function(addUsersToStream, hash) {
        addUsersToStream.forEach(function(twitterID) {
          test.ok(stream.hasUser(twitterID));
          test.ok(stream.hasUserInStream(twitterID));
          test.ok(!stream.hasUserInQueue(twitterID));
          test.ok(hash[twitterID]);
        });

        totalUsersAdded += addUsersToStream.length;
        test.equal(stream.users.length, totalUsers);
        test.equal(stream.usersInStream.length, totalUsersAdded);
        test.equal(stream.usersInQueue.length, totalUsers - totalUsersAdded);
        test.equal(stream.failedToAddUsers.length, 0);

        users.slice(totalUsersAdded).forEach(function(twitterID) {
          test.ok(stream.hasUser(twitterID));
          test.ok(!stream.hasUserInStream(twitterID));
          test.ok(stream.hasUserInQueue(twitterID));
        });

        if (totalUsersAdded === totalUsers) {
          test.equal(infoSpy.callCount, 2);
          test.ok(addUsersToQueueSpy.called);
          test.equal(addUsersToStreamSpy.callCount, 2);
          test.done();
        }
      });
    }
  }
};


exports['add a user to site stream'] = {
  'successfully': function(test) {
    var stream = createSiteStream(null, true);

    stream.info = function(callback) {
      process.nextTick(callback.bind(null, null, {
        info: { users: [{ id: '42', name: 'roly' }] }
      }));
    };

    var addUsersToQueueSpy = spy();
    stream.on('addUsersToQueue', addUsersToQueueSpy);

    stream.on('addUsersToQueue', function(users) {
      test.equal(users.length, 1);
      test.equal(users[0], '42');
    });

    test.equal(stream.users.length, 0);
    test.equal(stream.usersInStream.length, 0);
    test.equal(stream.usersInQueue.length, 0);
    test.equal(stream.failedToAddUsers.length, 0);

    test.ok(!stream.hasUser('42'));
    test.ok(!stream.hasUserInStream('42'));
    test.ok(!stream.hasUserInQueue('42'));

    stream.addUser('42');

    test.equal(stream.users.length, 1);
    test.equal(stream.usersInStream.length, 0);
    test.equal(stream.usersInQueue.length, 1);
    test.equal(stream.failedToAddUsers.length, 0);

    test.ok(stream.hasUser('42'));
    test.ok(!stream.hasUserInStream('42'));
    test.ok(stream.hasUserInQueue('42'));

    stream.on('addUsersToStream', function(users, hash) {
      test.equal(stream.users.length, 1);
      test.equal(stream.usersInStream.length, 1);
      test.equal(stream.usersInQueue.length, 0);
      test.equal(stream.failedToAddUsers.length, 0);

      test.ok(stream.hasUser('42'));
      test.ok(stream.hasUserInStream('42'));
      test.ok(!stream.hasUserInQueue('42'));

      test.equal(users.length, 1);
      test.equal(users[0], '42');
      test.deepEqual(hash, { '42': 'roly' });
      test.ok(addUsersToQueueSpy.called);

      test.done();
    });

    stream.on('failedToAddUsers', function() {
      throw new Error('failedToAddUsers should not be emitted');
    });
  },
  'successfully when it was initiated with users': {
    'when connected': function(test) {
      var stream = createSiteStream(['1', '2', '3']);

      var users = [
        { id: '1', name: 'bob' },
        { id: '2', name: 'kob' },
        { id: '3', name: 'momy' }
      ];
      stream.info = function(callback) {
        process.nextTick(function() {
          callback(null, { info: { users: users } });
          users.push({ id: '42', name: 'roly' });
        });
      };

      stream.on('connect', function() {
        test.equal(stream.users.length, 3);
        test.equal(stream.usersInStream.length, 0);
        test.equal(stream.usersInQueue.length, 3);
        test.equal(stream.failedToAddUsers.length, 0);

        test.ok(!stream.hasUser('42'));
        test.ok(!stream.hasUserInStream('42'));
        test.ok(!stream.hasUserInQueue('42'));

        stream.addUser('42');

        test.equal(stream.users.length, 4);
        test.equal(stream.usersInStream.length, 0);
        test.equal(stream.usersInQueue.length, 4);
        test.equal(stream.failedToAddUsers.length, 0);

        test.ok(stream.hasUser('42'));
        test.ok(!stream.hasUserInStream('42'));
        test.ok(stream.hasUserInQueue('42'));
      });

      var addUsersToQueueSpy = spy();
      stream.once('addUsersToQueue', function() {
        stream.on('addUsersToQueue', addUsersToQueueSpy);

        stream.on('addUsersToQueue', function(users) {
          test.equal(users.length, 1);
          test.equal(users[0], '42');
        });
      });

      stream.once('addUsersToStream', function() {
        test.equal(stream.users.length, 4);
        test.equal(stream.usersInStream.length, 3);
        test.equal(stream.usersInQueue.length, 1);
        test.equal(stream.failedToAddUsers.length, 0);

        test.ok(stream.hasUser('42'));
        test.ok(!stream.hasUserInStream('42'));
        test.ok(stream.hasUserInQueue('42'));

        stream.once('addUsersToStream', function(users, hash) {
          test.equal(stream.users.length, 4);
          test.equal(stream.usersInStream.length, 4);
          test.equal(stream.usersInQueue.length, 0);
          test.equal(stream.failedToAddUsers.length, 0);

          test.ok(stream.hasUser('42'));
          test.ok(stream.hasUserInStream('42'));
          test.ok(!stream.hasUserInQueue('42'));

          test.equal(users.length, 1);
          test.equal(users[0], '42');
          test.deepEqual(hash, { '42': 'roly' });
          test.ok(addUsersToQueueSpy.called);

          test.done();
        });
      });

      stream.on('failedToAddUsers', function() {
        throw new Error('failedToAddUsers should not be emitted');
      });
    },
    'when not connected': function(test) {
      var stream = createSiteStream(['1', '2', '3']);

      var users = [
        { id: '1', name: 'bob' },
        { id: '2', name: 'kob' },
        { id: '3', name: 'momy' },
        { id: '42', name: 'roly' }
      ];
      stream.info = function(callback) {
        process.nextTick(function() {
          callback(null, { info: { users: users } });
        });
      };

      var addUsersToQueueSpy = spy();
      stream.once('addUsersToQueue', addUsersToQueueSpy);

      stream.once('addUsersToQueue', function(users) {
        test.equal(users.length, 1);
        test.equal(users[0], '42');
      });

      test.equal(stream.users.length, 3);
      test.equal(stream.usersInStream.length, 0);
      test.equal(stream.usersInQueue.length, 3);
      test.equal(stream.failedToAddUsers.length, 0);

      test.ok(!stream.hasUser('42'));
      test.ok(!stream.hasUserInStream('42'));
      test.ok(!stream.hasUserInQueue('42'));

      stream.addUser('42');

      test.equal(stream.users.length, 4);
      test.equal(stream.usersInStream.length, 0);
      test.equal(stream.usersInQueue.length, 4);
      test.equal(stream.failedToAddUsers.length, 0);

      test.ok(stream.hasUser('42'));
      test.ok(!stream.hasUserInStream('42'));
      test.ok(stream.hasUserInQueue('42'));

      stream.once('addUsersToStream', function() {

        test.equal(stream.users.length, 4);
        test.equal(stream.usersInStream.length, 4);
        test.equal(stream.usersInQueue.length, 0);
        test.equal(stream.failedToAddUsers.length, 0);

        test.ok(stream.hasUser('42'));
        test.ok(stream.hasUserInStream('42'));
        test.ok(!stream.hasUserInQueue('42'));

        test.equal(users.length, 4);
        test.ok(addUsersToQueueSpy.called);

        test.done();
      });

      stream.on('failedToAddUsers', function() {
        throw new Error('failedToAddUsers should not be emitted');
      });
    }
  },
  'unsuccessfully': function(test) {
    var stream = createSiteStream(null, true);

    stream.info = function(callback) {
      process.nextTick(callback.bind(null, null, {
        info: { users: [] }
      }));
    };

    var addUsersToQueueSpy = spy();
    stream.on('addUsersToQueue', addUsersToQueueSpy);

    stream.on('addUsersToQueue', function(users) {
      test.equal(users.length, 1);
      test.equal(users[0], '42');
    });

    test.equal(stream.users.length, 0);
    test.equal(stream.usersInStream.length, 0);
    test.equal(stream.usersInQueue.length, 0);
    test.equal(stream.failedToAddUsers.length, 0);

    test.ok(!stream.hasUser('42'));
    test.ok(!stream.hasUserInStream('42'));
    test.ok(!stream.hasUserInQueue('42'));

    stream.addUser('42');

    test.equal(stream.users.length, 1);
    test.equal(stream.usersInStream.length, 0);
    test.equal(stream.usersInQueue.length, 1);
    test.equal(stream.failedToAddUsers.length, 0);

    test.ok(stream.hasUser('42'));
    test.ok(!stream.hasUserInStream('42'));
    test.ok(stream.hasUserInQueue('42'));

    stream.on('addUsersToStream', function() {
      throw new Error('addUsersToStream should not be emitted');
    });

    stream.on('failedToAddUsers', function(users) {
      test.equal(stream.users.length, 0);
      test.equal(stream.usersInStream.length, 0);
      test.equal(stream.usersInQueue.length, 0);
      test.equal(stream.failedToAddUsers.length, 1);

      test.ok(!stream.hasUser('42'));
      test.ok(!stream.hasUserInStream('42'));
      test.ok(!stream.hasUserInQueue('42'));

      test.equal(users.length, 1);
      test.equal(users[0], '42');
      test.ok(addUsersToQueueSpy.called);

      test.done();
    });
  },
  'with invalid Twitter ID': function(test) {
    test.throws(function() {
      var stream = createSiteStream();
      stream.addUser('roly');
    }, 'Twitter IDs must be integers');
    test.done();
  },
  'when it is already in the stream': function(test) {
    var stream = createSiteStream(['42']);
    stream.info = function(callback) {
      process.nextTick(callback.bind(null, null, {
        info: { users: [{ id: '42', name: 'earth' }] }
      }));
    };

    test.ok(stream.hasUser('42'));
    test.ok(!stream.hasUserInStream('42'));
    test.ok(stream.hasUserInQueue('42'));

    test.throws(function() {
      stream.addUser('42');
    }, /This stream already contains user/);

    stream.on('addUsersToStream', function() {
      test.ok(stream.hasUser('42'));
      test.ok(stream.hasUserInStream('42'));
      test.ok(!stream.hasUserInQueue('42'));

      test.throws(function() {
        stream.addUser('42');
      }, /This stream already contains user/);
      test.done();
    });
  },
  'before stream is connected': function(test) {
    var stream = createSiteStream(null);

    stream.info = function(callback) {
      process.nextTick(callback.bind(null, null, {
        info: { users: [{ id: '42', name: 'roly' }] }
      }));
    };

    var addUsersToQueueSpy = spy();
    stream.on('addUsersToQueue', addUsersToQueueSpy);

    stream.on('addUsersToQueue', function(users) {
      test.equal(users.length, 1);
      test.equal(users[0], '42');
    });

    test.equal(stream.users.length, 0);
    test.equal(stream.usersInStream.length, 0);
    test.equal(stream.usersInQueue.length, 0);
    test.equal(stream.failedToAddUsers.length, 0);

    test.ok(!stream.hasUser('42'));
    test.ok(!stream.hasUserInStream('42'));
    test.ok(!stream.hasUserInQueue('42'));

    stream.addUser('42');

    test.equal(stream.users.length, 1);
    test.equal(stream.usersInStream.length, 0);
    test.equal(stream.usersInQueue.length, 1);
    test.equal(stream.failedToAddUsers.length, 0);

    test.ok(stream.hasUser('42'));
    test.ok(!stream.hasUserInStream('42'));
    test.ok(stream.hasUserInQueue('42'));

    stream.on('addUsersToStream', function(users, hash) {
      test.equal(stream.users.length, 1);
      test.equal(stream.usersInStream.length, 1);
      test.equal(stream.usersInQueue.length, 0);
      test.equal(stream.failedToAddUsers.length, 0);

      test.ok(stream.hasUser('42'));
      test.ok(stream.hasUserInStream('42'));
      test.ok(!stream.hasUserInQueue('42'));

      test.equal(users.length, 1);
      test.equal(users[0], '42');
      test.deepEqual(hash, { '42': 'roly' });
      test.ok(addUsersToQueueSpy.called);

      test.done();
    });

    stream.on('failedToAddUsers', function() {
      throw new Error('failedToAddUsers should not be emitted');
    });
  }
};


exports['add many users to site stream'] = {
  'less than maximum per request': function(test) {
    var stream = createSiteStream(null, true);

    test.equal(stream.users.length, 0);
    test.equal(stream.usersInStream.length, 0);
    test.equal(stream.usersInQueue.length, 0);
    test.equal(stream.failedToAddUsers.length, 0);

    var totalUsers = Math.floor(SiteStream.MAX_USERS_PER_REQUEST / 3);
    var users = createUsers(totalUsers);

    var addUsersToQueueSpy = spy();
    stream.on('addUsersToQueue', addUsersToQueueSpy);

    stream.on('addUsersToQueue', function(addedUsers) {
      test.deepEqual(addedUsers, users);
    });

    stream.addUsers(users);

    test.equal(stream.users.length, totalUsers);
    test.equal(stream.usersInStream.length, 0);
    test.equal(stream.usersInQueue.length, totalUsers);
    test.equal(stream.failedToAddUsers.length, 0);

    stream.info = function(callback) {
      var userInfo = users.map(function(twitterID) {
        return {
          id: twitterID,
          name: (~~(Math.random() * 1e9)).toString(16)
        };
      });
      process.nextTick(callback.bind(null, null, {
        info: { users: userInfo }
      }));
    };

    stream.on('addUsersToStream', function(users, hash) {
      test.equal(stream.users.length, totalUsers);
      test.equal(stream.usersInStream.length, totalUsers);
      test.equal(stream.usersInQueue.length, 0);
      test.equal(stream.failedToAddUsers.length, 0);

      users.forEach(function(twitterID) {
        test.ok(stream.hasUser(twitterID));
        test.ok(stream.hasUserInStream(twitterID));
        test.ok(!stream.hasUserInQueue(twitterID));
        test.ok(hash[twitterID]);
      });

      test.equal(users.length, totalUsers);
      test.ok(addUsersToQueueSpy.called);

      test.done();
    });

    stream.on('failedToAddUsers', function() {
      throw new Error('failedToAddUsers should not be emitted');
    });
  },
  'over the maximum per request': function(test) {
    var stream = createSiteStream(null, true);

    test.equal(stream.users.length, 0);
    test.equal(stream.usersInStream.length, 0);
    test.equal(stream.usersInQueue.length, 0);
    test.equal(stream.failedToAddUsers.length, 0);

    var totalUsers = Math.floor(SiteStream.MAX_USERS_PER_REQUEST * 2.5);
    var users = createUsers(totalUsers);

    var addUsersToQueueSpy = spy();
    stream.on('addUsersToQueue', addUsersToQueueSpy);

    stream.on('addUsersToQueue', function(addedUsers) {
      test.deepEqual(addedUsers, users);
    });

    stream.addUsers(users);

    test.equal(stream.users.length, totalUsers);
    test.equal(stream.usersInStream.length, 0);
    test.equal(stream.usersInQueue.length, totalUsers);
    test.equal(stream.failedToAddUsers.length, 0);

    stream.info = function(callback) {
      process.nextTick(function() {
        var userInfo = users
          .slice(0, SiteStream.MAX_USERS_PER_REQUEST + totalUsersAdded)
          .map(function(twitterID) {
            return {
              id: twitterID,
              name: (~~(Math.random() * 1e9)).toString(16)
            };
          });
        callback(null, {
          info: { users: userInfo }
        });
      });
    };

    var totalUsersAdded = 0;
    stream.on('addUsersToStream', function(users, hash) {
      totalUsersAdded += users.length;

      test.equal(stream.users.length, totalUsers);
      test.equal(stream.usersInStream.length, totalUsersAdded);
      test.equal(stream.usersInQueue.length, totalUsers - totalUsersAdded);
      test.equal(stream.failedToAddUsers.length, 0);

      users.forEach(function(twitterID) {
        test.ok(stream.hasUser(twitterID));
        test.ok(stream.hasUserInStream(twitterID));
        test.ok(!stream.hasUserInQueue(twitterID));
        test.ok(hash[twitterID]);
      });

      if (totalUsersAdded === totalUsers) {
        test.ok(addUsersToQueueSpy.called);
        test.done();
      }
    });

    stream.on('failedToAddUsers', function() {
      throw new Error('failedToAddUsers should not be emitted');
    });
  },
  'over the maximum allowed per site stream': function(test) {
    var initialUsers = createUsers(~~(Math.random() * SiteStream.MAX_USERS));
    var stream = createSiteStream(initialUsers, true);
    test.throws(function() {
      var users = createUsers(SiteStream.MAX_USERS - initialUsers.length + 1);
      stream.addUsers(users);
    }, 'Too many users to add to this stream');
    test.done();
  }
};


exports['remove user from site stream'] = {
  'that is in stream': function(test) {
    var stream = createSiteStream(['2345']);

    stream.info = function(callback) {
      process.nextTick(callback.bind(null, null, {
        info: { users: [{ id: '2345', name: 'jess' }] }
      }));
    };

    stream.on('addUsersToStream', function() {
      test.ok(stream.hasUser('2345'));
      test.ok(stream.hasUserInStream('2345'));
      test.ok(!stream.hasUserInQueue('2345'));

      stream.removeUser('2345', function(err) {
        if (err) throw err;

        test.ok(!stream.hasUser('2345'));
        test.ok(!stream.hasUserInStream('2345'));
        test.ok(!stream.hasUserInQueue('2345'));

        test.ok(removeUserSpy.called);
        test.done();
      });
    });

    var removeUserSpy = spy();
    stream.on('removeUser', removeUserSpy);
    stream.on('removeUser', function(twitterID) {
      test.equal(twitterID, '2345');
    });
  },
  'that is in queue': function(test) {
    var stream = createSiteStream(['2345'], true);

    test.ok(stream.hasUser('2345'));
    test.ok(!stream.hasUserInStream('2345'));
    test.ok(stream.hasUserInQueue('2345'));

    stream.removeUser('2345', function(err) {
      if (err) throw err;

      test.ok(!stream.hasUser('2345'));
      test.ok(!stream.hasUserInStream('2345'));
      test.ok(!stream.hasUserInQueue('2345'));

      test.ok(removeUserSpy.called);
      test.done();
    });

    var removeUserSpy = spy();
    stream.on('removeUser', removeUserSpy);
    stream.on('removeUser', function(twitterID) {
      test.equal(twitterID, '2345');
    });
  },
  'that is not in stream or in queue': function(test) {
    var stream = createSiteStream(null, true);

    test.ok(!stream.hasUser('2345'));
    test.ok(!stream.hasUserInStream('2345'));
    test.ok(!stream.hasUserInQueue('2345'));

    test.throws(function() {
      stream.removeUser('2345');
    }, /User \d+ is not in stream/);
    test.done();
  }
};


exports['user access is revoked after being added'] = function(test) {
  var stream = createSiteStream(['2345']);

  stream.info = function(callback) {
    process.nextTick(callback.bind(null, null, {
      info: { users: [{ id: '2345', name: 'jess' }] }
    }));
  };

  stream.on('addUsersToStream', function(users) {
    test.ok(stream.hasUser('2345'));
    test.ok(stream.hasUserInStream('2345'));
    test.ok(!stream.hasUserInQueue('2345'));

    test.equal(users.length, 1);
    test.equal(users[0], '2345');

    process.nextTick(stream.emit.bind(stream, 'token revoked', '2345'));
  });

  stream.on('removeUser', function(twitterID) {
    test.ok(!stream.hasUser('2345'));
    test.ok(!stream.hasUserInStream('2345'));
    test.ok(!stream.hasUserInQueue('2345'));

    test.equal(twitterID, '2345');
    test.done();
  });
};


exports['get site stream info'] = function(test) {
  var stream = createSiteStream(null, true);
  stream.info(test.done);
};
