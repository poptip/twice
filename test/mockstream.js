var Stream = require('stream');
var inherits = require('util').inherits;


/**
 * Mocks Stweam with a fake stream that can be connected to, disconnected,
 * and controlled.
 */
var MockStream = module.exports = function MockStream() {
  Stream.call(this);
};

inherits(MockStream, Stream);


/**
 * Writable and readable for testing.
 */
MockStream.prototype.readable = true;
MockStream.prototype.writable = true;
MockStream.prototype.paused = false;


/**
 * Takes Javascript object and emits `data` events as JSON.
 *
 * @param (Object) obj
 */
MockStream.prototype.write = function(obj) {
  if (!this.writable) {
    throw new Error('stream is not writable');
  }
  this.emit('data', JSON.parse(obj));
};


/**
 * Destroy this stream.
 */
MockStream.prototype.destroy = function() {
  this.readable = false;
  this.writable = false;
};


MockStream.prototype.setEncoding = function() {
};


MockStream.prototype.pause = function() {
  this.paused = true;
};


MockStream.prototype.resume = function() {
  this.paused = false;
};
