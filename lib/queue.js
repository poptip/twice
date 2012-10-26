var TimeQueue = require('timequeue');
var utils     = require('./utils');
var constants = require('./constants');


/**
 * A queue for requests to Twitter to avoid being rate limited.
 * This is shared across all Stweam instances.
 */
module.exports = new TimeQueue(worker, {
  concurrency: 1
, every: Math.floor(1000 / constants.MAX_REQUESTS_PER_SECOND)
, timeout: constants.TIMEOUT
});


/**
 * Worker for the queue.
 *
 * @param (Stweam) client
 * @param (Streamify) stream Substitue stream that was used instead of actual
 *   request object until it becomes available.
 * @param (string) method Either get or post.
 * @param (Object|string) options Passed as first argument when calling
 *   request module.
 * @param (!Function(Error, ClientResponse, Buffer|string)) callback
 *   For the request call.
 * @param (Function) queueCallback This has to eventually be called for the
 *   queue to consider the current task finished and move onto the next one.
 */
function worker(client, stream, method, options, callback, queueCallback) {

  // call the original function from the client
  var req;
  if (typeof callback === 'function') {
    if (typeof options !== 'object') {
      options = { url: options };
    }
    options.json = true;

    req = client._request[method](options, function onEnd(err, res, data) {
      process.nextTick(queueCallback.bind(null, null));

      if (err) {
        err.url = options.url;
        return callback(err);
      }
      if (res.statusCode !== 200) {
        err = utils.createStatusCodeError(res.statusCode);
        err.url = options.url;
        return callback(err);
      }
      if (data.errors) {
        err = new Error(data.errors[0].message);
        err.url = options.url;
        err.data = data;
        return callback(err);
      }

      callback(null, data);
    });

  } else {
    // if request is not called with a callback,
    // it is likely that this request will be streamed
    req = client._request[method](options);

    // when the response object is retrieved, or there is an error,
    // free up a space in the queue for the next task
    req.once('response', queueCallback.bind(null, null));
    req.once('error', queueCallback.bind(null, null));
  }

  stream.resolve(req);
}
