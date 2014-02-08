var errors = require('./errors');


/**
 * Creates a useful errors whenever a response has a status code other than 200.
 *
 * @param {Number} statusCode
 * @return {Error}
 */
exports.createStatusCodeError = function(statusCode) {
  var error = errors[statusCode];
  var err;

  if (error) {
    err = new Error(error.type + ' - ' + error.message);
    err.statusCode = statusCode;
    err.type = error.type;
  } else {
    err = new Error('There was an unknown error.');
    err.statusCode = statusCode;
    err.type = 'http';
  }

  err.statusCode = statusCode;
  return err;
};


/**
 * Adds values from a parameter into a hash when stream is created.
 *
 * @param {TwitterStream} stream
 * @param {String} param
 */
exports.initParamMethods = function(stream, param) {
  var key = '_' + param + 'Hash';
  var count = param + 'Count';
  var list = param + 'List';
  stream[count] = 0;
  stream[list] = [];
  var hash = stream[key] = {};
  if (stream.params[param]) {
    var values = stream[list] = stream.params[param]
      .split(',')
      .filter(function(phrase) {
        if (phrase) {
          hash[phrase] = true;
          return true;
        } else {
          return false;
        }
      });
    stream[count] = values.length;
  }
};


/**
 * Create methods for adding/removing parameters.
 *
 * @param {TwitterStream} Stream
 * @param {String} param
 */
exports.createParamMethods = function(Stream, param) {
  var key = '_' + param + 'Hash';
  var has = param + 'ing';
  var count = param + 'Count';
  var list = param + 'List';
  var add = param;
  var remove = 'un' + param;


  /**
   * Returns true if value is already in the list of parameters.
   *
   * @param {String} value
   * @return {Boolean}
   */
  Stream.prototype[has] = function(value) {
    return Object.prototype.hasOwnProperty.call(this[key], value);
  };


  /**
   * Adds value to parameter. Will reconnect.
   *
   * @param {String} value
   */
  Stream.prototype[add] = function(values) {
    if (!Array.isArray(values)) {
      values = [values];
    }

    var hash = this[key];
    for (var i = 0, len = values.length; i < len; i++) {
      var value = values[i];
      if (this[has](value)) {
        throw new Error('Already ' + param + 'ing ' + value);
      } else {
        hash[value] = true;
      }
    }
    this[count] += len;
    var params = Object.keys(hash).sort();
    this.params[param] = params.join(',');
    this[list] = params;

    if (this.connected) {
      this.reconnect();
    }
  };


  /**
   * Removes value from parameter. Will reconnect.
   *
   * @param {String} value
   */
  Stream.prototype[remove] = function(values) {
    if (!Array.isArray(values)) {
      values = [values];
    }

    var hash = this[key];
    for (var i = 0, len = values.length; i < len; i++) {
      var value = values[i];
      if (!this[has](value)) {
        throw new Error('Not ' + param + 'ing ' + value);
      } else {
        delete hash[value];
      }
    }
    this[count] -= len;
    var params = Object.keys(hash).sort();
    this.params[param] = params.join(',');
    this[list] = params;

    if (this.connected) {
      this.reconnect();
    }
  };
};
