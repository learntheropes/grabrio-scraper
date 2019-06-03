import {recursiveRequest, grabs} from './grabr/index'
import {db} from './pouch/index'
import {storeAmazonData, addAmazonDataToItem} from './amazon/index'
import merge from 'lodash.merge'

const grabsScraper = async (params) => {

  try {

    const data = await recursiveRequest(params, grabs)

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

          await db.put(final_entry)
          .catch(error => console.error('Error at grabsScraper().entry db.put(final_entry)', error))

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
