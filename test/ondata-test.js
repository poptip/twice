/*jshint quotmark:false, es5:true */
var ondata = require('../lib/ondata');
var EventEmitter = require('events').EventEmitter;


var data;
var events = {
  // Events for all types of streams.
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
  },
  disconnect: {
    data: {
      disconnect: {
        code: 4,
        stream_name: 'mondaysundayrunday-kfalter',
        reason: 'admin logout'
      }
    },
    args: [4, 'admin logout', 'mondaysundayrunday', 'kfalter']
  }
};


// User stream events.
events.friends = {
  data: { friends: data = [1497, 169686021, 790205, 15211564] },
  args: [data]
};

var userStreamEvents = {
  // Event Name | Source | Target | Target Object
  block: {
    data: ['user1', 'user2', null],
    args: ['user1', 'user2']
  },
  unblock: {
    data: ['user1', 'user2', null],
    args: ['user1', 'user2']
  },
  favorite: {
    data: ['user1', 'user2', 'tweet'],
    args: ['user1', 'user2', 'tweet']
  },
  unfavorite: {
    data: ['user1', 'user2', 'tweet'],
    args: ['user1', 'user2', 'tweet']
  },
  follow: {
    data: ['user1', 'user2'],
    args: ['user1', 'user2']
  },
  unfollow: {
    data: ['user1', 'user2'],
    args: ['user1', 'user2']
  },
  list_created: {
    data: ['user1', 'user1', 'list'],
    args: ['list']
  },
  list_destroyed: {
    data: ['user1', 'user1', 'list'],
    args: ['list']
  },
  list_updated: {
    data: ['user1', 'user1', 'list'],
    args: ['list']
  },
  list_member_added: {
    data: ['user1', 'user2', 'list'],
    args: ['user1', 'user2', 'list']
  },
  list_member_removed: {
    data: ['user1', 'user2', 'list'],
    args: ['user1', 'user2', 'list']
  },
  list_user_subscribed: {
    data: ['user1', 'user2', 'list'],
    args: ['user1', 'user2', 'list']
  },
  list_user_unsubscribed: {
    data: ['user1', 'user2', 'list'],
    args: ['user1', 'user2', 'list']
  },
  user_update: {
    data: ['user1', 'user1', null],
    args: ['user1']
  }
};

Object.keys(userStreamEvents).forEach(function(event) {
  var eventData = userStreamEvents[event];
  var createdAt = new Date();

  events[event] = {
    data: {
      target: eventData.data[1],
      source: eventData.data[0],
      event: event,
      target_object: eventData.data[2],
      created_at: createdAt.toString()
    },
    args: eventData.args.concat(createdAt)
  };
});


Object.keys(events).forEach(function(event) {
  var testData = events[event];
  exports[event] = function(test) {
    var ee = new EventEmitter();

    ee.on(event, function onEvent() {
      for (var i = 0, l = testData.args.length; i < l; i++) {
        var a = testData.args[i];
        var b = arguments[i];
        if (a instanceof Date) {
          a = a.toString();
        }
        if (b instanceof Date) {
          b = b.toString();
        }
        test.deepEqual(a, b);
      }

      test.done();
    });

    ondata.call(ee, testData.data);
  };
});
