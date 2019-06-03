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

  let parsed = {}

  domains.parsed.map(domain => parsed[domain] = [])

  const all_docs = await db.allDocs({include_docs: true})

  all_docs.rows.filter(doc => doc.doc.type === 'asins').forEach(doc => {

    parsed[doc.doc.attributes.domain].push({
      asin: doc.doc.id,
    })
  })

  return parsed
}

const getStoredPricings = async () => {

  let parsed = {}

  domains.parsed.map(domain => parsed[domain] = [])

  const all_docs = await db.allDocs({include_docs: true})

  all_docs.rows.filter(doc => doc.doc.type === 'pricings').forEach(doc => {

    parsed[doc.doc.attributes.domain].push({
      asin: doc.doc.relationships.asin.id,
      id: doc.doc.id,
    })
  })

  return parsed

}

const getPricingsToParse = (stored_asins, data) => {

  let pricings_to_parse = {}

  domains.parsed.map(domain => pricings_to_parse[domain] = [])

  data.filter(entry => {

    const asin = entry.relationships.item.data.attributes.shop_asin

    return asin && !find(stored_asins, {id: asin})

  }).forEach(entry => {

    const item_attributes = entry.relationships.item.data.attributes

    pricings_to_parse[item_attributes.shop_domain].push({
      asin: item_attributes.shop_asin,
      id: entry.id,
      domain: item_attributes.shop_domain
    })
  })
  
  return pricings_to_parse
}

const getAsinsToParse = async (pricings_to_parse, stored_asins) => {

  const asins_to_parse = Object.keys(pricings_to_parse).reduce((obj, domain) => {
    obj[domain] = pricings_to_parse[domain].filter(entry => {
      return !find(stored_asins[domain], {asin: entry.asin})
    })
    return obj
  }, {})
  return asins_to_parse
}

const browseAsins = async (headless, asins_to_parse) => {

  for (const domain in asins_to_parse) {

    if (asins_to_parse[domain].length > 0) {

      await processAsins(asins_to_parse[domain], {
        headless
      })
    }
  }
}

const browsePricings = async (headless, pricings_to_parse) => {
  
  for (const domain in pricings_to_parse) {

    if (pricings_to_parse[domain].length > 0) {

      await processPricings(pricings_to_parse[domain], {
        headless
      })
    }
  }
}

const storeAmazonData = async (data, headless) => {

  const stored_asins = await getStoredAsins()
  const pricings_to_parse = getPricingsToParse(stored_asins, data)
  const asins_to_parse = await getAsinsToParse(pricings_to_parse, stored_asins)

  await browseAsins(headless, asins_to_parse)
  await browsePricings(headless, pricings_to_parse)
}

const addAmazonDataToItem = async (entry, item_attributes) => {

  const stored_asin = await db.get(`asins:${item_attributes.shop_asin}`)
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

  return entry
}

export {
  domains,
  getRealDomain,
  parseAttributes,
  storeAmazonData,
  addAmazonDataToItem
}