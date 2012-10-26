var errors = require('./errors');


/**
 * Creates a useful errors whenever a response has a status code other than 200.
 *
 * @param (number) statusCode
 * @return (Error)
 */
exports.createStatusCodeError = function(statusCode) {
  var error = errors[statusCode];
  var err;

  if (error) {
    err = new Error(error.type + ' - ' + error.message);
    err.type = error.type;
  } else {
    err = new Error('There was an unknown error creating the stream');
    err.type = 'http';
  }

  err.statusCode = statusCode;
  return err;
};
