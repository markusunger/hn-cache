const redis = require('./redis-connect');

module.exports = {
  deleteKeys: async function deleteKeys(keys) {
    await redis.del(...keys);
    return null;
  },

  addLists: async function addLists(lists) {
    const pipeline = redis.pipeline();
    Object.keys(lists).forEach((name) => {
      const list = lists[name];
      pipeline.rpush(`list:${name}`, ...list);
    });
    const result = await pipeline.exec();
    return result;
  },

  addItems: async function addItems(items) {
    const pipeline = redis.pipeline();
    items.forEach(item => pipeline.set(`item:${item.id}`, JSON.stringify(item)));
    const result = await pipeline.exec();
    return result;
  },

  getMinItemId: async function getMinItemId() {
    const minId = await redis.get('cache:minId');
    return minId;
  },

  setMinItemId: async function setMinItemId(id) {
    const result = await redis.set('cache:minId', id);
    return result;
  },

  close: function close() {
    return redis.disconnect();
  },
};
