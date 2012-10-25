var request       = require('request');
var streamify     = require('streamify');
var TimeQueue     = require('timequeue');
var TwitterStream = require('./stream');
var constants     = require('./constants');


/**
 * @constructor
 * @param (Object) credentials
 */
var Stweam = module.exports = function Stweam(credentials) {
  this.request = request.defaults({
    oauth: credentials,
    timeout: constants.TIMEOUT
  });

  // limit requests
  var self = this;
  var queue = new TimeQueue(function(stream, method, options,
                                     callback, queueCB) {

    function finalCallback() {
      if (typeof callback === 'function') {
        callback.apply(null, arguments);
      }
      // ignore errors since all ntwitter's methods can be given callbacks
      queueCB();
    }

    // call the original function from the client
    if (stream) {
      var req = self.request[method](options);
      stream.on('response', function(res) {
        if (res.statusCode !== 200) {
          return finalCallback(new Error('status code '  + res.statusCode));
        }

        finalCallback(null);
      });
      stream.resolve(req);

    } else {
      self.request[method](options, finalCallback);
    }

  }, {
    concurrency: 1
  , every: Math.floor(1000 / constants.MAX_REQUESTS_PER_SECOND)
  , timeout: 30000
  });

  ['get', 'post'].forEach(function(method) {
    self[method] = function(options, callback, willStream) {
      if (willStream) {
        var stream = streamify();
        queue.push(stream, method, options, callback);
        return stream;
      } else {
        queue.push(null, method, options, callback);
      }
    };
  });
};


/**
 * Create a post request that will be streamed.
 *
 */
Stweam.prototype.stream = function(options) {
  return this.post(options, null, true);
};


/**
 * Similar streams.
 */
[ 'Public Stream'
, 'Sample Stream'
, 'Firehose'
, 'User Stream'
].forEach(function(name) {
  var resource = constants[name.replace(' ', '_').toUpperCase()].RESOURCE_URL;

  Stweam.prototype['create' + name.replace(' ', '')] = function(arg1) {
    return new TwitterStream(this, resource, arg1);
  };
});


/**
 * Create constructor methods for rest of stream types.
 */
[ 'Stream'
, 'SiteStream'
, 'Pool'
].forEach(function(name) {
  var Obj = require('./' + name.toLowerCase());

  Stweam.prototype['create' + name] = function(arg1, arg2) {
    return new Obj(this, arg1, arg2);
  };

  // export data type
  Stweam[name] = Obj;
});
