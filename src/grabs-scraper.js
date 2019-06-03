import {grabs} from './grabr/index'
import {db} from './pouch/index'
import {storeAmazonData, addAmazonDataToItem} from './amazon/index'
import merge from 'lodash.merge'


const getKeySet = (params) => {
  if (!params.results) params.results = []
  if (params.results.length > 0) {
    params.sort.split(',').forEach(keyset => {
      const last_result = params.results[params.results.length - 1]
      const key = keyset.replace('-', '')
      params[`keyset[${key}]`] = (key === 'id') ? last_result.id : last_result.attributes[key]
    })
  }
  return params
}


const recursive_request = async (params) => {

  if (params.limit >= 100) {

    params = getKeySet(params)
    params.limit = params.limit - 100
    let temp_params = JSON.parse(JSON.stringify(params))
    temp_params.limit = 100
    delete temp_params.results
    delete temp_params.headless
    const data = await grabs(temp_params)
    params.results = params.results.concat(data)
    await recursive_request(params)

  } else if (params.limit !== 0 ) {

    params = getKeySet(params)
    let temp_params = JSON.parse(JSON.stringify(params))
    delete temp_params.results
    delete temp_params.headless
    const data = await grabs(temp_params)
    params.results = params.results.concat(data)
    return params.results
  }

  return params.results
}

const grabsScraper = async (params) => {

  try {

    const data = await recursive_request(params)

    await storeAmazonData(data, params.headless)
    
    for (const entry of data) {

      entry._id = `${entry.type}:${entry.id}`
      await db.get(entry._id)
      .then(async (doc) => {

        merge(doc, entry)
        await db.put(doc)
      })
      .catch(async (error) => {

        if (error.name === 'not_found') {

          const item_attributes = entry.relationships.item.data.attributes

          let final_entry
          switch(item_attributes.shop_slug) {
            case 'amazon':
              final_entry = await addAmazonDataToItem(entry, item_attributes)
              break;
            default:
              final_entry = entry
          }
          try {
            await db.put(final_entry)
          } catch (error) {
            console.error('Error at grabsScraper().entry db.put(final_entry)', error)
          }

        } else {

          console.error('Error at grabsScraper().entry', error)
        }
      })
    }

  } catch (error) {

    console.error('Error at grabsScraper()', error)
  }
}

export {
  grabsScraper
}
