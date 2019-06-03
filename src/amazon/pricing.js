import {db} from '../pouch/index'
import {chromium, blockRequests} from '../puppeteer/index'
import {login} from './login'
import {getRealDomain} from './index'
import {sleep} from '../utils/sleep'
import {stringify} from 'querystring';
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

    console.error('Error at amazon.pricings.save()', error)
  }
}

const get = async (props, settings) => {
  try {

    props = (!Array.isArray(props)) ? [props] : props
    const {headless = true, concurrent_tabs = 5} = settings || {}
  
    return await browse(props, {
      headless,
      concurrent_tabs
    })

  } catch (error) {

    console.error('Error at amazon.pricings.get()', error)
  }
}

const browse = async (props, settings) => {
  try {

    const {concurrent_tabs, headless, cb} = settings

    const browser = await chromium(headless)
    const context = await browser.createIncognitoBrowserContext()
    await login(context, props[0].domain)
    
    const chucks = chunk(props, concurrent_tabs)
    let results = []
  
    for (const chuck of chucks) {
  
      let promises = [sleep(4000,5000)]
  
      for (const prop of chuck) {
    
        const promise = getAttributes(context, prop).then((response) => {
  
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

    console.error('Error at amazon.pricings.processAttributes()', error)
  }
}

const getAttributes = async (context, params) => {
  try {

    let {asin, id, domain, startIndex = 0, attributes = []} = params
  
    const page = await context.newPage()
  
    await blockRequests(page, [
      'cloudfront.net',
      'krxd.net',
      'amazon-adsystem.com',
      'google.com'
    ])
  
    const querystring = stringify({
      ie: 'UTF8',
      f_all: true,
      f_new: true,
      startIndex: startIndex
    })
    const real_domain = getRealDomain(domain)
    const url = `https://www.amazon.${real_domain}/gp/offer-listing/${asin}/ref=olp_page_1?${querystring}`
    await page.goto(url, {timeout: 15000}).catch(err => console.error(url, err))
    
    const getNum = (text) => parseFloat(text.match(/\d*\,*\d+\.\d*/))
    await page.exposeFunction('getNum', getNum);
  
    const rows = await page.$$('div[role="row"].olpOffer')
  
    let page_attributes = []
  
    for (const row of rows) {

      const row_attributes = await getRow(row)
      page_attributes.push(row_attributes)
    }
  
    const has_next = await page.$('li:not(.a-disabled).a-last')
  
    attributes = attributes.concat(page_attributes)
  
    await page.close()
  
    if (has_next) {
      await getAttributes(context, {
        asin,
        id,
        domain,
        startIndex: startIndex + 10,
        attributes,
      })
    }

    return {
      asin,
      id,
      domain,
      attributes
    }

  } catch (error) {

    console.error('Error at amazon.pricing.readAttributes()', error)
  }
}

const getRow = async (row) => {
  try {

    const product = await row.$eval('span.olpOfferPrice', selector => getNum(selector.innerText)).catch(() => 0)

    const shipping = await row.$eval('span.olpShippingPrice', selector => getNum(selector.innerText)).catch(() => 0)

    const tax = await row.$eval('span.olpEstimatedTaxText', selector => getNum(selector.innerText)).catch(() => 0)

    const isPrime = await row.$eval('i.a-icon-prime', () => true).catch(() => false)

    const isFBA = await row.$eval('div.olpBadge', () => true).catch(() => false)

    const isAmazon = await row.$eval('h3.olpSellerName > img', selector => (selector.alt === 'Amazon.com') ? true : false).catch(() => false)
    
    const shopName = (isAmazon)
    ? await row.$eval('h3.olpSellerName > img', selector => selector.alt)
    : await row.$eval('h3.olpSellerName', selector => selector.innerText) 
    
    return {
      product,
      shipping,
      tax,
      isPrime,
      isFBA,
      isAmazon,
      shopName
    }
  } catch (error) {

    console.error('Error at amazon.pricing.readRow()', error)
  }
}

const writeAttributes = async (response) => {
  try {

    const {asin, id, domain, attributes} = response
    const real_domain = getRealDomain(domain)

    const newDoc = {
      _id: `pricings:${id}`,
      id: id,
      type: 'pricings',
      relationships: {
        item: {
          id: id,
          type: 'items'
        },
        asin: {
          id: asin,
          type: 'asins'
        }
      },
      attributes,
      links: {
        self: `https://www.amazon.${real_domain}/gp/offer-listing/${asin}/?f_new=true`
      }
    }
  
    await db.put(newDoc)
    .catch(async (error) => {
  
      if (error.name === 'conflict') {
        const oldDoc = await db.get(newDoc._id)
        merge(oldDoc, newDoc)
        await db.put(oldDoc)
      }
    })
  } catch (error) {

    console.error('Error at amazon.pricing.writeAttributes()', error)
  }
}

export {
  save,
  get
}

