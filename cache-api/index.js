const express = require('express');
const Redis = require('ioredis');
const logger = require('morgan');
const cors = require('cors');

require('dotenv').config({
  path: '../.env',
});

const redis = new Redis({
  port: Number(process.env.CACHE_PORT),
  host: process.env.CACHE_HOST,
});

const app = express();

app.use(cors());
app.use(logger('dev'));

// eslint-disable-next-line no-useless-escape
app.get('/\*stories', async (req, res) => {
  const storyType = req.path.replace(/\//, '');
  const ids = await redis.lrange(`list:${storyType}`, 0, -1);
  res.json(ids);
});

app.get('/item/:id', async (req, res) => {
  const dataset = await redis.get(`item:${req.params.id}`);
  res.json(JSON.parse(dataset));
});

app.listen(process.env.API_PORT, () => console.log(`API started on ${process.env.API_PORT}`));
