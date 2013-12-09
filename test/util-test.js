var utils = require('../lib/utils');
var PublicStream = require('../lib/publicstream');
var sinon = require('sinon');
var spy = sinon.spy;


exports['create status code error'] = {
  'known error': function(test) {
    var err = utils.createStatusCodeError(401);
    test.ok(err instanceof Error);
    test.equal(err.message,
      'Unauthorized - HTTP authentication failed due to invalid OAuth request.'
    );
    test.equal(err.type, 'Unauthorized');
    test.equal(err.statusCode, 401);
    test.done();
  },
  'unknown error': function(test) {
    var err = utils.createStatusCodeError(42);
    test.ok(err instanceof Error);
    test.equal(err.message, 'There was an unknown error.');
    test.equal(err.type, 'http');
    test.equal(err.statusCode, 42);
    test.done();
  }
};


function mockStream(track) {
  var stream = new PublicStream(null, { track: track });
  stream.connected = true;
  stream.connect = function() {};
  stream.reconnect = spy();
  return stream;
}

exports['create param methods'] = {
  add: {
    successfully: function(test) {
      var stream = mockStream('foo');
      test.equal(stream.params.track, 'foo');
      test.ok(stream.tracking('foo'));
      test.equal(stream.trackCount, 1);

      stream.track('bar');
      test.equal(stream.params.track, 'foo,bar');
      test.ok(stream.tracking('bar'));
      test.equal(stream.trackCount, 2);
      test.ok(stream.reconnect.called);
      test.done();
    },
    'when already in list': function(test) {
      var stream = mockStream();
      stream.track('foo');
      test.ok(stream.tracking('foo'));
      test.equal(stream.trackCount, 1);

      test.throws(function() {
        stream.track('foo');
      }, /Already tracking foo/);
      test.done();
    },
    several: function(test) {
      var stream = mockStream();
      stream.track(['zam', 'zoom']);
      test.ok(stream.tracking('zam'));
      test.ok(stream.tracking('zoom'));
      test.equal(stream.trackCount, 2);
      test.equal(stream.params.track, 'zam,zoom');
      test.equal(stream.reconnect.callCount, 1);
      test.done();
    }
  },

  remove: {
    'successfully after adding': function(test) {
      var stream = mockStream('bar');
      stream.track('foo');
      stream.untrack('foo');
      test.ok(stream.tracking('bar'));
      test.ok(!stream.tracking('foo'));
      test.equal(stream.trackCount, 1);
      test.equal(stream.params.track, 'bar');
      test.ok(stream.reconnect.calledTwice);
      test.done();
    },
    'when not in params': function(test) {
      var stream = mockStream('bar');

      test.throws(function() {
        stream.untrack('foo');
      }, /Not tracking foo/);
      test.done();
    }
  }
};
