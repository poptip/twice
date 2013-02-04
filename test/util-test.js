var utils = require('../lib/utils');


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
