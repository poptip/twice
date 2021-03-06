var EventEmitter = require('events').EventEmitter;
var Stream       = require('../lib/stream');
var util         = require('../lib/util');
var through      = require('through');
var sinon        = require('sinon');
var spy          = sinon.spy;


exports['create a stream with no params'] = function(test) {
  var res = through();
  res.statusCode = 200;

  var client = {
    get: function(url, params) {
      test.equal(url, 'http://see.me');
      test.deepEqual(params, { stall_warnings: true });
      var req = new EventEmitter();
      process.nextTick(req.emit.bind(req, 'response', res));
      return req;
    }
  };

  var stream = new Stream(client, 'http://see.me');

  var beforeConnectSpy = spy();
  stream.on('beforeConnect', beforeConnectSpy);

  stream.on('connect', function() {
    test.ok(beforeConnectSpy.called);
    test.ok(stream.connected, 'stream should be connected');
    stream.destroy();
  });

  stream.on('destroy', test.done);
};


exports['create a stream with params'] = function(test) {
  var res = through();
  res.statusCode = 200;

  var client = {
    get: function(url, params) {
      test.equal(url, 'http://see.me');
      test.deepEqual(params, { stall_warnings: true, count: 500 });
      var req = new EventEmitter();
      process.nextTick(req.emit.bind(req, 'response', res));
      return req;
    }
  };

  var stream = new Stream(client, 'http://see.me', { count: 500 });

  stream.on('connect', function() {
    test.ok(stream.connected, 'stream should be connected');
    stream.destroy();
  });

  stream.on('destroy', test.done);
};


exports['response stream closes'] = function(test) {
  var res = through();
  res.statusCode = 200;

  var client = {
    get: function() {
      var req = new EventEmitter();
      process.nextTick(req.emit.bind(req, 'response', res));
      return req;
    }
  };

  var stream = new Stream(client, 'http://see.me');

  var retrySpy = spy();
  stream.on('retry', retrySpy);

  stream.on('connect', res.destroy.bind(res));
  stream.on('end', function() {
    test.ok(retrySpy.calledWith('exponential'));
    stream.destroy();
  });

  stream.on('destroy', test.done);
};


exports['response stream suddenly ends'] = function(test) {
  var res = through();
  res.statusCode = 200;

  var client = {
    get: function() {
      var req = new EventEmitter();
      process.nextTick(req.emit.bind(req, 'response', res));
      return req;
    }
  };

  var stream = new Stream(client, 'http://see.me');

  var retrySpy = spy();
  stream.on('retry', retrySpy);

  stream.on('connect', res.end.bind(res));
  stream.on('end', function() {
    test.ok(retrySpy.calledWith('exponential'));
    stream.destroy();
  });

  stream.on('destroy', test.done);
};


exports['response stream non 200 status code'] = function(test) {
  var client = {
    get: function() {
      var ee = new EventEmitter();
      var err = new util.createStatusCodeError(401);
      process.nextTick(ee.emit.bind(ee, 'responseError', err));
      return ee;
    }
  };

  var stream = new Stream(client, 'http://see.me');

  var retrySpy = spy();
  stream.on('retry', retrySpy);

  var connectSpy = spy();
  stream.on('connect', connectSpy);

  stream.on('error', function(err) {
    test.equal(err.statusCode, 401);
    test.ok(retrySpy.calledWith('exponential'));
    stream.destroy();
  });

  stream.on('destroy', test.done);
};


exports['response stream error'] = function(test) {
  var res = through();
  res.statusCode = 200;

  var client = {
    get: function() {
      var req = new EventEmitter();
      process.nextTick(req.emit.bind(req, 'response', res));
      return req;
    }
  };

  var stream = new Stream(client, 'http://see.me');

  var retrySpy = spy();
  stream.on('retry', retrySpy);

  stream.on('connect', function() {
    process.nextTick(function() {
      res.emit('error', new Error('oh no'));
    });
  });

  stream.on('error', function(err) {
    test.equal(err.message, 'oh no');
    test.ok(retrySpy.calledWith('exponential'));
    stream.destroy();
  });

  stream.on('destroy', test.done);
};


