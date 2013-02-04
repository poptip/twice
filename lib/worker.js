var utils     = require('./utils');
var constants = require('./constants');


/**
 * Worker for the queue.
 *
 * @param {Stweam} client
 * @param {Streamify} stream Substitue stream that was used instead of actual
 *   request object until it becomes available.
 * @param {String} method Either get or post.
 * @param {Object|String} options Passed as first argument when calling
 *   request module.
 * @param {!Function(Error, ClientResponse, Buffer|string)} callback
 *   For the request call.
 * @param {Function} queueCallback This has to eventually be called for the
 *   queue to consider the current task finished and move onto the next one.
 */
function worker(client, stream, method, options, callback, queueCallback) {

  // Call the original function from the client.
  var req;
  if (typeof callback === 'function') {
    var url = options.url || options;
    if (method === 'get' || ~~url.indexOf(constants.SITE_STREAM.HOST)) {
      if (typeof options !== 'object') {
        options = { url: options };
      }

      options.json = true;
    }
    options.timeout = constants.REQUEST_TIMEOUT;

    req = client._request[method](options, function onEnd(err, res, data) {
      process.nextTick(queueCallback.bind(null, null));

      if (err) {
        err.options = options;
        return callback(err);
      }
      if (res.statusCode !== 200) {
        err = utils.createStatusCodeError(res.statusCode);
        err.options = options;
        err.data = data;
        return callback(err);
      }
      if (data.errors) {
        err = new Error(data.errors[0].message);
        err.options = options;
        err.data = data;
        return callback(err);
      }

      callback(null, data);
    });

  } else {
    // If request is not called with a callback,
    // it is likely that this request will be streamed.
    options.timeout = constants.STREAM_TIMEOUT;
    req = client._request[method](options);

    // When the response object is retrieved, or there is an error,
    // free up a space in the queue for the next task
    var onResponse = function onResponse(res) {
      req.removeListener('error', onError);
      if (res.statusCode !== 200) {
        var err = utils.createStatusCodeError(res.statusCode);
        err.options = options;
        req.emit('error', err);
      }
      queueCallback(null);
    };

    var onError = function onError(err) {
      req.removeListener('response', onResponse);
      err.options = options;
      queueCallback(null);
    };

    req.once('response', onResponse);
    req.once('error', onError);
  }

  stream.resolve(req);
}


module.exports = worker;
