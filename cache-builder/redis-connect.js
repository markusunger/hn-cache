const Redis = require('ioredis');

module.exports = (function connectRedis() {
  const redis = new Redis({
    port: Number(process.env.CACHE_PORT),
    host: process.env.CACHE_HOST,
  });
  return redis;
}());
