const redis = require('redis');
const dotenv = require('dotenv');
const winston = require('winston');

// Need to do this here to get REDIS env var!!
// This module is called as an import in main index.js
// before the other dotenv.config!!
dotenv.config();

let redisClient = {};

// Use redis unless explicitly set by
// env variable to not use it
if (process.env.USE_REDIS === 'N') {
  // Create a bogux redis client for testing
  winston.log('warn', 'Using bogus redis client for testing only!');
  redisClient.get = (redisKey, callback) => {
    callback();
  };
  redisClient.setex = (redisKey, expiry, data, callback) => {
    callback();
  };
} else {
  winston.log('warn', 'Creating redis connection!');
  // Redis connection
  const port = process.env.REDIS_PORT || 6379;
  const host = process.env.REDIS_HOST || '0.0.0.0';

  redisClient = redis.createClient(port, host);

  redisClient.on('error', (error) => {
    winston.log('error', 'System Error - Redis Client:', {
      error
    });
  });
}

module.exports = redisClient;
