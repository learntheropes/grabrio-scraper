import 'dotenv/config'
import PouchDB from 'pouchdb'
import * as _design from './designDoc'
import {observeDbChanges} from './changes'

const protocol = process.env.COUCHDB_PROTOCOL
const usr = process.env.COUCHDB_USER
const psw = process.env.COUCHDB_PASSWORD
const host = process.env.COUCHDB_HOST
const port = process.env.COUCHDB_PORT
const database = process.env.COUCHDB_DATABASE

const db =  new PouchDB(`${protocol}://${usr}:${psw}@${host}:${port}/${database}`)

observeDbChanges()

const dbInit = async () => {
  try {
    const keys = Object.keys(_design)

    for (const key of keys) {

      const designDoc = _design[key]
  
      await db.get(designDoc._id)
      .then(async (res) => {
  
        designDoc._rev = res._rev
        await db.put(designDoc)
      })
      .catch( async (error) => {
  
        if (error.name === 'not_found') {
  
          await db.put(_design[error.docId.replace('_design/','')])
        }
      })
    }    
  } catch (error) {
    console.error('error at PouchDB on created', error)
  }
}

const lastChangeId = async () => {

  return {last_seq} = await db.changes({

    descending: true,
    limit: 1
  })
}

const asinIsMissing = async () => {
  try {

    const {rows} = await db.query('grabs_asins/missing_asins', {
      group: true
    })

    return rows.filter(row => row.value === 0 && row.key).map(row => row.key)

  } catch(error) {

    console.error('Error at pouch.getUnparsedAsins()', error)
  }
}

const asinAttributeIsNull = async (attribute) => {
  try {

    const {rows} = await db.query('asins/attribute_is_null', {
      reduce: false
    })

    if (attribute) {

      return rows
      .filter(row => row.key = attribute)
      .map(row => row.value)

    } else {

      let res = {}

      rows.forEach(row => {
        if (!res[value]) res[value] = {}
        res[value].push(res.key)
      })

      return Object.keys(res)
      .filter(key => res[key].length = 3)
    }

  } catch (error) {
    console.error('Error at pouch.asinAttributeIsNull()', error)
  }
}

const amazonPricingIsMissing = async () => {
  try {

    const {rows} = await db.query('grabs_pricings/missing_amazon_price', {
      group: true
    })

    return rows.filter(row => row.value === 0 && row.key).map(row => row.key)

  } catch (error) {
    
    console.error('Error at pouch.amazonPricingIsMissing()', error)
  }
}

const amazonPricingIsNull = async () => {
  try {
    
    const rows = await db.query('pricings/attribute_is_null', {
      reduce: false
    })

    return rows.map(row => {
      return {
        ASIN: row.key,
        ID: row.value
      }
    })

  } catch (error) {
    
    console.error('Error at pouch.amazonPricingIsNull()', error)
  }
}

export {
  db,
  dbInit,
  lastChangeId,
  asinIsMissing,
  asinAttributeIsNull,
  amazonPricingIsMissing,
  amazonPricingIsNull
}