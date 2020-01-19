// a fifo queue for the cache builder to enqueue batches of id's to be fetched

const redis = require('./redis-connect');

// redis key for the queue
const QUEUE_LIST = 'cache:queue';

module.exports = (function queue() {
  // reset the queue
  redis.del(QUEUE_LIST);

  return {
    push: function push(...ids) {
      // pushes one or more id's onto the front of the queue
      const pipeline = redis.pipeline();
      ids.forEach(id => pipeline.lpush(QUEUE_LIST, id));
      return pipeline.exec();
    },

    pop: async function pop(count = 1) {
      // pops a variable amount of ids from the the back of the queue
      const results = await redis.lrange(QUEUE_LIST, -count, -1);
      await redis.ltrim(QUEUE_LIST, 0, -count);
      return results;
    },

    isEmpty: async function isEmpty() {
      const length = await redis.llen(QUEUE_LIST);
      return length === 0;
    },
  };
}());
