var inherits  = require('util').inherits;
var Stream    = require('stream');
var _         = require('underscore');
var JStream   = require('jstream');
var errors    = require('./errors');
var constants = require('./constants');


/**
 * @constructor
 * @extends (Stream)
 * @param (TwitterClient) client
 * @param (string) method
 * @param (Object) params
 */
var TwitterStream = module.exports = function(client, resourceUrl, params) {
  Stream.call(this);
  this.readable = true;
  this.writable = false;
  this._client = client;
  this.resourceUrl = resourceUrl;
  this.params = params ? _.clone(params) : {};
  this.params.stall_warnings = true;
  this._retryFunctions = {};
  this.connected = false;
  this.paused = false;

  var self = this;
  process.nextTick(function() {
    self.connect();
  });
};

inherits(TwitterStream, Stream);


/*
 * Connects the stream.
 *
 * @param (boolean) reconnect
 */
TwitterStream.prototype.connect = function(reconnect) {
  if (this.paused) return;
  var self = this;

  if (reconnect) {
    this.emit('reconnect');
  }

  this.emit('beforeConnect');

  function onResponse(stream) {
    if (stream.statusCode !== 200) {
      var error = errors[stream.statusCode];
      var err;

      if (error) {
        err = new Error(error.type + ' - ' + error.message);
        err.type = error.type;
      } else {
        err = new Error('There was an unknown error creating the stream');
        err.type = 'http';
      }
      err.statusCode = stream.statusCode;
      self.emit('error', err);
      self.reconnect('exponential');
      return;
    }

    self._stream = stream;
    self.connected = true;
    self.emit('connect');

    // pipe to JStream to parse JSON
    var jstream = new JStream();
    stream.pipe(jstream);
    jstream.on('data', TwitterStream.onData.bind(self));
    jstream.on('error', onResponseError);

    // listen for other errorneous events
    function onResponseError(err) {
      self.reconnect('exponential');
      cleanup();
      self.emit('error', err);
    }

    function onResponseEnd() {
      if (self.connected) {
        self.reconnect('exponential');
      }
      cleanup();
      self.emit('disconnect');
    }

    function onResponseClose() {
      if (self.connected) {
        self.reconnect('exponential');
      }
      cleanup();
    }

    function cleanup() {
      stream.removeListener('error', onResponseError);
      stream.removeListener('end', onResponseEnd);
      stream.removeListener('close', onResponseClose);
      stream.removeListener('data', resetTimeout);
      clearTimeout(tid);
      self.connected = false;
    }

    self._cleanup = cleanup;

    // make sure the stream does not time out
    // in case it does, destroy it so that `end` is emitted
    function destroyStream() {
      cleanup();
      self.emit('timeout');
      stream.destroy();
      self.reconnect('linear');
    }

    var tid = setTimeout(destroyStream, constants.TIMEOUT);
    function resetTimeout() {
      clearTimeout(tid);
      tid = setTimeout(destroyStream, constants.TIMEOUT);
    }


    stream.on('error', onResponseError);
    stream.on('end', onResponseEnd);
    stream.on('close', onResponseClose);
    stream.on('data', resetTimeout);
  }
  
  function onRequestError(err) {
    self.reconnect('linear');
    self.emit('error', err);
  }

  this._client.streamRequest(this.resourceUrl, this.params,
                             onResponse, onRequestError);
};


/**
 * A simple interface for retrying events exponentially backing off.
 *
 * @param (string) algorithm Either `linear` or `exponential`.
 * @param (string) method
 * @param (!Object) arg1
 */
TwitterStream.prototype.retry = function(algorithm, method, arg1) {
  var self = this;
  var key = method + ':' + algorithm;
  var obj = self._retryFunctions[key];

  var start, max;
  var alg = constants.ALGORITHMS[algorithm.toUpperCase()];
  if (alg) {
    start = alg.START;
    max = alg.MAX;

  } else {
    throw new Error('Algorithm `' + algorithm + '` not supported.');
  }

  if (!obj) {
    obj = self._retryFunctions[key] = { value: start, attempt: 1, retries: 1 };

  } else if (obj.attempt > 1 && obj.value < max) {
    // increase the timeout by the algorithm
    switch (algorithm) {
      case 'linear':
        obj.value += obj.value;
        break;

      case 'exponential':
        obj.value *= 2;
        break;
    }

  } else {
    // if `max` value has been reached, emit an event
    self.emit('retryMax', algorithm, method);

  }

  self.emit('retry', algorithm, method, obj.value, obj.attempt, obj.retries);
  obj.attempt++;

  clearTimeout(obj.tid1);
  clearTimeout(obj.tid2);

  obj.tid1 = setTimeout(function() {
    self[method].call(self, arg1);

    // set timeout to reset the `retry` counter if the stream
    // was able to call the method without issues
    obj.tid2 = setTimeout(function() {
      obj.value = start;
      obj.attempt = 1;
      obj.retries++;
    }, 30000);
  }, obj.value);
};


