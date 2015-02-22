var Stweam     = require('..');
var SiteStream = require('../lib/sitestream');


// Creates a mocked pool from a mocked client.
function createPool() {
  var client = new Stweam();
  client.createSiteStream = function(twitterIDs) {
    var stream = new SiteStream(client);
    stream.connected = true;
    stream.connect = function() {
    };

    stream._addUsers = function(twitterIDs) {
      process.nextTick(function() {
        stream._addTwitterIDs(twitterIDs);
      });
    };

    stream.info = function(callback) {
      process.nextTick(function() {
        callback(null, {
          info: {
            users: stream.users.map(function(twitterID) {
              return { id: twitterID, name: twitterID };
            })
          }
        });
      });
    };

    stream.addUsers(twitterIDs);

    stream.removeUser = function(twitterID, callback) {
      process.nextTick(function() {
        stream._removeUser(twitterID);
        if (callback) {
          callback(null);
        }
      });
    };

    return stream;
  };

  return client.createPool();
}


exports['add users'] = {
  'less than maximum per stream': function(test) {
    var pool = createPool();

    test.ok(!pool.hasUser('42'));
    test.ok(!pool.hasUserInQueue('42'));
    test.ok(!pool.hasUserInStream('42'));
    test.equal(pool.users.length, 0);
    test.equal(pool.usersInQueue.length, 0);
    test.equal(pool.usersInStream.length, 0);
    test.equal(pool.failedToAddUsers.length, 0);

    pool.addUser('42');

    test.ok(pool.hasUser('42'));
    test.ok(pool.hasUserInQueue('42'));
    test.ok(!pool.hasUserInStream('42'));
    test.equal(pool.users.length, 1);
    test.equal(pool.usersInQueue.length, 1);
    test.equal(pool.usersInStream.length, 0);
    test.equal(pool.failedToAddUsers.length, 0);

    pool.on('addUsersToStream', function(twitterIDs) {
      test.ok(pool.hasUser('42'));
      test.ok(!pool.hasUserInQueue('42'));
      test.ok(pool.hasUserInStream('42'));
      test.equal(pool.users.length, 1);
      test.equal(pool.usersInQueue.length, 0);
      test.equal(pool.usersInStream.length, 1);
      test.equal(pool.failedToAddUsers.length, 0);

      test.equal(twitterIDs.length, 1);
      test.equal(twitterIDs[0], '42');
      test.equal(pool.streams.length, 1);

      test.done();
    });
  },
  'more than maximum per stream': function(test) {
    var users = [];
    var times = 2;
    for (var i = 0, l = SiteStream.MAX_USERS * times; i < l; i++) {
      users[i] = (~~(Math.random() * 1e9)).toString();
    }

    var pool = createPool();
    pool.addUsers(users);

    var total = 0;
    pool.on('addUsersToStream', function(twitterIDs) {
      total += twitterIDs.length;
      if (total === users.length) {
        test.equal(pool.streams.length, times);
        test.equal(pool.users.length, users.length);
        test.equal(pool.usersInQueue.length, 0);
        test.equal(pool.usersInStream.length, users.length);
        test.equal(pool.failedToAddUsers.length, 0);

        test.done();
      }
    });
  },
  'after a site stream has been created': function(test) {
    var pool = createPool();
    pool.addUser('42');

    pool.once('addUsersToStream', function() {
      test.equal(pool.users.length, 1);
      test.equal(pool.usersInQueue.length, 0);
      test.equal(pool.usersInStream.length, 1);
      test.equal(pool.failedToAddUsers.length, 0);

      test.equal(pool.streams.length, 1);

      pool.addUsers(['23', '32', '42']);

      test.equal(pool.users.length, 3);
      test.equal(pool.usersInQueue.length, 2);
      test.equal(pool.usersInStream.length, 1);
      test.equal(pool.failedToAddUsers.length, 0);

      pool.once('addUsersToStream', function(twitterIDs) {
        test.equal(pool.users.length, 3);
        test.equal(pool.usersInQueue.length, 0);
        test.equal(pool.usersInStream.length, 3);
        test.equal(pool.failedToAddUsers.length, 0);

        test.equal(pool.streams.length, 1);
        test.equal(twitterIDs.length, 2);

        test.done();
      });
    });
  }
};


exports['remove user'] = {
  'after adding them to the queue': function(test) {
    var pool = createPool();

    test.ok(!pool.hasUser('2'));
    test.ok(!pool.hasUserInQueue('2'));
    test.ok(!pool.hasUserInStream('2'));

    pool.addUser('2');

    test.ok(pool.hasUser('2'));
    test.ok(pool.hasUserInQueue('2'));
    test.ok(!pool.hasUserInStream('2'));

    pool.removeUser('2');

    pool.on('removeUser', function(twitterID) {
      test.equal(twitterID, '2');

      test.ok(!pool.hasUser('2'));
      test.ok(!pool.hasUserInQueue('2'));
      test.ok(!pool.hasUserInStream('2'));

      test.done();
    });
  },
  'after adding them to the stream': function(test) {
    var pool = createPool();

    test.ok(!pool.hasUser('2'));
    test.ok(!pool.hasUserInQueue('2'));
    test.ok(!pool.hasUserInStream('2'));

    pool.addUser('2');

    test.ok(pool.hasUser('2'));
    test.ok(pool.hasUserInQueue('2'));
    test.ok(!pool.hasUserInStream('2'));

    pool.on('addUsersToStream', function() {
      test.ok(pool.hasUser('2'));
      test.ok(!pool.hasUserInQueue('2'));
      test.ok(pool.hasUserInStream('2'));

      pool.removeUser('2');

      pool.on('removeUser', function(twitterID) {
        test.equal(twitterID, '2');

        test.ok(!pool.hasUser('2'));
        test.ok(!pool.hasUserInQueue('2'));
        test.ok(!pool.hasUserInStream('2'));

        test.done();
      });
    });
  },
  'that is not in stream': function(test) {
    var pool = createPool();

    test.throws(function() {
      pool.removeUser('1');
    }, /User 1 is not in pool/);

    test.done();
  }
};


exports.simulate = {
  'without twitter ID': function(test) {
    var pool = createPool();
    pool.on('tweet', function(tweet) {
      test.equal(tweet.text, 'hello');

      test.done();
    });

    pool.simulate({ text: 'hello' });
  },
  'with twitter ID': function(test) {
    var pool = createPool();
    pool.on('tweet', function(tweet, for_user) {
      test.equal(tweet.text, 'hello');
      test.equal(for_user, '1234');

      test.done();
    });

    pool.simulate({ text: 'hello' }, '1234');
  }
};


exports['create public stream'] = function(test) {
  var pool = createPool();
  var stream = pool.createPublicStream();
  stream.connect = function() {};

  var data = {};
  pool.on('data', function(d) {
    test.equal(data, d);
    test.done();
  });

  stream.emit('data', data);
};
