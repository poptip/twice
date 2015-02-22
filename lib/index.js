var request       = require('request');
var querystring   = require('querystring');
var EventEmitter  = require('events').EventEmitter;
var TimeQueue     = require('timequeue');
var TwitterStream = require('./stream');
var PublicStream  = require('./publicstream');
var UserStream    = require('./userstream');
var SiteStream    = require('./sitestream');
var Pool          = require('./pool');
var worker        = require('./worker');
var constants     = require('./constants');
var ondata        = require('./ondata');
var clone         = require('./util').clone;
var VERSION       = require('../package.json').version;
var HEADER        = { 'user-agent': 'twice/' + VERSION };


/**
 * A queue for requests to Twitter to avoid being rate limited.
 * This is shared across all Twice instances.
 */
var queue = new TimeQueue(worker, {
  concurrency: 1,
  every: Math.floor(1000 / constants.MAX_REQUESTS_PER_SECOND)
});


/**
 * @constructor
 * @param {Object} credentials
 */
var Twice = module.exports = function Twice(credentials) {
  this._request = request.defaults({
    headers: HEADER,
    oauth: credentials,
    maxSockets: Infinity
  });
};


/**
 * GET request.
 *
 * @param {Object|String} options
 * @param {!Object} params
 * @param {!Function(Error, ClientResponse, Buffer|string)} callback
 * @return {EventEmitter}
 */
Twice.prototype.get = function(options, params, callback) {
  if (typeof params === 'function') {
    callback = params;
  } else if (params) {
    var query = '?' + querystring.stringify(params);
    if (options.url) {
      options.url += query;
    } else {
      options += query;
    }
  }
  var ee = new EventEmitter();
  queue.push(this, ee, 'get', options, callback);
  return ee;
};


/**
 * POST request.
 *
 * @param {String} url
 * @param {Object|String} body
 * @param {!Function(Error, ClientResponse, Buffer|string)} callback
 * @return {EventEmitter}
 */
Twice.prototype.post = function(url, body, callback) {
  var options = { url: url };
  if (typeof body === 'object') {
    options.form = body;
  } else {
    options.body = body || '';
  }
  var ee = new EventEmitter();
  queue.push(this, ee, 'post', options, callback);
  return ee;
};


/**
 * Create a public stream with this client's credentials.
 *
 * @param {!Object} params
 * @return {PublicStream}
 */
Twice.prototype.createPublicStream = function(params) {
  return new PublicStream(this, params);
};


/**
 * Create a sample stream with this client's credentials.
 *
 * @param {!Object} params
 * @return {TwitterStream}
 */
Twice.prototype.createSampleStream = function(params) {
  var resource = constants.SAMPLE_STREAM.RESOURCE_URL;
  return new TwitterStream(this, resource, params);
};


/**
 * Create a firehose with this client's credentials.
 *
 * @param {!Object} params
 * @return {TwitterStream}
 */
Twice.prototype.createFirehose = function(params) {
  var resource = constants.FIREHOSE.RESOURCE_URL;
  return new TwitterStream(this, resource, params);
};


/**
 * Create a user stream with this client's credentials.
 *
 * @param {!Object} params
 * @return {UserStream}
 */
Twice.prototype.createUserStream = function(params) {
  return new UserStream(this, params);
};


/**
 * Create a site stream with this client's credentials.
 *
 * @param {!Array.<String>} follow
 * @param {!Object} params
 * @return {SiteStream}
 */
Twice.prototype.createSiteStream = function(follow, params) {
  return new SiteStream(this, follow, params);
};


/**
 * Create a pool with this client's credentials.
 *
 * @param {!Object} options
 * @return {Pool}
 */
Twice.prototype.createPool = function(options) {
  return new Pool(this, options);
};


/**
 * Returns tweets from a timeline.
 *
 * @param {String} url
 * @param {!Object} params
 * @param {!Function(!Error, Array.<Object>)} callback
 * @return {EventEmitter}
 */
Twice.prototype.getTimeline = function(url, params, callback) {
  if (typeof params === 'function') {
    callback = params;
    params = {};
  } else if (!params) {
    params = {};
  }
  var ee = new EventEmitter();
  this._getTimeline(ee, url, params, [], callback);
  return ee;
};


/**
 * @param {EventEmitter} ee
 * @param {String} url
 * @param {Object} params
 * @param {Array.<Object>} results
 * @param {Function(!Error, Array.<Object>)} callback
 */
Twice.prototype._getTimeline = function(ee, url, params, results, callback) {
  var orig = clone(params);
  var count = params.count || 0;
  if (count > constants.MAX_TIMELINE_COUNT) {
    params.count = 200;
  }
  var include_rts = !!params.include_rts;
  params.include_rts = true;

  var self = this;
  this.get(url, params, function(err, tweets) {
    if (err) {
      if (callback) {
        callback(err);
      } else {
        ee.emit('error', err);
      }
      return;
    }

    var tweet;
    var rindex = results.length;
    for (var i = 0, len = tweets.length; i < len; i++) {
      tweet = tweets[i];
      if (!tweet.retweeted_status || include_rts) {
        ondata.call(ee, tweet);

        // Only buffer tweets if a `callback` was given.
        if (callback) {
          results[rindex++] = tweet;
        }
      }
    }

    if (len === constants.MAX_TIMELINE_COUNT) {
      count -= len;
      if (count > 0) {
        orig.count = count;
        orig.since_id = tweet.id_str;
        self._getTimeline(ee, url, orig, results, callback);
        return;
      }
    }

    ee.emit('end');
    if (callback) {
      callback(null, results);
    }
  });
};


/**
 * Used for adding timeline functions to Twice.
 *
 * @param {String} key
 * @param {String} resource Will be prepended with the Twitter API
 *   base URL.
 */
function addTimeline(key, resource) {
  Twice.prototype[key] = function(params, callback) {
    var url = constants.BASE + resource + '.json';
    return this.getTimeline(url, params, callback);
  };
}


var timelines = {
  MentionsTimeline: 'statuses/mentions_timeline',
  UserTimeline: 'statuses/user_timeline',
  HomeTimeline: 'statuses/home_timeline',
  RetweetsOfMe: 'statuses/retweets_of_me',
};

for (var key in timelines) {
  addTimeline('get' + key, timelines[key]);
}
