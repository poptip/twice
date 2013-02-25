/**
 * Twitter will emit several types of messages.
 *
 * https://dev.twitter.com/docs/streaming-apis/messages
 */
var MESSAGES = [
  { event: 'warning', args: ['code', 'message', 'percent_full'] }
, { event: 'control', args: ['control_uri'] }
, { event: 'delete', args: ['status.id_str', 'status.user_id_str'] }
, { event: 'scrub_geo', args: ['user_id_str', 'up_to_status_id_str'] }
, { event: 'limit', args: ['track'] }
, { event: 'status_withheld', args: ['id_str', 'user_id_str', 'withheld_in_countries'] }
, { event: 'user_withheld', args: ['id_str', 'withheld_in_countries'] }
, { event: 'friends', args: null }
];


/**
 * These events send the current user twice. This object is here
 * so that we know to avoid those objects when emitting the event.
 */
var EVENTS = {
  list_created: true
, list_destroyed: true
, list_updated: true
};


/**
 * Called when `data` event is emitted from a stream.
 *
 * @param {Object} data
 */
module.exports = function ondata(data) {
  var for_user, obj, i, len, i2, len2, message, args, keys, value;

  this.emit('data', data);

  if (data.for_user && data.message) {
    for_user = data.for_user;
    data = data.message;
  }


  for (i = 0, len = MESSAGES.length; i < len; i++) {
    message = MESSAGES[i];
    if (obj = data[message.event]) {
      args = [message.event];

      if (message.args) {
        for (i2 = 0, len2 = message.args.length; i2 < len2; i2++) {
          keys = message.args[i2].split('.');
          value = obj;
          while (keys.length) {
            value = value[keys.shift()];
          }

          args.push(value);
        }
      } else{
        args.push(obj);
      }

      if (for_user) {
        args.push(for_user);
      }
      this.emit.apply(this, args);
      return;
    }
  }

  if (data.event) {
    args = [data.event];

    if (data.event === 'user_update') {
      args.push(data.source);
    } else if (!EVENTS[data.event]) {
      args.push(data.source);
      args.push(data.target);
    }

    if (data.target_object) {
      args.push(data.target_object);
    }
    args.push(new Date(data.created_at));

    if (for_user) {
      args.push(for_user);
    }
    this.emit.apply(this, args);
    return;
  }

  // Disocnnect event.
  obj = data.disconnect;
  if (obj) {
    args = obj.stream_name.split('-');
    this.emit('disconnect', obj.code, obj.reason, args[0], args[1], args[2]);
    return;
  }

  // This must be a tweet if it has a `text` property.
  if (data.text) {
    this.emit('tweet', data);

    // The user has retweeted using the actual "Retweet" button, not RT.
    if (data.retweeted_status) {
      this.emit('tweet:retweet', data);
      this.emit('tweet:retweet:' + data.retweeted_status.id_str, data);

    }
    
    // The user has replied directly to a tweet.
    if (data.in_reply_to_status_id_str) {
      this.emit('tweet:reply', data);
      this.emit('tweet:reply:' + data.in_reply_to_status_id_str, data);

    }

    // The user has replied to some other tweet of the poll creator.
    if (data.in_reply_to_screen_name) {
      this.emit('tweet:@reply', data);
      this.emit('tweet:@reply:' + data.in_reply_to_screen_name, data);

    // The tweet isn't a reply to the creator, but still @mentions the creator
    } else if (data.entities && data.entities.user_mentions) {
      var self = this;

      data.entities.user_mentions.forEach(function(user) {
        self.emit('tweet:@reply', data);
        self.emit('tweet:@reply:' + user.screen_name, data);
      });
    }
    return;
  }

  // In case we run across something not recognized yet or newly added.
  var err = new Error('Unknown message type.');
  if (for_user) {
    err.for_user = for_user;
  }
  err.data = data;
  this.emit('error', err);
};