/**
 * Called when the stream attempts to reconnect.
 *
 * @param (string) algorithm Either `linear` or `exponential`.
 */
TwitterStream.prototype.reconnect = function(algorithm) {
  this.retry(algorithm, 'connect', true);
};


/**
 * Destroy the stream.
 */
TwitterStream.prototype.destroy = function() {
  if (this._stream) {
    this._cleanup();
    this._stream.destroy();
    delete this._stream;
    delete this._cleanup;
  }
  this.emit('destroy');
};


/**
 * Pause the stream.
 */
TwitterStream.prototype.pause = function() {
  if (this.paused) return;
  this.paused = true;
  if (this.connected) {
    this._stream.pause();
  }
};


/**
 * Resume the stream if it's paused.
 */
TwitterStream.prototype.resume = function() {
  if (!this.paused) return;
  this.paused = false;
  if (this.connected) {
    this._stream.resume();
  } else {
    this.connect();
  }
};


/**
 * @param (string) event
 * @param (Array.Object) args
 * @param (string?) for_user
 */
TwitterStream.prototype._emit = function(event, args, for_user) {
  this.emit.apply(this, ['emit', event].concat(args));
  if (for_user) {
    args.unshift(for_user);
    this.emit.apply(this, ['emit', event, for_user].concat(args));
    this.emit.apply(this, ['emit', event + ':' + for_user].concat(args));
  }
};


/**
 * Twitter will emit several types of messages.
 */
var STREAM_MESSAGES = [
  { event: 'warning', args: ['code', 'message', 'percent_full'] }
, { event: 'control', args: ['control_uri'] }
, { event: 'delete', args: ['id_str', 'user_id_str'] }
, { event: 'scrub_geo', args: ['user_id_str', 'up_to_status_id_str'] }
, { event: 'limit', args: ['trac'] }
, { event: 'status_withheld', args: ['id_str', 'user_id_str', 'withheld_in_countries'] }
, { event: 'user_withheld', args: ['id_str', 'withheld_in_countries'] }
, { event: 'friends', args: null }
];


/**
 * Called when `data` event is emitted from the stream.
 *
 * @param (Object) data
 */
TwitterStream.onData = function(data) {
  var for_user, obj, i, len, i2, len2, message, args;

  this.emit('data', data);

  if (data.for_user && data.message) {
    for_user = data.for_user;
    data = data.message;
  }


  for (i = 0, len = STREAM_MESSAGES.length; i < len; i++) {
    message = STREAM_MESSAGES[i];
    if (obj = data[message.event]) {
      args = [];
      if (message.args) {
        for (i2 = 0, len2 = message.args.length; i2 < len2; i2++) {
          args.push(obj[message.args[i2]]);
        }
      } else{
        args.push(obj);
      }

      this._emit(message.name, args, for_user);
      return;
    }
  }

  if (data.event) {
    args = [];
    if (data.source && data.target &&
        data.source.id_str !== data.target.id_str) {
      args.push(data.source);
      args.push(data.target);
    } else if (data.event === 'user_updated') {
      args.push(data.source);
    }

    if (data.target_object) {
      args.push(data.target_object);
    }
    args.push(new Date(data.created_at));

    this._emit(data.event, args, for_user);
    return;
  }

  if (data.text) {
    this.emit('tweet', data);

    // The user has retweeted using the actual "Retweet" button, not RT
    if (data.retweeted_status) {
      this.emit('tweet:retweet', data);
      this.emit('tweet:retweet:' + data.retweeted_status.id_str, data);

    // The user has replied directly to a tweet
    } else if (data.in_reply_to_status_id_str) {
      this.emit('tweet:reply', data);
      this.emit('tweet:reply:' + data.in_reply_to_status_id_str, data);

    // The user has replied to some other tweet of the poll creator.
    } else if (data.in_reply_to_screen_name) {
      this.emit('tweet:@reply', data);
      this.emit('tweet:@reply:' + data.in_reply_to_screen_name, data);

    // The tweet isn't a reply to the creator, but still @mentions the creator
    } else if (data.entities.user_mentions) {
      var self = this;

      data.entities.user_mentions.forEach(function(user) {
        self.emit('tweet:@reply', data);
        self.emit('tweet:@reply:' + user.screen_name, data);
      });
    }
    return;
  }

  // in case we run across something not recognized yet or newly added
  var err = new Error('Unknown message type.');
  err.data = data;
  this.emit('error', err);
};
