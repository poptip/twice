/**
 * Twitter might update these in the future.
 */
module.exports = {
  MAX_REQUESTS_PER_SECOND: 25,
  TIMEOUT: 90000,
  ALGORITHMS: {
    LINEAR: { START: 250, MAX: 16000 },
    EXPONENTIAL: { START: 5000, MAX: 320000 }
  },
  PUBLIC_STREAM: {
    RESOURCE_URL: 'https://stream.twitter.com/1/statuses/filter.json'
  },
  USER_STREAM: {
    RESOURCE_URL: 'https://userstream.twitter.com/2/user.json'
  },
  SITE_STREAM: {
    HOST: 'https://sitestream.twitter.com',
    RESOURCE_URL: 'https://sitestream.twitter.com/2b/site.json',
    MAX_USERS: 1000,
    MAX_INITIAL_USERS: 100,
    MAX_USERS_PER_REQUEST: 100
  }
};