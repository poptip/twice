var inherits  = require('util').inherits;
var Stream    = require('stream');
var _         = require('underscore');
var JStream   = require('jstream');
var ondata    = require('./ondata');
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
  if (this.paused) return;
  var self = this;

  if (reconnect) {
    this.emit('reconnect');
  }

  this.emit('beforeConnect');

  function onRequestTimeout() {
    self.emit('timeout');
    self.eeconnect('linear');
  }

  var requestTimeout = setTimeout(onRequestTimeout, constants.TIMEOUT);

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
      delete self._stream;
      self.connected = false;
    }

    self._cleanup = cleanup;

    stream.on('error', onResponseError);
    stream.on('end', onResponseEnd);
    stream.on('close', onResponseClose);

    clearTimeout(requestTimeout);
    self._req.removeListener('error', onRequestError);
    delete self._req;
  }
  
  function onRequestError(err) {
    clearTimeout(requestTimeout);
    self._req.removeListener('response', onResponse);
    self.reconnect('linear');
    self.emit('error', err);
  }

  this._client.streamRequest(this.resourceUrl, this.params, function(req) {
    self._req = req;
    req.once('response', onResponse);
    req.once('error', onRequestError);

    // make sure the stream does not time out
    // in case it does, destroy it so that `end` is emitted
    req.setTimeout(constants.TIMEOUT, function onTimeout() {
      if (self.isReconnecting()) return;
      if (self._cleanup) {
        self._cleanup();
      }

      self.emit('timeout');
      if (self._stream) {
        self._stream.destroy();
      }
      self.reconnect('linear');
    });
  });

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
  return !!this._retying[method];
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
  if (this._stream) {
    this._cleanup();
    this._stream.destroy();
    delete this._stream;
    delete this._cleanup;
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
