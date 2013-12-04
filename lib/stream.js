var inherits  = require('util').inherits;
var Stream    = require('stream');
var _         = require('underscore');
var JStream   = require('jstream');
var ondata    = require('./ondata');
var constants = require('./constants');


/**
 * @constructor
 * @extends {Stream}
 * @param {TwitterClient} client
 * @param {String} method
 * @param {Object} params
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
 * Init variables.
 */
TwitterStream.prototype.readable = true;
TwitterStream.prototype.writable = false;
TwitterStream.prototype.connected = false;
TwitterStream.prototype.paused = false;


/*
 * Connects the stream.
 *
 * @param {Boolean} reconnect
 */
TwitterStream.prototype.connect = function(reconnect) {
  if (this.paused) return;
  if (this.connected) throw Error('stream is already connected');
  var self = this;

  if (reconnect) {
    this.emit('beforeReconnect');
  }

  this.emit('beforeConnect');

  function onResponse(stream) {
    // Clean up request.
    ee.removeListener('requestError', onRequestError);
    ee.removeListener('responseError', onResponseError);
    delete self._req;

    // Parse JSON with JStream.
    var jstream = new JStream();

    // Listen for other errorneous events.
    function onError(err) {
      self.reconnect('exponential');
      cleanup();
      self.emit('error', err);
    }

    function onResponseEnd() {
      self.reconnect('exponential');
      cleanup();
      self.emit('end');
    }

    function onResponseClose() {
      self.reconnect('exponential');
      cleanup();
      self.emit('end');
    }

    // Keep track of the last time a `data` event occurred to make sure
    // the stream does not time out.
    function onStreamTimeout() {
      cleanup();
      self.reconnect('linear');
      self.emit('timeout');
    }

    function onData(data) {
      self._ondata(data);
      clearTimeout(timeout);
      timeout = setTimeout(onStreamTimeout, constants.STREAM_TIMEOUT);
    }

    var timeout = setTimeout(onStreamTimeout, constants.STREAM_TIMEOUT);
    jstream.on('data', onData);

    // Clean up everything after this stream is not used anymore.
    function cleanup() {
      self.connected = false;
      stream.removeListener('error', onError);
      stream.removeListener('end', onResponseEnd);
      stream.removeListener('close', onResponseClose);
      stream.removeListener('data', onData);
      stream.destroy();
      jstream.removeListener('error', onError);
      clearTimeout(timeout);
      delete self._stream;
      delete self._cleanup;
    }

    self._cleanup = cleanup;

    stream.on('end', onResponseEnd);
    stream.on('close', onResponseClose);
    stream.pipe(jstream);
    stream.on('error', onError);
    jstream.on('error', onError);

    // Label as connected.
    self._stream = stream;
    self.connected = true;
    self.emit('connect');

  }

  function onRequestError(err) {
    ee.removeListener('request', onRequest);
    ee.removeListener('responseError', onResponseError);
    ee.removeListener('response', onResponse);
    self.reconnect('linear');
    self.emit('error', err);
    if (err.code === 'ESOCKETTIMEDOUT') {
      self.emit('timeout');
    }
  }

  function onResponseError(err) {
    ee.removeListener('requestError', onRequestError);
    ee.removeListener('response', onResponse);
    self.reconnect('exponential');
    self.emit('error', err);
  }

  function onRequest(req) {
    self._req = req;
  }

  var ee = this._client.post(this.resourceUrl, this.params);
  ee.once('requestError', onRequestError);
  ee.once('request', onRequest);
  ee.once('responseError', onResponseError);
  ee.once('response', onResponse);
};


/**
 * Returns true if the stream is waiting for a timeout to reconnect.
 *
 * @return {Boolean}
 */
TwitterStream.prototype.isReconnecting = function() {
  return this.isRetrying('connect');
};


/**
 * Returns true if the given method is waiting for a timeout to retry.
 *
 * @param {String} method
 * @return {Boolean}
 */
TwitterStream.prototype.isRetrying = function(method) {
  return !!this._retrying[method];
};


/**
 * A simple interface for retrying events exponentially backing off.
 *
 * @param {String} algorithm Either `linear` or `exponential`.
 * @param {String} method
 * @param {!Object} arg1
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
    throw Error('Algorithm `' + algorithm + '` not supported.');
  }

  if (!obj) {
    obj = self._retryFunctions[key] = { value: start, attempt: 1, retries: 1 };

  } else if (obj.attempt > 1) {
    if (obj.value < max) {
      // Increase the timeout by the given algorithm.
      switch (algorithm) {
        case 'linear':
          obj.value += start;
          break;

        case 'exponential':
          obj.value *= 2;
          break;
      }

    } else {
      // If `max` value has been reached, emit an event as a warning.
      self.emit('retryMax', algorithm, method);

    }
  }

  self.emit('retry', algorithm, method, obj.value, obj.attempt, obj.retries);
  obj.attempt++;

  clearTimeout(obj.tid1);
  clearTimeout(obj.tid2);

  obj.tid1 = setTimeout(function() {
    self[method].call(self, arg1);

    // Set timeout to reset the `retry` counter if the stream
    // was able to call the method without issues.
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
 * @param {String} algorithm Either `linear` or `exponential`.
 */
TwitterStream.prototype.reconnect = function(algorithm) {
  this.retry(algorithm || 'linear', 'connect', true);
};


/**
 * Destroy the stream.
 */
TwitterStream.prototype.destroy = function() {
  this.readable = false;

  if (this._stream) {
    // If stream has connected, clean all those listeners up.
    this._cleanup();
  } else if (this._req) {
    // If a request is in progress, cancel it.
    this._req.abort();
  }

  // Get rid of possible timeouts from the retry method.
  var self = this;
  Object.keys(self._retryFunctions).forEach(function(key) {
    var obj = self._retryFunctions[key];
    clearTimeout(obj.tid1);
    clearTimeout(obj.tid2);
  });

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


/**
 * Create methods for adding/removing parameters.
 *
 * @param {String} name
 */
TwitterStream.prototype._createParamMethods = function(name) {
  var self = this;
  var hash = {};
  if (this.params[name]) {
    this.params[name].split(',').forEach(function(phrase) {
      hash[phrase] = true;
    });
  }

  function add(value) {
    if (hash[value]) {
      throw Error('Already ' + name + 'ing ' + value);
    } else {
      hash[value] = true;
      self.params[name] = Object.keys(hash).join(',');
    }
  }

  function remove(value) {
    if (!hash[value]) {
      throw Error('Not ' + name + 'ing ' + value);
    } else {
      delete hash[value];
      self.params[name] = Object.keys(hash).join(',');
    }
  }

  this[name] = function(value) {
    if (!Array.isArray(value)) {
      value = [value];
    }

    for (var i = 0, l = value.length; i < l; i++) {
      add(value[i]);
    }

    if (self.connected) {
      self.reconnect();
    }
  };

  this['un' + name] = function(value) {
    if (!Array.isArray(value)) {
      value = [value];
    }

    for (var i = 0, l = value.length; i < l; i++) {
      remove(value[i]);
    }

    if (self.connected) {
      self.reconnect();
    }
  };
};


/**
 * @param {Object} data
 */
TwitterStream.prototype._ondata = function(data) {
  ondata.call(this, data);
};
