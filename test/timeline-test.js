var Twice     = require('..');
var MAX_COUNT = require('../lib/constants').MAX_TIMELINE_COUNT;
var spy       = require('sinon').spy;


/**
 * Returns a random ID to be used for Tweets.
 *
 * @return {String}
 */
function randomID() {
  return Math.floor(Math.random() * 1e9).toString();
}


/**
 * Creates a bunch of fake tweets
 *
 * @param {Number} amount
 * @param {Number} retweets
 * @return {Array.<Object>}
 */
function fakeTweets(amount, retweets) {
  var list = [];
  var n = 0;
  for (var i = 0; i < amount; i++) {
    var tweet = {
      id_str: randomID(),
      text: 'no shields no scope no problem!'
    };
    if (n < retweets) {
      tweet.retweeted_status = {};
      n++;
    }
    list[i] = tweet;
  }
  return list;
}


/**
 * Mocks the `get` method in a client so that it calls
 * the `callback` with the amount of tweets specified.
 *
 * @param {Twice} client
 * @param {Object} expectParams
 * @param {Number} tweets
 * @param {Number} retweets
 */
function mockGet(client, test, expectParams, tweets, retweets) {
  client.get = function(uri, params, callback) {
    test.deepEqual(params, expectParams);
    process.nextTick(function() {
      if (callback) {
        callback(null, fakeTweets(tweets, retweets));
      }
    });
  };
}


exports['use the event emitter'] = function(test) {
  var client = new Twice();
  mockGet(client, test, { include_rts: true }, 42, 0);

  var ee = client.getTimeline('timeline');
  var tweetspy = spy();
  ee.on('tweet', tweetspy);
  ee.on('end', function() {
    test.ok(tweetspy.called);
    test.equal(tweetspy.callCount, 42);
    test.done();
  });
};


exports['use a callback'] = function(test) {
  var client = new Twice();
  mockGet(client, test, { include_rts: true }, 42, 0);

  client.getTimeline('timeline', function(err, tweets) {
    test.ok(!err);
    test.equal(tweets.length, 42);
    test.done();
  });
};


exports['set include_rts to true'] = function(test) {
  var client = new Twice();
  mockGet(client, test, { include_rts: true }, 20, 10);

  var params = { include_rts: true };
  client.getTimeline('timeline', params, function(err, tweets) {
    test.ok(!err);
    test.equal(tweets.length, 20);
    var retweets = 0;
    for (var i = 0, len = tweets.length; i < len; i++) {
      if (tweets[i].retweeted_status) {
        retweets++;
      }
    }
    test.equal(retweets, 10);
    test.done();
  });
};


exports['set include_rts to false'] = function(test) {
  var client = new Twice();
  mockGet(client, test, { include_rts: true }, 20, 10);

  var params = { include_rts: false };
  client.getTimeline('timeline', params, function(err, tweets) {
    test.ok(!err);
    test.equal(tweets.length, 10);
    var retweets = 0;
    for (var i = 0, len = tweets.length; i < len; i++) {
      if (tweets[i].retweeted_status) {
        retweets++;
      }
    }
    test.equal(retweets, 0);
    test.done();
  });
};


exports['over max amount of tweets per request'] = function(test) {
  var  client = new Twice();
  mockGet(client, test, {
    include_rts: true,
    count: MAX_COUNT
  }, MAX_COUNT, 0);

  var half = ~~(MAX_COUNT / 2);
  var count = MAX_COUNT + half;
  var ee = client.getTimeline('timeline', { count: '' + count });
  var tweetspy = spy();
  ee.on('tweet', function(tweet) {
    tweetspy();
    if (tweetspy.callCount === MAX_COUNT) {
      mockGet(client, test, {
        include_rts: true,
        count: half,
        since_id: tweet.id_str
      }, half, 0);
    }
  });
  ee.on('end', function() {
    test.equal(tweetspy.callCount, count);
    test.done();
  });
};


exports['exactly max amount of tweets per request'] = function(test) {
  var  client = new Twice();
  mockGet(client, test, {
    include_rts: true,
    count: MAX_COUNT
  }, MAX_COUNT, 0);

  var ee = client.getTimeline('timeline', { count: '' + MAX_COUNT });
  var tweetspy = spy();
  ee.on('tweet', tweetspy);
  ee.on('end', function() {
    test.equal(tweetspy.callCount, MAX_COUNT);
    test.done();
  });
};
