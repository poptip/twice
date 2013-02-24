/*jshint quotmark:false, es5:true */
var ondata = require('../lib/ondata');
var EventEmitter = require('events').EventEmitter;


var data;
var tests = {
  delete: {
    data: {
      delete: {
        status: data = {
          id: 1234,
          id_str: '1234',
          user_id: 3,
          user_id_str: '3'
        }
      }
    },
    args: [data.id_str, data.user_id_str]
  },
  scrub_geo: {
    data: {
      scrub_geo: data = {
        user_id: 14090452,
        user_id_str: '14090452',
        up_to_status_id: 23260136625,
        up_to_status_id_str: '23260136625'
      }
    },
    args: [data.user_id_str, data.up_to_status_id_str]
  },
  limit: {
    data: { limit: { track: 1234 } },
    args: [1234]
  },
  status_withheld: {
    data: {
      status_withheld: data = {
        id: 1234567890,
        id_str: '1234567890',
        user_id: 123456,
        user_id_str: '123456',
        withheld_in_countries: ['DE', 'AR']
      }
    },
    args: [data.id_str, data.user_id_str, data.withheld_in_countries]
  },
  user_withheld: {
    data: {
      user_withheld: data = {
        id: 123456,
        id_str: '123456',
        withheld_in_countries: ['DE', 'AR']
      }
    },
    args: [data.id_str, data.withheld_in_countries]
  },
  warning: {
    data: {
      warning: data = {
        code: 'FALLING_BEHIND',
        message: 'Your connection is falling behind and messages are being queued for delivery to you. Your queue is now over 60% full. You will be disconnected when the queue is full.',
        percent_full: 60
      }
    },
    args: [data.code, data.message, data.percent_full]
  }
};


Object.keys(tests).forEach(function(event) {
  var testData = tests[event];
  exports[event] = function(test) {
    var ee = new EventEmitter();

    ee.on(event, function onEvent() {
      for (var i = 0, l = testData.args.length; i < l; i++) {
        test.deepEqual(testData.args[i], arguments[i]);
      }

      test.done();
    });

    ondata.call(ee, testData.data);
  };
});
