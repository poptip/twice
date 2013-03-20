var EventEmitter = require('events').EventEmitter;
var Stweam = require('..');
var worker = require('../lib/worker');
var constants = require('../lib/constants');


exports['buffered request'] = {
  'success': function(test) {
    test.expect(2);

    var client = new Stweam();
    client._request.get = function(options, callback) {
      test.deepEqual(options, {
        url: 'http://hello.im',
        no: 'yes',
        json: true,
        timeout: constants.REQUEST_TIMEOUT
      });
      var req = new EventEmitter();
      var data = { hello: 42 };
      process.nextTick(callback.bind(null, null, { statusCode: 200 }, data));
      return req;
    };

    var ee = new EventEmitter();
    var options = { url: 'http://hello.im', no: 'yes' };
    worker(client, ee, 'get', options, function(err, data) {
      if (err) throw err;
      test.deepEqual(data, { hello: 42 });
    }, test.done);
  },
  'site stream POST request': function(test) {
    test.expect(2);

    var client = new Stweam();
    var resp = 'ok';
    client._request.post = function(options, callback) {
      test.deepEqual(options, {
        url: constants.SITE_STREAM.HOST,
        no: 'yes',
        timeout: constants.REQUEST_TIMEOUT
      });
      var req = new EventEmitter();
      process.nextTick(callback.bind(null, null, { statusCode: 200 }, resp));
      return req;
    };

    var ee = new EventEmitter();
    var options = { url: constants.SITE_STREAM.HOST, no: 'yes' };
    worker(client, ee, 'post', options, function(err, data) {
      if (err) throw err;
      test.deepEqual(data, resp);
    }, test.done);
  },
  'error': function(test) {
    test.expect(4);

    var client = new Stweam();
    client._request.get = function(options, callback) {
      var req = new EventEmitter();
      var err = new Error('something went wrong');
      process.nextTick(callback.bind(null, err));
      return req;
    };

    var ee = new EventEmitter();
    var url = 'http://prince.of/arabia';
    worker(client, ee, 'get', url, function(err, data) {
      test.ok(err);
      test.equal(err.message, 'something went wrong');
      test.deepEqual(err.options, {
        url: 'http://prince.of/arabia',
        json: true,
        timeout: constants.REQUEST_TIMEOUT
      });
      test.ok(!data);
    }, test.done);
  },
  'status code error': function(test) {
    test.expect(4);

    var client = new Stweam();
    client._request.get = function(options, callback) {
      var req = new EventEmitter();
      process.nextTick(callback.bind(null, null, { statusCode: 500 }));
      return req;
    };

    var ee = new EventEmitter();
    var url = 'http://prince.of/arabia';
    worker(client, ee, 'get', url, function(err, data) {
      test.ok(err);
      test.equal(err.type, 'Service Unavailable');
      test.deepEqual(err.options, {
        url: 'http://prince.of/arabia',
        json: true,
        timeout: constants.REQUEST_TIMEOUT
      });
      test.ok(!data);
    }, test.done);
  },
  'Twitter error': function(test) {
    test.expect(5);

    var client = new Stweam();
    var resp = {
      errors: [
        { message: 'we dont like you' }
      ]
    };
    client._request.post = function(options, callback) {
      var req = new EventEmitter();
      process.nextTick(callback.bind(null, null, { statusCode: 200 }, resp));
      return req;
    };

    var ee = new EventEmitter();
    var url = 'http://prince.of/arabia';
    worker(client, ee, 'post', url, function(err, data) {
      test.ok(err);
      test.equal(err.message, 'we dont like you');
      test.deepEqual(err.options, {
        url: 'http://prince.of/arabia',
        json: true,
        timeout: constants.REQUEST_TIMEOUT
      });
      test.deepEqual(err.data, resp);
      test.ok(!data);
    }, test.done);
  }
};


exports['streaming request'] = function(test) {
  var client = new Stweam();
  client._request.post = function(options) {
    test.equal(options, 'http://google.com');
    var req = new EventEmitter();
    process.nextTick(req.emit.bind(req, 'response', { statusCode: 200 }));
    return req;
  };

  var ee = new EventEmitter();
  worker(client, ee, 'post', 'http://google.com', undefined, test.done);
};
