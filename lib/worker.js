var utils     = require('./utils');
var constants = require('./constants');


/**
 * Worker for the queue.
 *
 * @param {Stweam} client
 * @param {EventEmitter} ee Used to signal events when request and response
 *   objects are ready.
 * @param {String} method Either get or post.
 * @param {Object|String} options Passed as first argument when calling
 *   request module.
 * @param {!Function(Error, ClientResponse, Buffer|string)} callback
 *   For the request call.
 * @param {Function} queueCallback This has to eventually be called for the
 *   queue to consider the current task finished and move onto the next one.
 */
function worker(client, ee, method, options, callback, queueCallback) {

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
        err = Error(data.errors[0].message);
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

    var onRequestError = function onRequestError(err) {
      req.removeListener('request', onRequest);
      req.removeListener('response', onResponse);
      err.options = options;
      ee.emit('requestError', err);
      queueCallback(null);
    };
    
    var onRequest = function onRequest(req) {
      ee.emit('request', req);
      req.once('socket', function onSocket(socket) {
        socket.emit('agentRemove');
      });
    };

    // When the response object is retrieved, or there is an error,
    // free up a space in the queue for the next task
    var onResponse = function onResponse(res) {
      req.removeListener('error', onRequestError);
      queueCallback(null);
      if (res.statusCode !== 200) {
        var err = utils.createStatusCodeError(res.statusCode);
        err.options = options;
        ee.emit('responseError', err);
        return;
      }

      ee.emit('response', res);
    };

    req.once('error', onRequestError);
    req.once('request', onRequest);
    req.once('response', onResponse);
  }
}


module.exports = worker;
