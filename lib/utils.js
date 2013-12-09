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
    err = Error(error.type + ' - ' + error.message);
    err.type = error.type;
  } else {
    err = Error('There was an unknown error.');
    err.type = 'http';
  }

  err.statusCode = statusCode;
  return err;
};


/**
 * Adds values from a parameter into a hash when stream is created.
 *
 * @param {TwitterStream} stream
 * @param {String} name
 */
exports.initParamMethods = function(stream, name) {
  var key = '_' + name + 'Hash';
  var count = name + 'Count';
  stream[count] = 0;
  var hash = stream[key] = {};
  if (stream.params[name]) {
    var values = stream.params[name].split(',').filter(function(phrase) {
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
 * @param {String} name
 */
exports.createParamMethods = function(Stream, name) {
  var key = '_' + name + 'Hash';
  var has = name + 'ing';
  var count = name + 'Count';
  var add = name;
  var remove = 'un' + name;


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
        throw Error('Already ' + name + 'ing ' + value);
      } else {
        hash[value] = true;
      }
    }
    this[count] += len;
    this.params[name] = Object.keys(hash).join(',');

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
        throw Error('Not ' + name + 'ing ' + value);
      } else {
        delete hash[value];
      }
    }
    this[count] -= len;
    this.params[name] = Object.keys(hash).join(',');

    if (this.connected) {
      this.reconnect();
    }
  };
};
