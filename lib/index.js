var inherits  = require('util').inherits;
var ntwitter  = require('ntwitter');
var TimeQueue = require('timequeue');
var constants = require('./constants');


/**
 * @constructor
 * @extends (ntwitter)
 * @param (Object) credentials
 */
var Stweam = module.exports = function Stweam(credentials) {
  ntwitter.call(this, credentials);

  // limit requests
  var self = this;
  var queue = new TimeQueue(function(fn, args, callback) {
    args = Array.prototype.slice.call(args);

    // find out if the last arg is a callback
    var cb;
    if (typeof args[args.length - 1] === 'function') {
      cb = args.pop();
    } else {
      cb = function() {};
    }

    // add the queue callback to args list
    args.push(function() {
      cb.apply(null, arguments);
      // ignore errors since all ntwitter's methods can be given callbacks
      callback();
    });

    // call the original function from the client
    fn.apply(self, args);

  }, constants.MAX_REQUESTS_PER_SECOND, 1000);

  ['get', 'post', 'streamRequest'].forEach(function(method) {
    var fn = self[method];

    self[method] = function() {
      queue.push(fn, arguments);
    };
  });
};

inherits(Stweam, ntwitter);


/**
 * Custom stream creating method.
 *
 * @param (string) resourceUrl
 * @return (http.ClientRequest)
 */
Stweam.prototype.streamRequest = function(resourceUrl) {
  return this.oauth.post(resourceUrl,
                         this.options.access_token_key,
                         this.options.access_token_secret);
};


/**
 * Create constructor methods for various stream types.
 */
[ 'Stream'
, 'PublicStream'
, 'UserStream'
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
