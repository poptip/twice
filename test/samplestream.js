/**
 * This file opens a sample stream and prints its data.
 * Run this file as to get a taste of what twitter will emit.
 * You'll need to set your Twitter OAuth credentials in a file `config.json`
 */
var Stweam = require('..');
var config = require('./config.json');


var stream = new Stweam(config).createSampleStream();

var n;
stream.on('data', function() {
  process.stdout.write('\rdelicious data: ' + (n++));
});

stream.on('connect', function() {
  n = 1;
});

/*
stream.on('tweet', function(tweet) {
  console.log(tweet.user.screen_name + ': ' + tweet.text);
});
*/

/*
stream.once('data', function() {
  stream._stream.on('data', function(data) {
    console.log(now(), 'raw data', data.length);
  });
});
*/

stream.on('error', function(err) {
  if (err.data) {
    console.log('there was an err:');
    console.log(err.data);
  }
  console.log(err.stack);
});

function now() {
  var d = new Date();
  return (d.getMonth() + 1) + '-' + d.getDate() + ' ' +
         d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds();
}

function log(msg) {
  return function() {
    var args = Array.prototype.slice.call(arguments);
    console.log.apply(null, [now(), msg].concat(args));
  };
}

[ 'connect'
, 'reconnect'
, 'beforeConnect'
, 'disconnect'
, 'retry'
, 'retryMax'
, 'end'
, 'destroy'
, 'timeout'
, 'warning'
].forEach(function(event) {
  stream.on(event, log(event));
});
