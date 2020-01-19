/* eslint-disable no-continue */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-loop-func */
require('dotenv').config({
  path: '../.env',
});

const request = require('./request');
const cache = require('./cache');
const queue = require('./queue');

// no. of concurrent HTTP requests issued
const BATCH_SIZE = 50;
// time interval (in milliseconds) in which to issue HTTP request batches
const REQUEST_INTERVAL = 2000;

const log = msg => console.log(msg);

const errorOut = async (msg, err) => {
  log(msg);
  log(err);
  await cache.close();
  process.exit();
};

(async function mainTask() {
  let minItemId;
  let maxItemId;
  const timeStart = Date.now();
  let updatedItems = 0;
  let batchesRun = 0;
  log(`Starting cache builder at ${new Date()}.`);

  try {
    // get HN API lists for top, best, etc. post id's
    log('Requesting data for story lists ...');
    const lists = await request.getLists();

    // delete existing list keys and save story list ids in cache
    const cacheListNames = Object.keys(lists).map(name => `list:${name}`);
    cache.deleteKeys(cacheListNames);
    // push all id's to new list in correct order
    cache.addLists(lists);
    log('... saved.');

    // get both minimum item id from either cache or requested lists
    // and maximum item id from HN API
    minItemId = await cache.getMinItemId();
    if (!minItemId) minItemId = Math.min(...([].concat(...Object.values(lists))));
    maxItemId = await request.getMaxItemId();
  } catch (err) {
    errorOut('Error before starting batch run', err);
  }

  // create generator for all item id's to be fetched
  const idGen = request.getNextItemIds(minItemId, maxItemId, BATCH_SIZE);

  let nextBatch = idGen.next().value;
  let allFetched;
  try {
    await queue.push(nextBatch);
    allFetched = await queue.isEmpty();
  } catch (err) {
    log(`Could not add initial batch. No new data? (${err})`);
  }

  let intervalTimer = Date.now();

  while (!allFetched) {
    // check if enough time has passed to start next iteration
    if (Date.now() - intervalTimer < REQUEST_INTERVAL) continue;
    // run until queue is empty
    let nextIds;
    try {
      nextIds = await queue.pop(BATCH_SIZE);
    } catch (err) {
      // push batch of id's back into queue if their removal failed
      queue.push(nextBatch);
      log(err);
    }

    const requestQueue = nextIds.map(id => request.getNextItem(id));
    Promise.all(requestQueue)
      .then(async (responses) => {
        // create array of data for cache to save
        const newItems = responses.reduce(async (arr, response, idx) => {
          if (response && response.data) {
            updatedItems += 1;
            const { data } = response;
            arr.push(data);
          } else {
            log(`Failed request for item ${nextIds[idx]}. Requeueing ...`);
            await queue.push(nextIds[idx]);
          }
          return arr;
        }, []);

        // save newly fetched data to cache
        try {
          await cache.addItems(newItems);
          log(`Batch of ${newItems.length} items saved.`);
        } catch (err) {
          log(`Could not save newly fetched items. Requeueing whole batch (${err})...`);
          await queue.push(nextIds);
        }
      }, async (err) => {
        log(`Failed batch. Requeueing all id's (${err})...`);
        await queue.push(nextIds);
      });

    batchesRun += 1;
    nextBatch = idGen.next().value;
    try {
      await queue.push(nextBatch);
    } catch (err) {
      log(`Could not add next batch to queue (${err}).`);
    }

    intervalTimer = Date.now();
    allFetched = await queue.isEmpty();
  }

  cache.close();
  log(`Fetched ${updatedItems} in ${batchesRun} batches.`);
  log(`Time lapsed: ${timeStart - Date.now()} seconds`);
  process.exit();
}());
