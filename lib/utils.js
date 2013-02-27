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
