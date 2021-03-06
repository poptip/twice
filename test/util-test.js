var util         = require('../lib/util');
var PublicStream = require('../lib/publicstream');
var sinon        = require('sinon');
var spy          = sinon.spy;


exports['create status code error'] = {
  'known error': function(test) {
    var err = util.createStatusCodeError(401);
    test.ok(err instanceof Error);
    test.equal(err.message,
      'Unauthorized - HTTP authentication failed due to invalid OAuth request.'
    );
    test.equal(err.type, 'Unauthorized');
    test.equal(err.statusCode, 401);
    test.done();
  },
  'unknown error': function(test) {
    var err = util.createStatusCodeError(42);
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
      test.deepEqual(stream.trackList, ['foo']);

      stream.track('bar');
      test.equal(stream.params.track, 'bar,foo');
      test.ok(stream.tracking('bar'));
      test.equal(stream.trackCount, 2);
      test.deepEqual(stream.trackList, ['bar', 'foo']);
      test.ok(stream.reconnect.called);
      test.done();
    },
    'when already in list': function(test) {
      var stream = mockStream();
      stream.track('foo');
      test.ok(stream.tracking('foo'));
      test.equal(stream.trackCount, 1);
      test.deepEqual(stream.trackList, ['foo']);

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
      test.deepEqual(stream.trackList, ['zam', 'zoom']);
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
      test.deepEqual(stream.trackList, ['bar']);
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

exports['clone object'] = function(test) {
  var a = { a: 1, b: 2 };
  var b = util.clone(a);
  test.deepEqual(a, b);
  test.notEqual(a, b);
  test.done();
};
