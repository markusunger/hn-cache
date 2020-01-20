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

((async function mainTask() {
  let minItemId;
  let maxItemId;
  let idGen;
  const timeStart = Date.now();
  let updatedItems = 0;
  let batchesRun = 0;
  log(`Starting cache builder at ${new Date()}.`);

  const batchRun = async () => {
    // invoked by setInterval for individual batches,
    // enqueues new ids and fetches others
    const next = idGen.next().value;
    if (next) await queue.push(next);

    const queueEmpty = await queue.isEmpty();
    if (queueEmpty) {
      // print information about builder run once queue is empty
      // then clean up and exit
      log(`Fetched ${updatedItems} items in ${batchesRun} batches.`);
      log(`Time lapsed: ${parseFloat((Date.now() - timeStart) / 1000 / 60).toFixed(2)} minutes.`);
      await cache.setMinItemId(maxItemId);
      await cache.close();
      process.exit();
    }

    // get next batch of ids and convert to request promises
    const batch = await queue.pop(BATCH_SIZE);
    const requests = batch.map(id => request.getNextItem(id));

    try {
      log(`Requesting batch of ${batch.length} items (${batch[0]} .. ${batch[batch.length - 1]})...`);
      const responses = await Promise.all(requests);
      const data = responses.reduce((arr, response, idx) => {
        if (response) {
          if (!response.data) {
            // handle those pesky valid null responses from the API
            response.data = {};
            response.data.id = batch[idx];
          }
          arr.push(response.data);
          updatedItems += 1;
        } else {
          // when Promise.all fails, there's no way to determine which single
          // item might be responsible, so we requeue the whole batch
          log(`No valid response, requeueing item ${batch[idx]} ...`);
          queue.push([batch[idx]]);
        }
        return arr;
      }, []);
      await cache.addItems(data);
      log(`Added ${data.length} items.`);
    } catch (err) {
      log(`Requeueing batch after error: ${err}`);
      await queue.push(batch);
    }
    batchesRun += 1;
  };

  try {
    // get HN API lists for top, best, etc. post id's
    log('Requesting data for story lists ...');
    const lists = await request.getLists();

    // delete existing list keys and save story list ids in cache
    const cacheListNames = Object.keys(lists).map(name => `list:${name}`);
    cache.deleteKeys(cacheListNames);
    // push all ids to new list in correct order
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

  const timeEstimated = parseFloat(
    ((maxItemId - minItemId) / (BATCH_SIZE / (REQUEST_INTERVAL / 1000))) / 60,
  ).toFixed(2);
  log(`Starting fetching items with id's from ${minItemId} to ${maxItemId}`);
  log(`Total no. of items: ${maxItemId - minItemId}`);
  log(`Estimated time: ${timeEstimated} minutes.`);

  idGen = request.getNextItemIds(minItemId, maxItemId, BATCH_SIZE);

  setInterval(batchRun, REQUEST_INTERVAL);
}()).catch(err => errorOut('Something went wrong.', err)));
