import {db} from '../pouch/index'
import {save as processAsins} from '../amazon/specification'
import {save as processPricings} from '../amazon/pricing'
import find from 'lodash.find'

const parsed_domains = [
  'cn',
  'in',
  'jp',
  'sg',
  'tr',
  'ae',
  'fr',
  'de',
  'it',
  'nl',
  'es',
  'uk',
  'ca',
  'mx',
  'com',
  'au',
  'br'
]

const real_domains = [
  'cn',
  'in',
  'co.jp',
  'com.sg',
  'com.tr',
  'ae',
  'fr',
  'de',
  'it',
  'nl',
  'es',
  'co.uk',
  'ca',
  'com.mx',
  'com',
  'com.au',
  'com.br'
]

const domains = {
  parsed: parsed_domains,
  real: real_domains
}

const parseAttributes = (attributes) => {
  if (attributes.shop_slug === 'amazon') {
    const asin_regex = /(?<=\/)(B0[A-Z0-9]{8})(?=(\/|\?|$))|(?<=\/)([0-9]{10})(?=\/)/
    attributes.shop_asin = (attributes.shop_url.match(asin_regex)) ? attributes.shop_url.match(asin_regex)[0] : null
    const domain_regex = /(?<=amazon\.)(\w+)(?=\/)/ 
    attributes.shop_domain = (attributes.shop_url.match(domain_regex)) ? attributes.shop_url.match(domain_regex)[0] : null
  }
  return attributes
}

const getRealDomain = (parsed_domain) => {
  return domains.real[domains.parsed.indexOf(parsed_domain)]
}

const getStoredAsins = async () => {

  const all_docs = await db.allDocs({include_docs: true})

  return all_docs.rows
  .filter(doc => doc.doc.type === 'asins' && doc.doc.id)
  .map(doc => doc.doc.id)
}

const getStoredPricings = async () => {

  const all_docs = await db.allDocs({include_docs: true})

  return all_docs.rows
  .filter(doc => doc.doc.type === 'pricings' && doc.doc.id)
  .map(doc => doc.doc.id)
}

const getAsinsToParse = async (data) => {

  const stored = await getStoredAsins()

  let to_parse = {}

  domains.parsed.map(domain => to_parse[domain] = [])

  data.filter(entry => {

    const entry_attributes = entry.relationships.item.data.attributes

    return entry_attributes.shop_asin && !stored.includes(entry_attributes.shop_asin)

  }).forEach(entry => {

    const entry_attributes = entry.relationships.item.data.attributes

    to_parse[entry_attributes.shop_domain].push({
      asin: entry_attributes.shop_asin,
      domain: entry_attributes.shop_domain
    })
  })
  return to_parse
}

const getPricingsToParse = async (data) => {

  const stored = await getStoredPricings()

  let to_parse = {}

  domains.parsed.map(domain => to_parse[domain] = [])

  data.filter(entry => {

    const entry_attributes = entry.relationships.item.data.attributes

    return entry_attributes.shop_asin && !stored.includes(entry.id)

  }).forEach(entry => {

    const entry_attributes = entry.relationships.item.data.attributes

    to_parse[entry_attributes.shop_domain].push({
      asin: entry_attributes.shop_asin,
      id: entry.id,
      domain: entry_attributes.shop_domain
    })
  })
  return to_parse
}

const browseAsins = async (headless, to_parse) => {

  for (const domain in to_parse) {

    if (to_parse[domain].length > 0) {

      await processAsins(to_parse[domain], {
        headless
      })
    }
  }
}

const browsePricings = async (headless, to_parse) => {
  
  for (const domain in to_parse) {

    if (to_parse[domain].length > 0) {

      await processPricings(to_parse[domain], {
        headless
      })
    }
  }
}

const storeAmazonData = async (data, headless) => {

  const asins_to_parse = await getAsinsToParse(data)
  const pricings_to_parse = await getPricingsToParse(data)

  await browseAsins(headless, asins_to_parse)
  await browsePricings(headless, pricings_to_parse)
}

const addAmazonDataToItem = async (entry, item_attributes) => {

  if (item_attributes.shop_asin) {
    
    const stored_asin = await db.get(`asins:${item_attributes.shop_asin}`).catch(error => console.error(error))
    entry.relationships.asin = {}
    entry.relationships.asin.data = {
      type: 'asins',
      id: item_attributes.shop_asin,
      attributes: stored_asin.attributes
    }
  
    const stored_pricing = await db.get(`pricings:${entry.id}`)
    entry.relationships.pricing = {}
    entry.relationships.pricing.data = {
      type: 'pricings',
      id: entry.id,
      attributes: stored_pricing.attributes
    }
  }
  return entry
}

export {
  domains,
  getRealDomain,
  parseAttributes,
  storeAmazonData,
  addAmazonDataToItem
}