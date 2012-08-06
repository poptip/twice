/**
 * stream.js
 *
 * Provides a streaming interface to use with user and site streams.
 * Reconnects with an exponential timeout on error/end/destroy events.
 *
 */
var EventEmitter = require('events').EventEmitter
  , util = require('util')
  ;


/**
 * @constructor
 * @extends (EventEmitter)
 * @param (TwitterClient) client
 * @param (string) method
 * @param (Object) params
 */
var TwitterStream = module.exports = function(client, method, params) {
  EventEmitter.call(this);
  this.client = client;
  this.method = method;
  this.params = params;
  this.retryFunctions = {};

  var self = this;
  self.on('connect', function() {
    // ignore first received data event which will include a specific
    // `data` event for this stream
    self.stream.once('data', function(data) {
      process.nextTick(function() {
        self.emit('first', data);
      });

      self.stream.on('data', function(data) {
        process.nextTick(function() {
          self.emit('data', data);
        });
      });
    });
  });

  process.nextTick(function() {
    self.connect();
  });
}

util.inherits(TwitterStream, EventEmitter);


/**
 * Connects the stream.
 *
 * @param (boolean) reconnect
 */
TwitterStream.prototype.connect = function(reconnect) {
  var self = this;

  if (reconnect) {
    this.emit('reconnect');
  }

  this.emit('beforeConnect');
  this.client.stream(this.method, this.params, function(stream) {
    self.stream = stream;
    self.emit('connect');
    self.destroy = stream.destroy.bind(stream);

    stream.on('error', function(err, statusCode) {
      self.emit('error', err, { statusCode: statusCode });
      self.retry(500, 'connect', true);
    });

    stream.on('end', function() {
      self.emit('disconnect');
      self.retry(100, 'connect', true);
    });

    stream.on('destroy', function() {
      self.emit('destroy');
    });
  });
};


/**
 * A simple interface for retrying events exponentially backing off.
 *
 * @param (number) ms
 * @param (string) fn
 * @param (!Object) arg
 */
TwitterStream.prototype.retry = function(ms, fn, arg) {
  var self = this;
  var obj = self.retryFunctions[fn];

  if (!obj) {
    obj = self.retryFunctions[fn] = { attempt: 1, retries: 1 };
  }

  // exponentially increase the timeout time each time there is
  // a problem reconnecting
  var realms = ms * ~~(Math.LN2 * Math.pow(2, obj.attempt));
  self.emit('retry', fn, realms, obj.attempt, obj.retries);
  obj.attempt++;

  clearTimeout(obj.tid1);
  clearTimeout(obj.tid2);

  obj.tid1 = setTimeout(function() {
    self[fn].call(self, arg);

    // set timeout to reset the `reconnectAttempt` counter if the stream
    // was able to reconnect without issues
    obj.tid2 = setTimeout(function() {
      obj.attempt = 1;
      obj.retries++;
    }, Math.max(30000, ms * 2));
  }, realms);
};


/**
 * Called when `data` event is emitted.
 *
 * @param (Object) data
 */
TwitterStream.onData = function(data) {

  var for_user = data.for_user;
  var data = data.message || data;

  if (data.text) {

    if (data.user.screen_name.toLowerCase() == "poptip_results") {
      return;
    }

    this.emit('tweet', data);

    // The user has retweeted using the actual "Retweet" button, not RT
    if (data.retweeted_status) {
      this.emit('tweet:retweet', data);
      this.emit('tweet:retweet:' + data.retweeted_status.id_str, data); 

    // The use has replied directly to the poll
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
  } else if (data.friends) {
    this.emit('friends', data);
    if (for_user) {
      this.emit('friends:' + for_user, data.friends);
    }

  } else if (data.event) {
    this.emit(data.event, data.source, data.target);
    if (for_user) {
      this.emit(data.event + ':' + for_user, data.source, data.target);
    }
  }
};
