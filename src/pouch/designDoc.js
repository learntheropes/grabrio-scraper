const grabs = {
  _id: '_design/grabs',
  views: {
    asin_is_null: {
      map: function (doc) {
        if (doc.type === "grabs" && doc.relationships.item.attributes.shop_slug === "amazon" && !doc.relationships.item.attributes.shop_asin) {
          emit(doc.id, null);
        }
      }.toString(),
      reduce: '_count'
    }
  },
  language: 'javascript',
}

const asins = {
  _id: '_design/asins',
  views: {
    attribute_is_null: {
      map: function(doc) {
        if (doc.type === 'asins' && doc.id) {
          ['brand', 'weight', 'categories']
          .filter(function(a) {
            return !doc.attributes[a]
          })
          .forEach(function(a)  {
            emit(a, doc.id)
          })
        }
      }.toString(),
      reduce: '_count'
    },
    all_attributes_are_null: {
      map: function(doc) {
        if (doc.type === 'asins' && doc.id && !doc.attributes.brand && !doc.attributes.weight && !doc.attributes.categories) {
          emit(doc.id, null)
        }
      }.toString(),
      reduce: '_count'
    },
    by_domain: function (doc) {
      if (doc.type === 'asins') {
        emit(doc.attributes.domain, doc._id);    
      }
    }.toString(),
    reduce: '_count'
  },
  language: 'javascript',
}

const pricings = {
  _id: '_design/pricings',
  views: {
    attribute_is_null: {
      map: function(doc) {
        if (doc.type === 'pricings' && doc.id && (doc.attributes.pricing.length === 0 || !doc.attributes.pricing) ) {
           emit(doc.id, null)
        }
      }.toString(),
      reduce: '_count'
    }
  },
  language: 'javascript',
}


export {
  asins,
  grabs,
  pricings
}