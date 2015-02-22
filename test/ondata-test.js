/*jshint maxlen: false */
var ondata       = require('../lib/ondata');
var constants    = require('../lib/constants');
var EventEmitter = require('events').EventEmitter;
var spy          = require('sinon').spy;


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
  },
  shutdown: {
    data: {
      disconnect: {
        code: 1,
        stream_name: 'stream-kfalter',
        reason: 'shutdown'
      }
    },
    args: ['stream', 'kfalter']
  },
  'duplicate stream': {
    data: {
      disconnect: {
        code: 2,
        stream_name: 'stream-kfalter',
        reason: 'duplicate stream'
      }
    },
    args: ['stream', 'kfalter']
  },
  'control request': {
    data: {
      disconnect: {
        code: 3,
        stream_name: 'stream-kfalter',
        reason: 'control request'
      }
    },
    args: ['stream', 'kfalter']
  },
  stall: {
    data: {
      disconnect: {
        code: 4,
        stream_name: 'stream-kfalter',
        reason: 'stall'
      }
    },
    args: ['stream', 'kfalter']
  },
  normal: {
    data: {
      disconnect: {
        code: 5,
        stream_name: 'stream-kfalter',
        reason: 'normal'
      }
    },
    args: ['stream', 'kfalter']
  },
  'token revoked': {
    data: {
      disconnect: {
        code: 6,
        stream_name: 'roly426-sphere-kfalter',
        reason: 'token revoked'
      },
    },
    args: ['roly426', 'sphere', 'kfalter']
  },
  'admin logout': {
    data: {
      disconnect: {
        code: 7,
        stream_name: 'stream-kfalter',
        reason: 'admin logout'
      }
    },
    args: ['stream', 'kfalter']
  },
  'max message limit': {
    data: {
      disconnect: {
        code: 9,
        stream_name: 'stream-kfalter',
        reason: 'max message limit'
      }
    },
    args: ['stream', 'kfalter']
  },
  'stream exception': {
    data: {
      disconnect: {
        code: 10,
        stream_name: 'stream-kfalter',
        reason: 'stream exception'
      }
    },
    args: ['stream', 'kfalter']
  },
  'broker stall': {
    data: {
      disconnect: {
        code: 11,
        stream_name: 'stream-kfalter',
        reason: 'broker stall'
      }
    },
    args: ['stream', 'kfalter']
  },
  'shed load': {
    data: {
      disconnect: {
        code: 12,
        stream_name: 'stream-kfalter',
        reason: 'shed load'
      }
    },
    args: ['stream', 'kfalter']
  },


  // Tweet events.
  tweet: {
    data: data = { text: 'hello there' },
    args: [data]
  },
  'tweet:retweet': {
    data: data = { text: 'hello', retweeted_status: {} },
    args: [data]
  },
  'tweet:retweet:<tweet ID>': {
    data: data = { text: 'hello', retweeted_status: { id_str: '1234' } },
    args: [data],
    event: 'tweet:retweet:1234'
  },
  'tweet:reply': {
    data: data = { text: 'hello', in_reply_to_status_id_str: '42' },
    args: [data]
  },
  'tweet:reply:<tweet ID>': {
    data: data = { text: 'hello', in_reply_to_status_id_str: '42' },
    args: [data],
    event: 'tweet:reply:42'
  },
  'tweet:mention': {
    data: data = { text: 'hello', in_reply_to_screen_name: 'pie' },
    args: [data]
  },
  'tweet:mention:<screen name>': {
    data: data = { text: 'hello', in_reply_to_screen_name: 'pie' },
    args: [data],
    event: 'tweet:mention:pie'
  },
  'tweet:mention - entities': {
    data: data = {
      text: 'hello',
      entities: { user_mentions: [{ screen_name: 'roly' }] }
    },
    args: [data],
    event: 'tweet:mention'
  },
  'tweet:mention:<screen name> - entities': {
    data: data = {
      text: 'hello',
      entities: { user_mentions: [{ screen_name: 'roly' }] }
    },
    args: [data],
    event: 'tweet:mention:roly'
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


// Site stream events.
events.control = {
  data: {
    control: {
      control_uri: data = '/1.1/site/c/01_225167_334389048B872A533002B34D73F8C29FD09EFC50'
    }
  },
  args: [data]
};

['friends']
.concat(Object.keys(events).filter(function(event) {
  return (/^tweet/).test(event);
}))
.concat(Object.keys(userStreamEvents)).forEach(function(event) {
  var userEvent = events[event];

  events['sitestream - ' + event] = {
    data: {
      for_user: '1234',
      message: userEvent.data
    },
    args: userEvent.args.concat('1234'),
    event: userEvent.event || event
  };
});


Object.keys(events).forEach(function(event) {
  var testData = events[event];

  exports[event] = function(test) {
    var ee = new EventEmitter();

    ee.on(testData.event || event, function onEvent() {
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


exports['duplicate tweets'] = {
  'different ids': function(test) {
    var ee = new EventEmitter();
    ee._tweets = [];
    ee._tweetsHash = {};
    var tweet1 = { id_str: '1', text: 'hey' };
    var tweet2 = { id_str: '2', text: 'hey' };

    var eventSpy = spy();
    ee.on('unique:tweet', eventSpy);

    ondata.call(ee, tweet1);
    ondata.call(ee, tweet2);

    test.ok(eventSpy.calledTwice);
    test.done();
  },
  'same ids': function(test) {
    var ee = new EventEmitter();
    ee._tweets = [];
    ee._tweetsHash = {};
    var tweet1 = { id_str: '1', text: 'hey' };
    var tweet2 = { id_str: '1', text: 'hey' };

    var eventSpy = spy();
    ee.on('unique:tweet', eventSpy);

    ondata.call(ee, tweet1);
    ondata.call(ee, tweet2);

    test.ok(eventSpy.calledOnce);
    test.done();
  },
  'over the amount of saved ids': function(test) {
    var ee = new EventEmitter();
    ee._tweets = [];
    ee._tweetsHash = {};

    for (var i = 0, l = constants.MAX_SAVED_TWEET_IDS; i < l; i++) {
      ondata.call(ee, { id_str: i.toString(), text: 'hi' });
    }

    test.equal(ee._tweets.length, constants.MAX_SAVED_TWEET_IDS);
    test.equal(Object.keys(ee._tweetsHash).length,
      constants.MAX_SAVED_TWEET_IDS);

    var eventSpy = spy();
    ee.on('unique:tweet', eventSpy);

    var tweet1 = { id_str: '-200', text: 'hey' };
    ondata.call(ee, tweet1);

    test.equal(ee._tweets.length, constants.MAX_SAVED_TWEET_IDS);
    test.equal(Object.keys(ee._tweetsHash).length,
      constants.MAX_SAVED_TWEET_IDS);
    test.ok(eventSpy.calledOnce);
    test.done();
  }
};
