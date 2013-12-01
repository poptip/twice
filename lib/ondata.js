var MAX_SAVED_TWEET_IDS = require('./constants').MAX_SAVED_TWEET_IDS;


/**
 * Twitter will emit several types of messages.
 *
 * https://dev.twitter.com/docs/streaming-apis/messages
 */
var MESSAGES = [
  { event: 'warning', args: ['code', 'message', ['percent_full', 'user_id']] }
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
 * Determine if an incoming Tweet is unique by looking at a hash
 * of past Tweets.
 *
 * @param {Object} tweet
 */
function isUnique(tweet) {
  if (!this._tweets || !this._tweetsHash) return false;

  var tweetID = tweet.id_str;
  if (this._tweetsHash[tweetID]) {
    return false;
  } else {
    this._tweetsHash[tweetID] = true;
    this._tweets.push(tweetID);

    // Keep the size of the past tweets array and hash down.
    if (this._tweets.length > MAX_SAVED_TWEET_IDS) {
      delete this._tweetsHash[this._tweets.shift()];
    }

    return true;
  }
}


/**
 * Called when `data` event is emitted from a stream.
 *
 * @param {Object} data
 */
module.exports = function ondata(data) {
  var for_user, obj, i, len, i2, len2, i3, len3,
    message, event, args, keys, keyes, value;

  this.emit('data', data);

  if (data.for_user && data.message) {
    for_user = data.for_user;
    data = data.message;
  }


  for (i = 0, len = MESSAGES.length; i < len; i++) {
    message = MESSAGES[i];
    event = message.event;
    if (obj = data[event]) {
      args = [event];

      if (message.args) {
        for (i2 = 0, len2 = message.args.length; i2 < len2; i2++) {
          keys = message.args[i2];
          if (!Array.isArray(keys)) { keys = [keys]; }
          for (i3 = 0, len3 = keys.length; i3 < len3; i3++) {
            keyes = keys[i3].split('.');
            value = obj;
            while (keyes.length) {
              value = value[keyes.shift()];
            }

            if (value) {
              args.push(value);
            }
          }
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
    this.emit(obj.reason, args[0], args[1], args[2]);
    return;
  }

  // This must be a tweet if it has a `text` property.
  if (data.text) {
    var unique = isUnique.call(this, data);
    if (unique) {
      this.emit('unique:tweet', data);
    }
    this.emit('tweet', data, for_user);

    // The user has retweeted using the actual "Retweet" button, not RT.
    if (data.retweeted_status) {
      if (unique) {
        this.emit('unique:tweet:retweet', data);
        this.emit('unique:tweet:retweet:' + data.retweeted_status.id_str, data);
      }
      this.emit('tweet:retweet', data, for_user);
      this.emit('tweet:retweet:' + data.retweeted_status.id_str, data, for_user);

    }
    
    // The user has replied directly to a tweet.
    if (data.in_reply_to_status_id_str) {
      if (unique) {
        this.emit('unique:tweet:reply', data);
        this.emit('unique:tweet:reply:' + data.in_reply_to_status_id_str, data);
      }
      this.emit('tweet:reply', data, for_user);
      this.emit('tweet:reply:' + data.in_reply_to_status_id_str, data, for_user);

    }

    // The user has replied to some other tweet of the poll creator.
    if (data.in_reply_to_screen_name) {
      if (unique) {
        this.emit('unique:tweet:mention', data);
        this.emit('unique:tweet:mention:' + data.in_reply_to_screen_name, data);
      }
      this.emit('tweet:mention', data, for_user);
      this.emit('tweet:mention:' + data.in_reply_to_screen_name, data, for_user);

    // The tweet isn't a reply to the creator, but still @mentions the creator
    } else if (data.entities && data.entities.user_mentions) {
      var self = this;

      data.entities.user_mentions.forEach(function(user) {
        if (unique) {
          self.emit('unique:tweet:mention', data);
          self.emit('unique:tweet:mention:' + user.screen_name, data);
        }
        self.emit('tweet:mention', data, for_user);
        self.emit('tweet:mention:' + user.screen_name, data, for_user);
      });
    }
    return;
  }

  // In case we run across something not recognized yet or newly added.
  var err = Error('Unknown message type.');
  if (for_user) {
    err.for_user = for_user;
  }
  err.data = data;
  this.emit('error', err);
};
