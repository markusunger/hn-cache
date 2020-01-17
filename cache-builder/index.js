const Redis = require('ioredis');
require('dotenv').config({
  path: '../.env',
});

const request = require('./request');

const redis = new Redis({
  port: Number(process.env.CACHE_PORT),
  host: process.env.CACHE_HOST,
});

// eslint-disable-next-line no-console
const log = msg => console.log(msg);

((async function mainTask() {
  const timeStart = new Date();
  let updatedItems = 0;
  let batchesRun = 0;
  log(`Starting cache builder at ${timeStart}.`);

  // get HN API lists for top, best, etc. post id's
  log('Requesting data for story lists ...');
  const lists = await request.getLists();
  if (!lists) {
    log('Could not retrieve story lists.');
    return;
  }

  // save story list ids in cache
  try {
    // delete existing list keys
    await redis.del(...Object.keys(lists).map(name => `list:${name}`));
    const pipeline = redis.pipeline();
    // push all id's to new list in correct order
    Object.keys(lists).forEach(name => pipeline.rpush(`list:${name}`, ...lists[name]));
    await pipeline.exec();
    log('... saved.');
  } catch (err) {
    log(err);
    return;
  }

  // get both maximum item id from API
  // and minimum item id from requested lists
  const minItemId = Math.min(...([].concat(...Object.values(lists))));
  const maxItemId = await request.getMaxItemId();
  if (!maxItemId) {
    log('Could not retrieve maximum item id.');
    return;
  }

  // final step: cache all items from min to max id
  const idGen = request.getNextItemIds(minItemId, maxItemId, 100);

  // set interval to issue requests in batches every second
  const sId = setInterval(async () => {
    const nextIds = idGen.next().value;
    if (!nextIds) {
      // when all requests are made: clear timer and set new starting point
      // for the next builder run, then disconnect from cache and exit
      clearInterval(sId);
      log('Validating cache ...');
      log(`${updatedItems} items cached in ${batchesRun} batches this run.`);
      log(`Run time: ${Date.now() - timeStart} seconds.`);
      await redis.set('info:minitemid', maxItemId);
      redis.disconnect();
      process.exit();
    }

    const pipeline = redis.pipeline();
    const requestQueue = nextIds.map(id => request.getNextItem(id));
    Promise.all(requestQueue)
      .then((responses) => {
        // save batch of item data to cache
        responses.forEach((response, idx) => {
          if (response && response.data) {
            updatedItems += 1;
            const { data } = response;
            pipeline.set(`item:${data.id}`, JSON.stringify(data));
          } else {
            log(`Failed request for item ${nextIds[idx]}`);
          }
        });
        pipeline.set('info:minitemid', nextIds[0]);
        pipeline.exec();
        batchesRun += 1;
        log(`Cached items ${nextIds[0]} to ${nextIds[nextIds.length - 1]}.`);
      })
      .catch(() => log('Error on request batch.'));
  }, 1000);
}()).catch(err => log(err)));
