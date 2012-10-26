/**
 * https://dev.twitter.com/docs/streaming-apis/connecting#HTTP_Error_Codes
 */
module.exports = {
  '400': {
    type: 'Bad Request',
    message: 'No authorized followings found for your request.'
  },

  '401': {
    type: 'Unauthorized',
    message: 'HTTP authentication failed due to invalid OAuth request.'
  },

  '403': {
    type: 'Forbidden',
    message: 'The connecting account is not permitted to access this endpoint.'
  },

  '404': {
    type: 'Unknown',
    message: 'There is nothing at this URL, which means the resource does not exist.'
  },

  '406': {
    type: 'Not Acceptable',
    message: 'At least one request parameter is invalid.'
  },

  '413': {
    type: 'Too Long',
    message: 'A parameter list is too long.'
  },

  '416': {
    type: 'Range Unacceptable',
    message: 'The `count` parameter was used in an invalid way.'
  },

  '420': {
    type: 'Rate Limited',
    message: 'The client has connected too frequently.'
  },

  '500': {
    type: 'Service Unavailable',
    message: 'A streaming server is temporarily overloaded.'
  }
};
