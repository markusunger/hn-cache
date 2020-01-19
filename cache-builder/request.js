const axios = require('axios');

const API_URL = process.env.HN_API;
const LISTS = ['topstories', 'newstories', 'beststories', 'showstories', 'askstories'];

module.exports = {
  getLists: async function getLists() {
    // create requests for each list type
    const listRequests = LISTS.map(list => axios.get(`${API_URL}/${list}.json`));
    // resolve all requests and return them on success
    const lists = await Promise.all(listRequests);
    if (!lists) throw new Error('Could not receive all lists.');
    const response = lists.reduce((res, list, index) => {
      // create object with list name and array of HN story id's
      res[LISTS[index]] = list.data;
      return res;
    }, {});
    return response;
  },

  getMaxItemId: function getMaxItemId() {
    return axios.get(`${API_URL}/maxitem.json`).then(response => response.data);
  },

  getNextItem: function getNextItem(id) {
    return axios.get(`${API_URL}/item/${id}.json`);
  },

  getNextItemIds: function* getNextItemId(min, max, batchSize) {
    for (let i = min; i <= max; i += batchSize) {
      let idBatch = Array.from(new Array(batchSize)).map((_, idx) => i + idx);
      if (i > max) idBatch = idBatch.filter(id => id <= max);
      yield idBatch;
    }
  },
};
