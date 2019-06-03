import {db} from '../pouch/index'
import merge from 'lodash.merge'
import find from 'lodash.find'

const observeDbChanges = () => {
  db.changes({
    since: 'now',
    live: true,
    include_docs: true
  }).on('change', async (change) => {
    await updatedAsinAttributes(change)
    await updatedPricingAttributes(change)

  }).on('error', (error) => {

    console.error('Error at db.change', error)
  });
}

const updatedAsinAttributes = async (change) => {
  try {
    if (!change.deleted && !change.doc._rev.startsWith('1-') && change.doc.type === 'asins') {

      const old_docs = await db.allDocs({include_docs: true})

      const new_docs = old_docs.rows
      .filter(doc => doc.doc.type === 'grabs' && doc.doc.relationships.asin.data.id === change.doc.id)
      .map(doc => {
        merge(doc.doc.relationships.asin.data.attributes, change.doc.attributes)
        return doc.doc
      })

      await db.bulkDocs(new_docs)
    }
  } catch (error) {

    console.error('Error at updatedAsinAttributes()', error)
  }
}

const updatedPricingAttributes = async (change) => {
  try {
    if (!change.deleted && !change.doc._rev.startsWith('1-') && change.doc.type === 'pricings') {

      const old_docs = await db.allDocs({include_docs: true})

      const old_doc = find(old_docs.rows, {type: 'grabs', id: change.doc.id})

      if (old_doc) {

        const new_docs = merge(old_doc, change.doc.attributes)
        
        await db.put(new_docs)
      }
    }
  } catch (error) {

    console.error('Error at updatedPricingAttributes()', error)
  }
}

export {
  observeDbChanges
}