exports['response stream error with parsing JSON'] = function(test) {
  var res = through();
  res.statusCode = 200;

  var client = {
    get: function() {
      var req = new EventEmitter();
      process.nextTick(req.emit.bind(req, 'response', res));
      return req;
    }
  };

  var stream = new Stream(client, 'http://see.me');

  var retrySpy = spy();
  stream.on('retry', retrySpy);

  stream.on('connect', function() {
    process.nextTick(function() {
      res.write('hahahah { yolo}}');
    });
  });

  stream.on('error', function(err) {
    test.ok(/Non-whitespace before \{\[/.test(err.message));
    test.ok(retrySpy.calledWith('exponential'));
    stream.destroy();
  });

  stream.on('destroy', test.done);
};


exports['response stream timeout'] = function(test) {
  var clock = sinon.useFakeTimers();
  var res = through();
  res.statusCode = 200;

  var client = {
    get: function() {
      var req = new EventEmitter();
      process.nextTick(req.emit.bind(req, 'response', res));
      return req;
    }
  };

  var stream = new Stream(client, 'http://see.me');

  var retrySpy = spy();
  stream.on('retry', retrySpy);

  stream.on('connect', function() {
    clock.tick(90000);
  });

  stream.on('timeout', function() {
    test.ok(retrySpy.calledWith('linear'));
    clock.restore();
    stream.destroy();
  });

  stream.on('destroy', test.done);
};


exports['response stream receives data and then times out'] = function(test) {
  var clock = sinon.useFakeTimers();
  var res = through();
  res.statusCode = 200;

  var client = {
    get: function() {
      var req = new EventEmitter();
      process.nextTick(req.emit.bind(req, 'response', res));
      return req;
    }
  };

  var stream = new Stream(client, 'http://see.me');

  var retrySpy = spy();
  stream.on('retry', retrySpy);

  stream.on('connect', function() {
    process.nextTick(function() {
      res.write('{"text": "hey"}');
      process.nextTick(function() {
        clock.tick(90000);
      });
    });
  });

  stream.once('timeout', function() {
    test.ok(retrySpy.calledWith('linear'));
    clock.restore();
    stream.destroy();
  });

  stream.on('destroy', test.done);
};


exports['request error'] = function(test) {
  var client = {
    get: function(url, params) {
      test.equal(url, 'http://see.me');
      test.deepEqual(params, { stall_warnings: true });
      var ee = new EventEmitter();
      var err = new Error('not connected to the internet');
      process.nextTick(ee.emit.bind(ee, 'requestError', err));
      return ee;
    }
  };

  var stream = new Stream(client, 'http://see.me');
  stream.on('error', function(err) {
    test.equal(err.message, 'not connected to the internet');
    stream.destroy();
    test.done();
  });
};


exports['request timeout'] = function(test) {
  var client = {
    get: function(url, params) {
      test.equal(url, 'http://see.me');
      test.deepEqual(params, { stall_warnings: true });
      var ee = new EventEmitter();
      var err = new Error('not connected to the internet');
      err.code = 'ESOCKETTIMEDOUT';
      process.nextTick(ee.emit.bind(ee, 'requestError', err));
      return ee;
    }
  };

  var stream = new Stream(client, 'http://see.me');
  var errorSpy = spy();
  stream.on('error', errorSpy);

  stream.on('timeout', function() {
    test.ok(errorSpy.called, 'error event was emitted');
    stream.destroy();
    test.done();
  });
};


exports['pause and resume stream while connected'] = function(test) {
  test.expect(3);
  var res = through();
  res.statusCode = 200;

  var client = {
    get: function() {
      var req = new EventEmitter();
      process.nextTick(req.emit.bind(req, 'response', res));
      return req;
    }
  };

  var stream = new Stream(client, 'http://see.me');

  var tweetSpy = spy();
  stream.on('tweet', tweetSpy);

  stream.on('connect', function() {
    process.nextTick(function() {
      test.ok(stream.connected);
      stream.pause();
      process.nextTick(function() {
        res.write('{"text": "hey"}');
        process.nextTick(resume);
      });
    });
  });

  function resume() {
    test.ok(!tweetSpy.called);
    stream.resume();

    process.nextTick(function() {
      test.ok(tweetSpy.called);
      stream.destroy();
    });
  }

  stream.on('destroy', test.done);
};


exports['pause and resume stream while not connected'] = function(test) {
  test.expect(3);
  var res = through();
  res.statusCode = 200;

  var client = {
    get: function() {
      var req = new EventEmitter();
      process.nextTick(req.emit.bind(req, 'response', res));
      return req;
    }
  };

  var stream = new Stream(client, 'http://see.me');

  var tweetSpy = spy();
  stream.on('tweet', tweetSpy);

  test.ok(!stream.connected);
  stream.pause();
  process.nextTick(function() {
    test.ok(!tweetSpy.called);
    stream.resume();
  });

  stream.on('connect', function() {
    process.nextTick(function() {
      res.write('{"text": "hey"}');

      process.nextTick(function() {
        test.ok(tweetSpy.called);
        stream.destroy();
      });
    });
  });

  stream.on('destroy', test.done);
};
