/*jshint quotmark:false, sub:true, es5:true */
var ondata = require('../lib/ondata');
var EventEmitter = require('events').EventEmitter;


exports['delete'] = function(test) {
  var data = {
    "delete":{
      "status":{
        "id":1234,
        "id_str":"1234",
        "user_id":3,
        "user_id_str":"3"
      }
    }
  };

  var ee = new EventEmitter();

  ee.on('delete', function(tweetID, userID) {
    test.equal(tweetID, data.delete.status.id_str);
    test.equal(userID, data.delete.status.user_id_str);
    test.done();
  });

  ondata.call(ee, data);
};


exports['scrub_geo'] = function(test) {
  var data = {
    "scrub_geo":{
      "user_id":14090452,
      "user_id_str":"14090452",
      "up_to_status_id":23260136625,
      "up_to_status_id_str":"23260136625"
    }
  };

  var ee = new EventEmitter();

  ee.on('scrub_geo', function(userID, upToStatusID) {
    test.equal(userID, data.scrub_geo.user_id_str);
    test.equal(upToStatusID, data.scrub_geo.up_to_status_id_str);
    test.done();
  });

  ondata.call(ee, data);
};
