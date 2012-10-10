var Stweam = require('..');
var MockStream = require('./mockstream');
var spy = require('sinon').spy;
var nock = require('nock');


function createMock() {
  var mockstream = new MockStream();

  nock('https://stream.twitter.com')
    .post('/1.1/statuses/sample.json', 'stall_warnings=true')
    .reply(200, mockstream);

  return mockstream;
}


exports['create a sample stream'] = function(t) {
  var client = new Stweam();
  var stream = client.createSampleStream();
  createMock();

  var beforeConnectSpy = spy();
  var reconnectSpy = spy();
  var retrySpy = spy();

  stream.on('beforeConnect', beforeConnectSpy);
  stream.on('reconnect', reconnectSpy);
  stream.on('retry', retrySpy);

  stream.on('connect', function() {
    t.ok(stream.connected, 'stream is connected');
    stream.destroy();
  });

  stream.on('disconnect', function() {
    t.ok(beforeConnectSpy.called);
    t.ok(!reconnectSpy.called, 'stream did not try to reconnect');
    t.ok(!retrySpy.called, 'stream did not retry anything');
    t.ok(!stream.connected, 'stream is not connected');
    t.done();
  });
};
