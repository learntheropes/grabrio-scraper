import {db} from '../pouch/index'
import {chromium, blockRequests} from '../puppeteer/index'
import {getRealDomain} from './index'
import chunk from 'lodash.chunk'
import merge from 'lodash.merge'
 
const save = async (props, settings) => {
  try {

    props = (!Array.isArray(props)) ? [props] : props
    const {headless = true, concurrent_tabs = 5} = settings || {}
    const cb = writeAttributes
  
    await browse(props, {
      headless,
      concurrent_tabs,
      cb
    })
    
  } catch (error) {

    console.error('Error at amazon.specification.save()', error)
  }
}

const get = async (props, settings) => {
  try {

    props = (!Array.isArray(props)) ? [props] : props
    const {headless = true, concurrent_tabs = 5} = settings || {}
    const cb = writeAttributes
  
    await browse(props, {
      headless,
      concurrent_tabs
    })

  } catch (error) {

    console.error('Error at amazon.specification.get()', error)
  }
}

const browse = async (props, settings) => {
  try {
    const {concurrent_tabs, headless, cb} = settings

    const browser = await chromium(headless)
    const context = await browser.createIncognitoBrowserContext()
    
    const chucks = chunk(props, concurrent_tabs)
    let results = []
  
    for (const chuck of chucks) {
  
      let promises = []
  
      for (const prop of chuck) {

        const {asin, id, domain} = prop
  
        const promise = getAttributes(context, {asin, id, domain}).then(response => {
          if (cb && typeof cb === 'function') cb(response)
          else results.push(response)
        })
  
        promises.push(promise)
      }
      await Promise.all(promises);
    }
    await browser.close()
    if (!cb) return results

  } catch (error) {

    console.error('Error at amazon.specification.processAttributes()', error)
  }
}

const getAttributes = async (context, args) => {
  try {
    const {asin, id, domain} = args

    const page = await context.newPage()

    await blockRequests(page, [
      'cloudfront.net',
      'krxd.net',
      'amazon-adsystem.com',
      'google.com'
    ])

    const global_url = `https://www.amazon.com/dp/${asin}/`
    let url = await page.goto(global_url, {timeout: 15000}).catch(err => {console.error(url, err)})

    if(url.status === 404) {
      const real_domain = getRealDomain(domain)
      const local_url = `https://www.amazon.${real_domain}/dp/${asin}/`
      url = await page.goto(local_url, {timeout: 15000}).catch(err => {console.error(url, err)})
    }
  
    let categories, weight, brand
  
    await Promise.all([
      getCategories(page, 5000).then(res => categories = res),
      getWeight(page, 5000).then(res => weight = res),
      getBrand(page, 5000).then(res => brand = res)
    ])
  
    await page.close()

    const attributes = {
      domain,
      categories,
      weight,
      brand
    }
  
    return {
      asin,
      attributes
    } 

  } catch (error) {

    console.error('Error at amazon.specification.readAttributes()', error)
  }
}

const getBrand = async (page, timeout) => {
  try {

    let promises = []
  
    const selectors = [
      'a#bylineInfo',
    ]

    const evalFunction = (el) => el.innerText

    for (const selector of selectors) {

      const promise = page.waitForSelector(selector, {timeout}).then( async () => {
        return await page.$eval(selector, evalFunction)
      }).catch(() => {
        return null;
      })

      promises.push(promise)
    }
    return await Promise.race(promises);

  } catch (error) {

    console.error('Error at amazon.specification.getBrand()', error)
  }
}

const getCategories = async (page, timeout) => {
  try {

    let promises = []

    const selectors = [
      '#wayfinding-breadcrumbs_feature_div > ul > li:not(.a-breadcrumb-divider)',
      '#wayfinding-breadcrumbs_container > ul > li:not(.a-breadcrumb-divider)'
    ]

    const evalFuncion = (els) => els.map(el => el.innerText)

    for (const selector of selectors) {

      const promise = page.waitForSelector(selector, {timeout}).then( async () => {

        return  await page.$$eval(selector, evalFuncion)
      }).catch((err) => {
        return null;
      })
      promises.push(promise)
    }
    return await Promise.race(promises);

  } catch (error) {

    console.error('Error at amazon.specification.getCategories()', error)
  }
}

const getWeight = async (page, timeout) => {
  try {

    let promises = []
  
    const selectors = [
      'div#detailBullets',
      'div#detail-bullets',
      'table#productDetails_detailBullets_sections1',
      'div#prodDetails',
      // 'div#technicalSpecifications_feature_div',
      'div#detail-bullets_feature_div',
      'table#productDetails_techSpec_section_1',
      'table#productDetailsTable'
    ]
  
    const evalFunction = (el) => {
  
      const regex = /(?<=(Shipping\sWeight:*\s*|Item\sWeight:*\s*))\d+\.*\d*(?=(\s*pounds|\sounces))/g;
  
      let matches = Array.from(el.innerText.matchAll(regex));
  
      let weight = (matches.length === 2)
      ? matches.filter(match => {
          return match[1].includes('Shipping')
        }).map(match => {
          const v = parseFloat(match[0])
          const u = (match[2].trim() === 'pounds') ? 0.4535924 : 0.02834952
          return (v * u) + 0.01
        })[0]
      : matches.map(match => {
          const v = parseFloat(match[0])
          const u = (match[2].trim() === 'pounds') ? 0.4535924 : 0.02834952
          return (v * u * 1.05) + 0.01
        })[0];
  
      return parseFloat(weight.toFixed(2));
    }
  
    for (let i = 0; i < selectors.length; i++) {
  
      const promise = page.waitForSelector(selectors[i], {timeout}).then( async () => {
        return await page.$eval(selectors[i], evalFunction)
      }).catch(() => {
        return null;
      })
  
      promises.push(promise)
    }
    return await Promise.race(promises);
  } catch (error) {

    console.error('Error at amazon.specification.getWeight()', error)
  }
}

const writeAttributes = async (response) => {
  try {

    const {asin, attributes} = response
    const {domain} = attributes
    const real_domain = getRealDomain(domain)

    const newDoc = {
      _id: `asins:${asin}`,
      id: asin,
      type: 'asins',
      attributes,
      links: {
        self: `https://www.amazon.${real_domain}/dp/${asin}`
      }
    }
  
    await db.put(newDoc)
    .catch(async (error) => {
  
      if (error.name == 'conflict') {
        try {
          const oldDoc = await db.get(newDoc._id)
          merge(oldDoc, newDoc)
          await db.put(oldDoc)        
        } catch (error) {
          console.error('Error at saving conflicting amazon specification doc', error)
        }
      }
    })

  } catch (error) {

    console.error('Error at amazon.specification.writeAttributes()', error)
  }
}

export {
  save,
  get
}
