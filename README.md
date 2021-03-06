# twice [![Build Status](https://secure.travis-ci.org/poptip/twice.png)](http://travis-ci.org/poptip/twice)

![twitter](https://github.com/poptip/twice/raw/master/Twitter_logo_blue.png)

This module contains several data structures that ease working with [twitter streams](https://dev.twitter.com/streaming/overview). In particular, [site streams](https://dev.twitter.com/streaming/sitestreams). A pool is available that auto manages several site streams as needed and respects twitter's request limits. Includes stream reconnecting with exponential backoff to keep your streams running forever.

# Features

* Limits requests to a set amount per second to avoid being rate limited.
* Reconnect streams on timeout, errors, or disconnects to keep streams running forever.
* Back off linearly or exponentially depending on error type when reconnecting.
* Respect Twitter's limits when adding users to a site stream.
* Make sure users are added to site streams with an extra request.
* If there is an error adding a user to a site stream, retries with exponential backoff.
* Automatically manage a pool of site streams creating new streams as needed.
  * https://dev.twitter.com/streaming/sitestreams#Limits
* Convenient events emitted for various tweet types and stream status updates.
* Uses a streaming JSON parser for faster less memory hogging processing.

Note, connecting to site streams and the firehose require special access, to apply go to
https://dev.twitter.com/streaming/sitestreams#applyingforaccess

# Usage

```js
var Twice = require('twice');

var client = new Twice({
  consumer_key: 'twitter',
  consumer_secret: 'API',
  token: 'keys',
  token_secret: 'go here'
});
var pool = client.createPool();

pool.addUser(...);

pool.on('tweet', function(data) {
  console.log('someone tweeted!');
  console.log(data);
});

pool.on('reply', function(data) {
  console.log('someone replied to a tweet on site streams');
  console.log(data);
});
```

# API

* [new Twice(credentials)](#new-twice)
* [Stream](#stream)
  * [Stream#connected](#stream-connected)
  * [Stream#paused](#stream-paused)
  * [Stream#connect](#stream-connect)
  * [Stream#reconnect](#stream-reconnect)
  * [Stream#pause](#stream-pause)
  * [Stream#resume](#stream-resume)
  * [Stream#destroy](#stream-destroy)
  * [Event: 'connect'](#event-connect)
  * [Event: 'beforeConnect'](#event-beforeconnect)
  * [Event: 'end'](#event-end)
  * [Event: 'destroy'](#event-destroy)
  * [Event: 'timeout'](#event-timeout)
  * [Event: 'retry'](#event-retry)
  * [Event: 'retryMax'](#event-retrymax)
  * [Event: 'data'](#event-data)
  * [Event: 'warning'](#event-warning)
  * [Event: 'delete'](#event-delete)
  * [Event: 'scrub_geo'](#event-scrub_geo)
  * [Event: 'limit'](#event-limit)
  * [Event: 'status_withheld'](#event-status_withheld)
  * [Event: 'user_withheld'](#event-user_withheld)
  * [Event: 'disconnect'](#event-disconnect)
  * [Event: 'shutdown'](#event-shutdown)
  * [Event: 'duplicate stream'](#event-dupliate-stream)
  * [Event: 'control request'](#event-control-request)
  * [Event: 'stall'](#event-stall)
  * [Event: 'normal'](#event-normal)
  * [Event: 'token revoked'](#event-token-revoked)
  * [Event: 'admin logout'](#event-admin-logout)
  * [Event: 'max message limit'](#event-max-message-limit)
  * [Event: 'stream exception'](#event-stream-exception)
  * [Event: 'broker stall'](#event-broker-stall)
  * [Event: 'shed load'](#event-shed-load)
  * [Event: 'tweet'](#event-tweet)
  * [Event: 'tweet:retweet'](#event-tweetretweet)
  * [Event: 'tweet:retweet:`retweeted_status.id`'](#event-tweetretweetretweeted_status_id)
  * [Event: 'tweet:reply'](#event-tweetreply)
  * [Event: 'tweet:reply:`in_reply_to_status_id`'](#event-tweetreplyin_reply_to_status_id)
  * [Event: 'tweet:mention'](#event-tweetmention)
  * [Event: 'tweet:mention:`in_reply_to_screen_name`'](#event-tweetmentionin_reply_to_screen_name)
* [Twice#createPublicStream([parameters])](#twicecreatepublicstreamparameters)
  * [PublicStream#track(value)](#publicstreamtrackphrase)
  * [PublicStream#untrack(value)](#publicstreamuntrackphrase)
  * [PublicStream#tracking(value)](#publicstreamtrackingphrase)
  * [PublicStream#trackCount](#publicstreamtrackcount)
* [Twice#createSampleStream([parameters])](#twicecreatesamplestreamparameters)
* [Twice#createFirehose([parameters])](#twicecreatefirehoseparameters)
* [Twice#createUserStream([parameters])](#twicecreateuserstreamparameters)
  * [UserStream#track(value)](#userstreamtrackvalue)
  * [UserStream#untrack(value)](#userstreamuntrackvalue)
  * [UserStream#tracking(value)](#publicstreamtrackingvalue)
  * [UserStream#trackCount](#publicstreamtrackcount)
  * [UserStream#follow(twitterID)](#userstreamfollowtwitterid)
  * [UserStream#unfollow(twitterID)](#userstreamunfollowtwitterid)
  * [UserStream#following(value)](#publicstreamfollowingtwitterid)
  * [UserStream#followCount](#publicstreamfollowcount)
  * [Event: 'friends'](#event-friends)
  * [Event: 'block'](#event-block)
  * [Event: 'unblock'](#event-unblock)
  * [Event: 'favorite'](#event-favorite)
  * [Event: 'unfavorite'](#event-unfavorite)
  * [Event: 'follow'](#event-follow)
  * [Event: 'list_created'](#event-list_created)
  * [Event: 'list_destroyed'](#event-list_destroyed)
  * [Event: 'list_updated'](#event-list_updated)
  * [Event: 'list_member_add'](#event-list_member_add)
  * [Event: 'list_member_remove'](#event-list_member_remove)
  * [Event: 'list_user_subscribe'](#event-list_user_subscribe)
  * [Event: 'list_user_unsubscribe'](#event-list_user_unsubscribe)
  * [Event: 'user_update'](#event-user_update)
* [Twice#createSiteStream([follow], [parameters])](#twicecreatesitestreamfollow-parameters)
  * [SiteStream#addUser(twitterID)](#sitestreamaddusertwitterid)
  * [SiteStream#addUsers(twitterIDs)](#sitestreamadduserstwitterids)
  * [SiteStream#removeUser(twitterID, [callback(err)])](#sitestreamremoveusertwitterid-callbackerr)
  * [SiteStream#users](#sitestreamusers)
  * [SiteStream#usersInStream](#sitestreamusersinstream)
  * [SiteStream#usersInQueue](#sitestreamusersinqueue)
  * [SiteStream#failedToAddUsers](#sitestreamfailedtoaddusers)
  * [SiteStream#hasUser(twitterID)](#sitestreamhasusertwitterid)
  * [SiteStream#hasUserInStream(twitterID)](#sitestreamhasuserinstreamtwitterid)
  * [SiteStream#hasUserInQueue(twitterID)](#sitestreamhasuserinqueuetwitterid)
  * [SiteStream#info(callback(err, info))](#sitestreaminfocallbackerr-info)
  * [Event: 'unique:tweet'](#event-uniquetweet)
  * [Event: 'addUsersToQueue'](#event-adduserstoqueue)
  * [Event: 'addUsersToStream'](#event-adduserstostream)
  * [Event: 'failedToAddUsers'](#event-failedtoaddusers)
  * [Event: 'removeUser'](#event-removeuser)
* [Twice#createPool(parameters)](#twicecreatepoolparameterss)
  * [Pool#addUser(twitterID)](#pooladdusertwitterid)
  * [Pool#addUsers(twitterIDs)](#pooladduserstwitterids)
  * [Pool#removeUser(twitterID)](#poolremoveusertwitterid)
  * [Pool#users](#poolusers)
  * [Pool#usersInStream](#poolusersinstream)
  * [Pool#usersInQueue](#poolusersinqueue)
  * [Pool#failedToAddUsers](#poolfailedtoaddusers)
  * [Pool#hasUser(twitterID)](#poolhasusertwitterid)
  * [Pool#hasUserInStream(twitterID)](#poolhasuserinstreamtwitterid)
  * [Pool#hasUserInQueue(twitterID)](#poolhasuserinqueuetwitterid)
  * [Pool#simulate(tweet, [twitterID])](#poolsimulatetweet-twitterid)
  * [Pool#createSiteStream(twitterIDs, [parameters])](#poolcreatesitestreamtwitterids-parameters)
  * [Pool#createPublicStream([parameters])](#poolcreatepublicstreamparameters)
  * [Pool#createSampleStream([parameters])](#poolcreatesamplestreamparameters)
  * [Pool#createFirehose([parameters])](#poolcreatefirehoseparameters)
  * [Pool#createUserStream([parameters])](#poolcreateuserstreamparameters)
* [Twice#get(options, callback(err, data))](#twicegetoptions-callbackerr-data)
* [Twice#post(url, body, callback(err, data))](#twiceposturl-body-callbackerr-data)
* [Twice#getTimeline(url, [parameters], [callback(err, tweets)])](#twicegettimelineurl-parameters-callbackerr-tweets)

### new Twice(credentials)

First argument must be an object with oauth credentials.

```js
{
  consumer_key: 'twitter',
  consumer_secret: 'API',
  token: 'keys',
  token_secret: 'go here'
}
```

All methods added are specifically designed to facilitate usage of Twitter streams.

All streams have a `connected` key indicating if the stream is currently connected. Constructors last argument can be an object of parameters.

### Stream
Twice creates several types of streams. They all have the following properties, methods, and events.

### Stream#connected
Wether or not the stream is connected.

### Stream#paused
Wether or not the stream is paused.

### Stream#connect()
Connect stream. Automatically called when streams are created.

### Stream#reconnect()
Reconnect stream.

### Stream#pause()
Pause the stream if not already paused.

### Stream#resume()
Resume the stream if paused.

### Stream#destroy()
Destroy the stream manually. It will disconnect and will not attempt to reconnect.

### Events
All streams emit the following events.

### Event: 'connect'

Stream has connected. This is also emitted if it's a reconnection.

### Event: 'beforeConnect'

Emitted right before a connection is attempted.

### Event: 'end'

Stream was disconnected.

### Event: 'destroy'

Stream was destroyed.

### Event: 'timeout'

Stream has timed out and will be reconnecting soon.

### Event: 'retry'
* `String` - Algorithm. Either `linear` or `exponential`.
* `String` - Method.
* `number` - Milliseconds until next retry.
* `number` - Amount of attempts the method has been retried without success.
* `number` - Total number of retries.

There was an error calling a method. This indicates the method will be called again.

### Event: 'retryMax'
* `String` - Algorithm. Either `linear` or `exponential`.
* `String` - Method. So far only `reconnect` and `addUsers` are retried.

This is emitted if the maximum retry is reached for a method with a certain algorithm. At which point you can pause the stream or whatever until you figure out what went wrong.

### Event: 'data'
* `Object` - Contains all of the data from the message received.

This event is emitted every time a full JSON object is received from twitter. Useful for debugging.

### Event: 'warning'
* `String` - Code, ex: `FALLING_BEHIND` or `FOLLOWS_OVER_LIMIT`.
* `String` - Message.
* `number` - Queue full percentage or user id.

Emitted when the client has to be warned about something.

### Event: 'delete'
* `String` - ID of status to delete.
* `String` - User for which status belongs to.

These messages indicate that a given Tweet has been deleted. Client code must honor these messages by clearing the referenced Tweet from memory and any storage or archive, even in the rare case where a deletion message arrives earlier in the stream that the Tweet it references.

### Event: 'scrub_geo'
* `String` - The ID of the user.
* `String` - Up to which status to scrub geo info from.

These messages indicate that geolocated data must be stripped from a range of Tweets. Clients must honor these messages by deleting geocoded data from Tweets which fall before the given status ID and belong to the specified user. These messages may also arrive before a Tweet which falls into the specified range, although this is rare.

### Event: 'limit'
* `number` - Number of undelivered tweets.

These messages indicate that a filtered stream has matched more Tweets than its current rate limit allows to be delivered. Limit notices contain a total count of the number of undelivered Tweets since the connection was opened, making them useful for tracking counts of track terms, for example. Note that the counts do not specify which filter predicates undelivered messages matched.

### Event: 'status_withheld'
* `String` - ID of status.
* `String` - ID of user.
* `Array.<String>` - An array of two-letter countries codes. Example: `['de', 'ar']`

Indicates a status has been withheld in certain countries.

### Event: 'user_withheld'
* `String` - ID of user.
* `Array.<String>` - An array of two-letter country codes.

Indicates a user has been withheld in certain countries.

### Event: 'disconnect'
* `Number` - Code of the event.
* `String` - Reason.
* `String` - Stream name.
* `String` - Twitter handle for which the stream belongs to.

Stream was disconnected for a [variety of reasons](https://dev.twitter.com/streaming/overview/messages-types#disconnect_messages). For each possible reason documented, events below are also emitted.

### Event: 'shutdown'
* `String` - Stream name.
* `String` - Twitter handle for which the stream belongs to.

The feed was shutdown (possibly a machine restart).

### Event: 'duplicate stream'
* `String` - Stream name.
* `String` - Twitter handle for which the stream belongs to.

The same endpoint was connected too many times.

### Event: 'control request'
* `String` - Stream name.
* `String` - Twitter handle for which the stream belongs to.

Control streams was used to close a stream (applies to sitestreams).

### Event: 'stall'
* `String` - Stream name.
* `String` - Twitter handle for which the stream belongs to.

The client was reading too slowly and was disconnected by the server.

### Event: 'normal'
* `String` - Stream name.
* `String` - Twitter handle for which the stream belongs to.

The client appeared to have initiated a disconnect.

### Event: 'token revoked'
* `String` - Twitter handle.
* `String` - Stream name.
* `String` - Twitter handle for which the stream belongs to.

An oauth token was revoked for a user (applies to site and userstreams).

### Event: 'admin logout'
* `String` - Stream name.
* `String` - Twitter handle for which the stream belongs to.

The same credentials were used to connect a new stream and the oldest was disconnected.

### Event: 'max message limit'
* `String` - Stream name.
* `String` - Twitter handle for which the stream belongs to.

The stream connected with a negative count parameter and was disconnected after all backfill was delivered.

### Event: 'stream exception'
* `String` - Stream name.
* `String` - Twitter handle for which the stream belongs to.

An internal issue disconnected the stream.

### Event: 'broker stall'
* `String` - Stream name.
* `String` - Twitter handle for which the stream belongs to.

An internal issue disconnected the stream.

### Event: 'shed load'
* `String` - Stream name.
* `String` - Twitter handle for which the stream belongs to.

The host the stream was connected to became overloaded and streams were disconnected to balance load. Reconnect as usual.

### Tweets

All streams and timelines will emit the following events.

### Event: 'tweet'
* [tweet][tweet]

Someone tweets!

### Event: 'tweet:retweet'
* [tweet][tweet]

Someone retweets.

### Event: 'tweet:retweet:`retweeted_status.id`'
* [tweet][tweet]

Convenient event for listening for retweets of a certain tweet.

### Event: 'tweet:reply'
* [tweet][tweet]

Someone replied to a tweet.

### Event: 'tweet:reply:`in_reply_to_status_id`'
* [tweet][tweet]

Convenient event for listening for replies of a certain tweet.

### Event: 'tweet:mention'
* [tweet][tweet]

Someone replied to another user. Emitted even if the user is mentioned manually.

### Event: 'tweet:mention:`in_reply_to_screen_name`'
* [tweet][tweet]

Convenient event for listening for replies to a certain user.


### Twice#createPublicStream([parameters])
Create an instance of a [public stream](https://dev.twitter.com/streaming/reference/post/statuses/filter).

### PublicStream#track(phrase)
Track a phrase with this stream. Will reconnect stream.

### PublicStream#untrack(phrase)
Untrack a phrase. Will reconnect stream.

### PublicStream#tracking(phrase)
Returns true if this stream is tracking the phrase.

### PublicStream#trackCount
The amount of phrases being tracked by this stream.

### PublicStream#trackList
The phrases being tracked.

### Twice#createSampleStream([parameters])
Create an instance of a [sample stream](https://dev.twitter.com/streaming/reference/get/statuses/sample). Emits random sample of public statuses.

### Twice#createFirehose([parameters])
Create an instance of a [firehose](https://dev.twitter.com/streaming/firehose). Emits all public tweets. Requires special permission to use.

### Twice#createUserStream([parameters])
Create an instance of a [user stream](https://dev.twitter.com/streaming/userstreams).

### UserStream#track(phrase)
Track a phrase with this stream. Will reconnect stream.

### UserStream#untrack(phrase)
Untrack a phrase. Will reconnect stream.

### UserStream#tracking(phrase)
Returns true if this stream is tracking the phrase.

### UserStream#trackCount()
The amount of phrases being tracked by this stream.

### UserStream#follow(twitterID)
Follow a user's timeline with this stream. Will reconnect stream.

### UserStream#unfollow(twitterID)
Unfollow user's timeline. Will reconnect stream.

### UserStream#following(twitterID)
Returns true if this stream is following the twitter ID.

### UserStream#followCount
The amount of twitter IDs being followed by this stream.

### UserStream#followList
The list of twitter IDs being followed.

### Event: 'friends'
* `Array.<String>` - An array of Twitter IDs.

Upon establishing a User Stream connection, Twitter will send a preamble before starting regular message delivery. This preamble contains a list of the user's friends. 

### Event: 'block'
* [user][user] - Current user.
* [user][user] - Blocked user.
* `Date` - Created at date.

User blocks someone.

### Event: 'unblock'
* [user][user] - Current user.
* [user][user] - Blocked user.
* `Date` - Created at date.

User removes a block.

### Event: 'favorite'
* [user][user] - User that favorited the tweet.
* [user][user] - Author of the tweet.
* [tweet][tweet] - Favorited tweet.
* `Date` - Created at date.

User favorites a tweet.

### Event: 'unfavorite'
* [user][user] - User that favorited the tweet.
* [user][user] - Author of the tweet.
* [tweet][tweet] - Favorited tweet.
* `Date` - Created at date.

User unfavorites a tweet.

### Event: 'follow'
* [user][user] - Following user.
* [user][user] - Followed user.
* `Date` - Created at date.

User follows someone.

### Event: 'list_created'
* `list`
* `Date` - Created at date.

User creates a list.

### Event: 'list_destroyed'
* `list`
* `Date` - Created at date.

User deletes a list.

### Event: 'list_updated'
* `list`
* `Date` - Created at date.

User edits a list.

### Event: 'list_member_add'
* [user][user] - Adding user.
* [user][user] - Added user.
* `list`
* `Date` - Created at date.

User adds someone to a list.

### Event: 'list_member_remove'
* [user][user] - Removing user.
* [user][user] - Removed user.
* `list`
* `Date` - Created at date.

User removes someone from a list.

### Event: 'list_user_subscribe'
* [user][user] - Subscribing user.
* [user][user] - List owner.
* `list`
* `Date` - Created at date.

User subscribes to a list.

### Event: 'list_user_unsubscribe'
* [user][user] - Unsubscribing user.
* [user][user] - List owner.
* `list`
* `Date` - Created at date.

User unsubscribes from a list.

### Event: 'user_update'
* [user][user] - New profile data.
* `Date` - Created at date.

User updates their profile.


### Twice#createSiteStream([follow], [parameters])
Create an instance of a site stream. `follow` can be an Array of twitter IDs to initially add to the stream when it first connects. If `follow` has more users than the allowed users to connect with, they will be queued to be added later. [See here](https://dev.twitter.com/streaming/sitestreams) for a list of parameters. Access is restricted.

### SiteStream#addUser(twitterID)
Add a user to the stream.

### SiteStream#addUsers(twitterIDs)
Add several users to the stream.

### SiteStream#removeUser(twitterID, [callback(err)])
Remove a user from the stream.

### SiteStream#users
List of users in stream, including the number of queued users that are going to be added to the stream.

### SiteStream#usersInStream
List of users that are currently being listened to by the stream.

### SiteStream#usersInQueue
List of users that will be added to the stream.

### SiteStream#failedToAddUsers
List of users that were not successfully added to the stream.

### SiteStream#hasUser(twitterID)
Returns true if user is in site stream.

### SiteStream#hasUserInStream(twitterID)
Returns true if user is being listened to.

### SiteStream#hasUserInQueue(twitterID)
Returns true if users is in queue.

### SiteStream#info(callback(err, info))
Gets information about the stream from twitter. Sample:

```js
{
    "info":
    {
        "users":
        [
            {
                "id":119476949,
                "name":"oauth_dancer",
                "dm":false
            }
        ],
        "delimited":"none",
        "include_followings_activity":false,
        "include_user_changes":false,
        "replies":"none",
        "with":"user"
    }
}
```

### Events
Site streams receive the same events as user streams. But for multiple users instead of one. To identify which user an event belongs to, each event includes a user's ID appended to the arguments. Except for the events: `connect`, `reconnect`, `disconnect`, `destroy`, `retry`, `retryMax`, `data`, and `tweet`. 

For example, the event `friends` would be emitted like this: `function (friends, userid) { }`.

In addition, an event with the user's Twittter ID appended to the event name is emitted. For user with an ID of `1234` the event `friends:1234` would be emitted with `friends` as the first argument.

### Event: 'unique:tweet'
* [tweet][tweet]

A unique Tweet. Tweets are compared for uniqueness by the `id_str` property. The rest of the Tweet events will also have an alias with `unique:` prepended if they are unique. For example: `unique:tweet:retweet`.

### Event: 'addUsersToQueue'
* `Array.<String>` - Array of Twitter IDs.

Emitted when users are added to the stream's queue, eventually will be attempted to added to the stream using the add user control endpoint. At which point each of the twitter IDs will be in either the `addUsersToStream` or `failedToAddUsers` events.

### Event: 'addUsersToStream'
* `Array.<String>` - Array of Twitter IDs.
* `Object` - Contains Twitter IDs as keys with their respective screen names as values.

When a batch of users are successfully added to this site stream. Users are checked that they've been actually added using the `SiteStream#info()` method.

### Event: 'failedToAddUsers'
* `Array.<String>` - Array of Twitter IDs.

If there was a user did not show up in the `SiteStream#info()` call after sending a request to add that user, they will show up here.

### Event: 'removeUser'
* `String` - User ID.

After a call to `SiteStream#remove()`, either this or an `error` event will be emitted, even if a callback was given to the method.

A user has revoked access to your app.

### Twice#createPool([parameters])
Creates an instance of a site stream pool. Automatically creates and removes site streams as needed respecting twitter's request demands. `parameters` is passed to the created site streams.

### Pool#addUser(twitterID)
Adds a user to the pool.

### Pool#addUsers(twitterIDs)
Add several users to the pool at once.

### Pool#removeUser(twitterID)
Remove a user from pool.

### Pool#users
List of users in pool.

### Pool#usersInStream
List of users in pool that are actively being listened to.

### Pool#usersInStreamHash
Object with user ids and usernames as keys and values respectively.

### Pool#usersInQueue
List of users in pool which are queued to be added to a stream.

### Pool#failedToAddUsers
List of users that were not successfully added to a stream.

### Pool#hasUser(twitterID)
Returns true if user has been added to pool.

### Pool#hasUserInStream(twitterID)
Returns true if user is currently being listened to on a stream..

### Pool#hasUserInQueue(twitterID)
Returns true if user has been queued to be added to a stream.

### Pool#simulate(tweet, [twitterID])
Simulates a tweet coming in from twitter. Useful if you get tweets through the REST API and want to emit it through the pool.

### Pool#createSiteStream(twitterIDs, [parameters])
Create an instance of a site stream. These will be automatically created as users are added with `Pool#addUser()` and `Pool#addUsers()` methods.

### Pool#createPublicStream([parameters])
Create an instance of a public stream and route its events to the pool.


### Pool#createSampleStream([parameters])
Create an instance of a sample stream and route its events to the pool.


### Pool#createFirehose([parameters])
Create an instance of a firehose and route its events to the pool.


### Pool#createUserStream([parameters])
Create an instance of a user stream and route its events to the pool.

### Events
Pool instances are proxied all events from all underlying site stream instances.

### Twice#get(options, callback(err, data))
Make a GET request. `options` can be a url or a [request](https://github.com/mikeal/request) options. 

### Twice#post(url, [body], callback(err, data))
Make a POST request. `body` can be a string or an object.

### Twice#getTimeline(url, [parameters], [callback(err, tweets)])
Twice provides added sugar for getting timelines. The `parameters.count` option is capped at 200. But if it's above that, Twice will keep requesting more tweets until the given count is reached.

If you don't want to buffer all of the tweets, it returns an event emitter that will emit 

# Response Objects

Several events emit different response objects. You'll find examples of what they look like and what each field represents [here](https://dev.twitter.com/overview/api "twitter objects").

[tweet]: https://dev.twitter.com/overview/api/tweets
[user]: https://dev.twitter.com/overview/api/users

# Tests
Tests are written with [nodeunit](https://github.com/caolan/nodeunit)

```bash
npm test
```

# Links

* https://dev.twitter.com/streaming/overview
* https://dev.twitter.com/overview/api
* https://dev.twitter.com/overview/general/things-every-developer-should-know
