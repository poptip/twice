var inherits  = require('util').inherits;
var Stream    = require('stream');
var _         = require('underscore');
var JStream   = require('jstream');
var ondata    = require('./ondata');
var utils     = require('./utils');
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
  this._client = client;
  this.resourceUrl = resourceUrl;
  this.params = params ? _.clone(params) : {};
  this.params.stall_warnings = true;
  this._retryFunctions = {};
  this._retrying = {};

  var self = this;
  process.nextTick(function() {
    self.connect();
  });
};

inherits(TwitterStream, Stream);


/**
 * Init variables
 */
TwitterStream.prototype.readable = true;
TwitterStream.prototype.writable = false;
TwitterStream.prototype.connected = false;
TwitterStream.prototype.paused = false;


/*
 * Connects the stream.
 *
 * @param (boolean) reconnect
 */
TwitterStream.prototype.connect = function(reconnect) {
  if (this.paused) throw new Error('stream is currently paused');
  if (this.connected) throw new Error('stream is already connected');
  var self = this;

  if (reconnect) {
    this.emit('reconnect');
  }

  this.emit('beforeConnect');

  function onResponse(stream) {
    if (stream.statusCode !== 200) {
      self.emit('error', utils.createStatusCodeError(stream.statusCode));
      self.reconnect('exponential');
      return;
    }

    // pipe to JStream to parse JSON
    var jstream = new JStream();
    stream.pipe(jstream);
    jstream.on('data', ondata.bind(self));
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
      self._stream.destroy();
      delete self._stream;
      delete self._cleanup;
      self.connected = false;
    }

    self._cleanup = cleanup;

    stream.on('error', onResponseError);
    stream.on('end', onResponseEnd);
    stream.on('close', onResponseClose);

    // clean up request
    self._req.removeListener('error', onRequestError);
    delete self._req;

    // label as connected
    self._stream = stream;
    self.connected = true;
    self.emit('connect');
  }
  
  function onRequestError(err) {
    self._req.removeListener('response', onResponse);
    self.reconnect('linear');
    self.emit('error', err);
    if (err.code = 'ESOCKETTIMEDOUT') {
      self.emit('timeout');
    }
  }

  var req = self._req = this._client.post(this.resourceUrl, this.params);
  req.once('response', onResponse);
  req.once('error', onRequestError);

};


/**
 * Returns true if the stream is waiting for a timeout to reconnect.
 *
 * @return (boolean)
 */
TwitterStream.prototype.isReconnecting = function() {
  return this.isRetrying('connect');
};


/**
 * Returns true if the given method is waiting for a timeout to retry.
 *
 * @parma (string) method
 * @return (boolean)
 */
TwitterStream.prototype.isRetrying = function(method) {
  return !!this._retrying[method];
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
  self._retrying[method] = true;

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

  } else if (obj.attempt > 1) {
    if (obj.value < max) {
      // increase the timeout by the algorithm
      switch (algorithm) {
        case 'linear':
          obj.value += start;
          break;

        case 'exponential':
          obj.value *= 2;
          break;
      }

    } else {
      // if `max` value has been reached, emit an event
      self.emit('retryMax', algorithm, method);

    }
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
      self._retrying[method] = false;
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
  this.readable = false;
  if (this._stream) {
    this._cleanup();
  } else if (this._req) {
    this.req.abort();
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
  } else if (this._req) {
    this.req.abort();
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
