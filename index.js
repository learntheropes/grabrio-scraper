import cron from 'node-cron'
import {grabsScraper} from './src/grabs-scraper'
import {dbInit} from './src/pouch/index'
import {stringify} from 'querystring';


process.on('unhandledRejection', (_, promise) => { 
  console.error('Unhandled Rejection:', promise)
  process.exitCode = 1
})

cron.schedule('0 0 1,3,5,7,9,11,13,15,17,19,21,23 * * *', async () => {

  console.log('Running grabsScraper at', new Date())

  console.log('Done grabsScraper at', new Date())
},{
	scheduled: true,
  timezone: "Europe/London"
});

cron.schedule('0 0 0,2,4,6,8,10,12,14,16,18,20,22 * * *', async () => {

  console.log('Running ... at', new Date())

  console.log('Done ... at', new Date())
},{
	scheduled: true,
  timezone: "Europe/London"
});

dbInit().then(() => {
  grabsScraper({
    limit: 100,
    'filter[from.id][eql]': 23644,
    'filter[to.id][eql]': 189,
    sort: 'updated_at,-id',
    headless: false
  }).then(() => process.exit(0))
})

