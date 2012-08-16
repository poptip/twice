# stweam

![tweety](https://github.com/markover/stweam/raw/master/tweety.gif)

This module contains several data structures that ease working with twitter streams. In particular, a site stream pool is available that auto manages several site streams as needed and respects twitter's request limits. Includes stream reconnecting with exponential backoff to keep your streams running forever.

# Features

* Limits requests to a set amount per second to avoid being rate limited.
* Reconnect streams on timeout, errors, or disconnects.
* Back off linearly or exponentially depending on error type when reconnecting.
* Respect Twitter's limits when adding users to a site stream.
* Make sure users are added to site streams with an extra request.
* If there is an HTTP error adding a user to a site stream, retries with exponential timeouts.
* Automatically manage a pool of site streams creating new streams as needed.
* Convenient events emitted for various tweet types.
* Uses a streaming JSON parser for faster less memory hogging processing.

# Usage

```js
var Stweam = require('stweam');

var client = new Stweam({
  consumer_key: 'twitter',
  consumer_secret: 'API',
  access_token_key: 'keys',
  access_token_secret: 'go here'
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

* [new Stweam(credentials)](#new_stweam)
* [Event: 'connect'](#event_connect)
* [Event: 'beforeConnect'](#event_beforeConnect)
* [Event: 'reconnect'](#event_reconnect)
* [Event: 'disconnect'](#event_disconnect)
* [Event: 'destroy'](#event_destroy)
* [Event: 'timeout'](#event_timeout)
* [Event: 'retry'](#event_retry)
* [Event: 'retryMax'](#event_retryMax)
* [Event: 'data'](#event_data)
* [Event: 'warning'](#limit_warning)
* [Event: 'delete'](#limit_delete)
* [Event: 'scrub_geo'](#limit_scrub_geo)
* [Event: 'limit'](#event_limit)
* [Event: 'status_withheld'](#event_status_withheld)
* [Event: 'user_withheld'](#event_user_withheld)
* [Event: 'tweet'](#event_tweet)
* [Event: 'tweet:retweet'](#event_tweet_retweet)
* [Event: 'tweet:retweet:`retweeted_status.id`'](#event_tweet_retweet_retweeted_status_id)
* [Event: 'tweet:reply'](#event_tweet_reply)
* [Event: 'tweet:reply:`in_reply_to_status_id`'](#event_tweet_reply_in_reply_to_status_id)
* [Event: 'tweet:@reply'](#event_at_reply)
* [Event: 'tweet:@reply:`in_reply_to_screen_name`'](#event_at_reply_in_reply_to_screen_name)
* [Stweam#createPublicStream([parameters])](#publicstream)
* [Stweam#createSampleStream([parameters])](#samplestream)
* [Stweam#createFirehose([parameters])](#firehose)
* [Stweam#createUserStream([parameters])](#userstream)
  * [Event: 'friends'](#event_friends)
  * [Event: 'block'](#event_block)
  * [Event: 'unblock'](#event_unblock)
  * [Event: 'favorite'](#event_favorite)
  * [Event: 'unfavorite'](#event_unfavorite)
  * [Event: 'follow'](#event_follow)
  * [Event: 'list_create'](#event_list_create)
  * [Event: 'list_destroy'](#event_list_destroy)
  * [Event: 'list_update'](#event_list_update)
  * [Event: 'list_member_add'](#event_list_member_add)
  * [Event: 'list_member_remove'](#event_list_member_remove)
  * [Event: 'list_user_subscribe'](#event_list_user_subscribe)
  * [Event: 'list_user_unsubscribe'](#event_list_user_unsubscribe)
  * [Event: 'user_update'](#event_user_update)
* [Stweam#createSiteStream([follow], [parameters])](#sitestream)
  * [SiteStream#addUser(twitterID)](#sitestream_addUser)
  * [SiteStream#addUsers(twitterIDs)](#sitestream_addUsers)
  * [SiteStream#removeUser(twitterID, [callback(err)])](#sitestream_removeUser)
  * [SiteStream#userCount()](#sitestream_userCount)
  * [SiteStream#hasUser(twitterID)](#sitestream_hasUser)
  * [SiteStream#info(callback(err, info))](#sitestream_info)
  * [Event: 'addUsers'](#event_addUsers)
  * [Event: 'failedToAdd'](#event_failedToAdd)
  * [Event: 'removeUser'](#event_removeUser)
* [Stweam#createPool(options)](#pool)
  * [Pool#addUser(twitterID, queue)
  * [Pool#addUsers(twitterIDs)
  * [Pool#removeUser(twitterID)
  * [Pool#hasUser(twitterID)

<a name="new_stweam" />
### new Stweam(credentials)

First argument must be an object with oauth credentials.

```js
{
  consumer_key: 'twitter',
  consumer_secret: 'API',
  access_token_key: 'keys',
  access_token_secret: 'go here'
}
```

Stweam currently extends the [ntwitter](https://github.com/AvianFlu/ntwitter) library. All methods added are specifically designed to facilitate usage of Twitter streams.

All streams have a `connected` key indicating if the stream is currently connected. Constructors last argument can be an object of parameters. [See here](https://dev.twitter.com/docs/api/2/get/user) for a list of parameters and their descriptions.

### Events
All streams emit the following events.

<a name="event_connect" />
### Event: 'connect'

Stream has connected. This is also emitted if it's a reconnection.

<a name="event_beforeConnect" />
### Event: 'beforeConnect'

Emitted right before a connection is made.

<a name="event_reconnect" />
### Event: 'reconnect'

Emitted right before a reconnection is made.

<a name="event_disconnect" />
### Event: 'disconnect'

Stream was disconnected.

<a name="event_destroy" />
### Event: 'destroy'

Stream was destroyed.

<a name="event_timeout" />
### Event: 'timeout'

Stream has timed out and will be reconnecting soon.

<a name="event_retry" />
### Event: 'retry'
* `string` - Algorithm. Either `linear` or `exponential`.
* `string` - Method.
* `number` - Milliseconds until next retry.
* `number` - Amount of attempts the method has been retried without success.
* `number` - Total number of retries.

There was an error calling a method. This indicates the method will be called again.

<a name="event_retryMax" />
### Event: 'retryMax'
* `string` - Algorithm. Either `linear` or `exponential`.
* `string` - Method. So far only `reconnect` and `addUsers` are retried.

This is emitted if the maximum retry is reached for a method with a certain algorithm. At which point you can pause the stream or whatever until you figure out what went wrong.

<a name="event_data" />
### Event: 'data'
* `Object` - Contains all of the data from the message received.

This event is emitted every time a full JSON object is received from twitter. Useful for debugging.

<a name="event_warning" />
### Event: 'warning'
* `string` - Code, ex: `FALLING_BEHIND`.
* `string` - Message.
* `number` - Queue full percentage.

Emitted when the client is falling behind on reading tweets. Will occur a maximum of about once in 5 minutes. It really should not happen because this is node, come on.

<a name="event_delete" />
### Event: 'delete'
* `number` - ID of status to delete.
* `number` - User for which status belongs to.

These messages indicate that a given Tweet has been deleted. Client code must honor these messages by clearing the referenced Tweet from memory and any storage or archive, even in the rare case where a deletion message arrives earlier in the stream that the Tweet it references.

<a name="event_scrub_geo" />
### Event: 'scrub_geo'
* `string` - The ID of the user.
* `string` - Up to which status to scrub geo info from.

These messages indicate that geolocated data must be stripped from a range of Tweets. Clients must honor these messages by deleting geocoded data from Tweets which fall before the given status ID and belong to the specified user. These messages may also arrive before a Tweet which falls into the specified range, although this is rare.

<a name="event_limit" />
### Event: 'limit'
* `number` - Number of undelivered tweets.

These messages indicate that a filtered stream has matched more Tweets than its current rate limit allows to be delivered. Limit notices contain a total count of the number of undelivered Tweets since the connection was opened, making them useful for tracking counts of track terms, for example. Note that the counts do not specify which filter predicates undelivered messages matched.

<a name="event_status_withheld" />
### Event: 'status_withheld'
* `string` - ID of status.
* `string` - ID of user.
* `Array.string` - An array of two-letter countries codes. Example: `['de', 'ar']`

Indicates a status has been withheld in certain countries.

<a name="event_user_withheld" />
### Event: 'user_withheld'
* `string` - ID of user.
* `Array.string` - An array of two-letter country codes.

Indicates a user has been withheld in certain countries.

<a name="event_tweet" />
### Event: 'tweet'
* [tweet](#tweet)

Someone tweets!

<a name="event_tweet_retweet" />
### Event: 'tweet:retweet'
* [tweet](#tweet)

Someone retweeted a tweet. Only emitted when it's a retweet through the API and not a manual retweet ie `RT: hello world`.

<a name="event_tweet_retweet_retweeted_status_id" />
### Event: 'tweet:retweet:`retweeted_status.id`'
* [tweet](#tweet)

Convenient event for listening for retweets of a certain tweet.

<a name="event_tweet_reply" />
### Event: 'tweet:reply'
* [tweet](#tweet)

Someone replied to a tweet.

<a name="event_tweet_reply_in_reply_to_status_id" />
### Event: 'tweet:reply:`in_reply_to_status_id`'
* [tweet](#tweet)

Convenient event for listening for replies of a certain tweet.

<a name="event_at_tweet" />
### Event: 'tweet:@reply'
* [tweet](#tweet)

Someone replied to another user. Emitted even if the user is mentioned manually.

<a name="event_at_tweet_in_reply_to_screen_name" />
### Event: 'tweet:@reply:`in_reply_to_screen_name`'
* [tweet](#tweet)

Convenient event for listening for replies to a certain user.


<a name="publicstream" />
### Stweam#createPublicStream([parameters])
Create an instance of a public stream.


<a name="samplestream" />
### Stweam#createSampleStream([parameters])
Create an instance of a sample stream. Emits random sample of public statuses.


<a name="firehose" />
### Stweam#createFirehose([parameters])
Create an instance of a firehose. Emits all public tweets. Requires special permission to use.


<a name="userstream" />
### Stweam#createUserStream([parameters])
Create an instance of a user stream. [See here](https://dev.twitter.com/docs/api/2/get/user) for a list of parameters.

<a name="event_friends" />
### Event: 'friends'
* `Array.string` - An array of user IDs.

Upon establishing a User Stream connection, Twitter will send a preamble before starting regular message delivery. This preamble contains a list of the user's friends. 

<a name="event_block" />
### Event: 'block'
* [user](#user) - Current user.
* [user](#user) - Blocked user.
* `Date` - Created at date.

User blocks someone.

<a name="event_unblock" />
### Event: 'unblock'
* [user](#user) - Current user.
* [user](#user) - Blocked user.
* `Date` - Created at date.

User removes a block.

<a name="event_favorite" />
### Event: 'favorite'
* [user](#user) - User that favorited the tweet.
* [user](#user) - Author of the tweet.
* [tweet](#tweet) - Favorited tweet.
* `Date` - Created at date.

User favorites a tweet.

<a name="event_unfavorite" />
### Event: 'unfavorite'
* [user](#user) - User that favorited the tweet.
* [user](#user) - Author of the tweet.
* [tweet](#tweet) - Favorited tweet.
* `Date` - Created at date.

User unfavorites a tweet.

<a name="event_follow" />
### Event: 'follow'
* [user](#user) - Following user.
* [user](#user) - Followed user.
* `Date` - Created at date.

User follows someone.

<a name="event_list_create" />
### Event: 'list_create'
* `list`
* `Date` - Created at date.

User creates a list.

<a name="event_list_destroy" />
### Event: 'list_destroy'
* `list`
* `Date` - Created at date.

User deletes a list.

<a name="event_list_update" />
### Event: 'list_update'
* `list`
* `Date` - Created at date.

User edits a list.

<a name="event_list_member_add" />
### Event: 'list_member_add'
* [user](#user) - Adding user.
* [user](#user) - Added user.
* `list`
* `Date` - Created at date.

User adds someone to a list.

<a name="event_list_member_remove" />
### Event: 'list_member_remove'
* [user](#user) - Removing user.
* [user](#user) - Removed user.
* `list`
* `Date` - Created at date.

User removes someone from a list.

<a name="event_list_user_subscribe" />
### Event: 'list_user_subscribe'
* [user](#user) - Subscribing user.
* [user](#user) - List owner.
* `list`
* `Date` - Created at date.

User subscribes to a list.

<a name="event_list_user_unsubscribe" />
### Event: 'list_user_unsubscribe'
* [user](#user) - Unsubscribing user.
* [user](#user) - List owner.
* `list`
* `Date` - Created at date.

User unsubscribes from a list.

<a name="event_user_update" />
### Event: 'user_update'
* [user](#user) - New profile data.
* `Date` - Created at date.

User updates their profile.


<a name="sitestream" />
### Stweam#createSiteStream([follow], [parameters])
Create an instance of a site stream. `follow` can be an Array of twitter IDs to initially add to the stream when it first connects. If `follow` has more users than the allowed users to connect with, they will be queued to be added later. [See here](https://dev.twitter.com/docs/api/2b/get/site) for a list of parameters. Access is restricted.

<a name="sitestream_addUser" />
### SiteStream#addUser(twitterID)
Add a user to the stream.

<a name="sitestream_addUsers" />
### SiteStream#addUsers(twitterIDs)
Add several users to the stream.

<a name="sitestream_removeUser" />
### SiteStream#removeUser(twitterID, [callback(err)])
Remove a user from the stream.

<a name="sitestream_userCount" />
### SiteStream#userCount()
Returns the number of users in stream, including the number of queued users that are going to be added to the stream.

<a name="sitestream_hasUser" />
### SiteStream#hasUser(twitterID)
Returns true if user is in site stream.

<a name="sitestream_info" />
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
Site streams receive the same events as user streams. But for multiple users instead of one. To identify which user an event belongs to, each event includes a user's ID as the first argument. Except for the events: `connect', `reconnect`, `disconnect`, `destroy`, `retry`, `retryMax`, `data`, and `tweet`. 

For example, the event `friends` would be emitted like this: `function (userid, friends) { }`.

In addition, an event with the user's Twittter ID appended to the event name is emitted. For user with an ID of `1234` the event `friends:1234` would be emitted with `friends` as the first argument.

<a name="event_addUsers" />
### Event: 'addUsers'
* `Array.string` - Array of user IDs.
* `Object` - Contains user IDs as keys with their respective screen names as values.

When a batch of users are successfully added to this site stream. Users are checked that they've been actually added using the `SiteStream#info()` method.

<a name="event_failedToAdd" />
### Event: 'failedToAdd'
* `Array.string` - Array of user IDs.

If there was a user did not show up in the `SiteStream#info()` call after sending a request to add that user, they will show up here.

<a name="event_removeUser" />
### Event: 'removeUser'
* `string` - User ID.

After a call to `SiteStream#remove()`, either this or an `error` event will be emitted, even if a callback was given to the method.


<a name="pool" />
### Stweam#createPool([options])
Creates an instance of a site stream pool. Automatically creates and removes site streams as needed respecting twitter's request demands. `client` must be an instance of ntwitter. Options defaults to

```js
{
  // amount of time to wait when adding users in order to add more
  // together in one request
  addUserTimeout: 1000
}
```

<a name="pool_addUser" />
### Pool#addUser(twitterID, queue)
Adds a user to the pool. Set `queue` to true if you want to queue this user to be added after `options.addUserTimeout` in case there might be more users in the queue later. This saves making unnecessary requests to twitter.

<a name="pool_addUsers" />
### Pool#addUsers(twitterIDs)
Add several users to the pool at once.

<a name="pool_removeUser" />
### Pool#removeUser(twitterID)
Remove a user from pool.

<a name="pool_hasUser" />
### Pool#hasUser(twitterID)
Returns true if user has been added to pool.

### Events
Pool instances are proxied all events from all underlying site stream instances.


# Response Objects

Several events emit different response objects. Here you'll find examples of what they look like. [Go here](https://dev.twitter.com/docs/platform-objects "twitter objects") to read more details about each field in the objects.

<a name="user" />
### [User](https://dev.twitter.com/docs/platform-objects/users)

```js
{
  "id" : 92572086,
  "screen_name" : "StudyTravelNL",
  "verified" : false,
  "profile_sidebar_fill_color" : "ffffff",
  "location" : "Nijmegen, Nederland",
  "statuses_count" : 481,
  "default_profile" : false,
  "contributors_enabled" : false,
  "following" : true,
  "geo_enabled" : true,
  "profile_background_color" : "610e44",
  "utc_offset" : null,
  "time_zone" : null,
  "name" : "StudyTravel Talen",
  "show_all_inline_media" : false,
  "listed_count" : 2,
  "protected" : false,
  "profile_background_image_url" : "http://a0.twimg.com/profile_background_images/398762728/Brochure_2012-2013.JPG",
  "friends_count" : 101,
  "notifications" : false,
  "profile_link_color" : "82b7f0",
  "is_translator" : false,
  "profile_use_background_image" : false,
  "description" : "Een taal beleven is meer dan studeren. Je verdiept je in de taal, cultuur en gewoonten van een ander land. Wie wil er niet op zo'n 'spraakmakende' taalreis!",
  "profile_text_color" : "08090a",
  "profile_image_url_https" : "https://si0.twimg.com/profile_images/1225384939/StudyTravel_Taalreizen_NL_normal.JPG",
  "id_str" : "92572086",
  "profile_background_image_url_https" : "https://si0.twimg.com/profile_background_images/398762728/Brochure_2012-2013.JPG",
  "default_profile_image" : false,
  "profile_image_url" : "http://a0.twimg.com/profile_images/1225384939/StudyTravel_Taalreizen_NL_normal.JPG",
  "follow_request_sent" : false,
  "lang" : "en",
  "profile_sidebar_border_color" : "08090a",
  "favourites_count" : 1,
  "followers_count" : 121,
  "url" : "http://www.studytravel.nl",
  "created_at" : "Wed Nov 25 17:41:07 +0000 2009",
  "profile_background_tile" : false
}
```

### [Tweet](https://dev.twitter.com/docs/platform-objects/tweets)

<a name="tweet" />
```js
{
  "entities" : {
    "user_mentions" : [
      {
        "screen_name" : "espenotienenick",
        "indices" : [0, 16],
        "id_str" : "186170312",
        "name" : "Esperanza Was There",
        "id" : 186170312
      }
    ],
    "hashtags" : [ ],
    "urls" : [ ]
  },
  "in_reply_to_user_id" : 186170312,
  "in_reply_to_status_id" : 217924341025869820,
  "text" : "@espenotienenick Yo, de lo blanca que estoy, cuando me meto en el mar, parezco una linterna. jejeje",
  "in_reply_to_user_id_str" : "186170312",
  "place" : null,
  "retweeted" : false,
  "in_reply_to_screen_name" : "espenotienenick",
  "truncated" : false,
  "retweet_count" : 0,
  "source" : "<a href=\"http://www.tweetdeck.com\" rel=\"nofollow\">TweetDeck</a>",
  "coordinates" : null,
  "geo" : null,
  "id_str" : "217924715484946432",
  "contributors" : null,
  "favorited" : false,
  "created_at" : "Wed Jun 27 10:17:55 +0000 2012",
  "user" : {
    "default_profile" : false,
    "lang" : "en",
    "profile_background_tile" : false,
    "screen_name" : "mandolinaes",
    "is_translator" : false,
    "show_all_inline_media" : false,
    "profile_sidebar_fill_color" : "ffeedc",
    "profile_image_url_https" : "https://si0.twimg.com/profile_images/1517593937/Bcubbins_small_normal.jpg",
    "following" : null,
    "profile_sidebar_border_color" : "ffeedc",
    "description" : "Stranger in a strange land. Out of this world. Mathematician. Follow your dreams no matter what. Jared Leto is my inspiration in life http://www.mandolinaes.com",
    "default_profile_image" : false,
    "profile_use_background_image" : true,
    "favourites_count" : 74,
    "friends_count" : 221,
    "id_str" : "23666389",
    "created_at" : "Tue Mar 10 21:59:13 +0000 2009",
    "profile_text_color" : "500601",
    "profile_background_image_url_https" : "https://si0.twimg.com/profile_background_images/545298383/tumblr_bea.jpg",
    "profile_background_image_url" : "http://a0.twimg.com/profile_background_images/545298383/tumblr_bea.jpg",
    "time_zone" : "Madrid",
    "followers_count" : 1064,
    "protected" : false,
    "url" : "http://mandolinaes.tumblr.com/",
    "profile_image_url" : "http://a0.twimg.com/profile_images/1517593937/Bcubbins_small_normal.jpg",
    "profile_link_color" : "910c00",
    "name" : "Beatriz",
    "listed_count" : 53,
    "contributors_enabled" : false,
    "geo_enabled" : false,
    "id" : 23666389,
    "follow_request_sent" : null,
    "statuses_count" : 52122,
    "verified" : false,
    "notifications" : null,
    "utc_offset" : 3600,
    "profile_background_color" : "070d1a",
    "location" : "Spain"
  },
  "id" : 217924715484946430,
  "in_reply_to_status_id_str" : "217924341025869824"
}
```


# Tests
Tests are written with [mocha](http://visionmedia.github.com/mocha/)

```bash
npm test
```

# Links
* https://dev.twitter.com/docs/streaming-apis
* https://dev.twitter.com/docs/streaming-apis/connecting
* https://dev.twitter.com/docs/streaming-apis/messages
* https://dev.twitter.com/docs/streaming-apis/parameters
* https://dev.twitter.com/docs/platform-objects
* https://dev.twitter.com/docs/twitter-ids-json-and-snowflake
