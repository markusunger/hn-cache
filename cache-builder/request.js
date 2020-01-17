const axios = require('axios');

const API_URL = process.env.HN_API;
const LISTS = ['topstories', 'newstories', 'beststories', 'showstories', 'askstories'];

module.exports = {
  getLists: function getLists() {
    return new Promise((resolve, reject) => {
      // create requests for each list type
      const listRequests = LISTS.map(list => axios.get(`${API_URL}/${list}.json`));
      // resolve all requests and return them on success
      Promise.all(listRequests)
        .then((lists) => {
          const response = lists.reduce((res, list, index) => {
            // create object with list name and array of HN story id's
            res[LISTS[index]] = list.data;
            return res;
          }, {});
          resolve(response);
        })
        .catch(error => reject(error));
    });
  },

  getMaxItemId: function getMaxItemId() {
    return new Promise((resolve, reject) => {
      axios.get(`${API_URL}/maxitem.json`)
        .then(response => resolve(response.data))
        .catch(err => reject(err));
    });
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
