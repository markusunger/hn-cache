# Hacker News Cache Builder and API
A simple way to cache all items from the quirkily designed official Hacker News API in a local Redis store.

`yarn install` to fetch all dependencies. Then run `cache-builder/index.js` once for the initial caching (will run about 20 minutes depending on the current stories from top/best/new) and as a cronjob in regular interval of 10 minutes or so for keeping the cache up to date.

The API follows the same pattern as the official one with the following endpoints:
- `/item/:id` for every item
- `/topstories`
- `/newstories`
- `/beststories`
- `/askstories`
- `/showstories`

There's lots of room for improvement:
- make the cache builder a proper CLI app
- either delete old items to not clog Redis or extend for a whole HN archive
- extend the API to be more than the barebones thing it is right now