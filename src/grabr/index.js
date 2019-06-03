import axios from 'axios'
import find from 'lodash.find'
import merge from 'lodash.merge'
import {parseAttributes} from '../amazon/index'

const api = axios.create({
  baseURL: 'https://api.grabr.io/',
  timeout: 30000,
  headers: {'Accept': 'application/json;version=3'}
});
api.interceptors.response.use(response => response.data)

const fetch_builder = async (endpoint, params, include) => {

  const {id = ''} = params || {}
  if (id !== '') merge(params, {limit: 1})

  merge(params, {include})
  
  const {data, included} = await api.get(`/${endpoint}/${id}`, {params})

  for (const entry of data) {

    for (const relationship in entry.relationships) {

      const spec = entry.relationships[relationship].data
      if (spec) {
        const type = spec.type
        const id = spec.id
  
        let attributes = find(included, {id, type}).attributes
        if (type === 'items') attributes = parseAttributes(attributes)
        spec.attributes = attributes
      }
    }
  }
  return data
}

const grabs = async (params) => {
  return await fetch_builder('grabs', params, [
    'item','consumer','from','to','invoice'
  ])
}

const items = async (params) => {
  return await fetch_builder('items', params, [
    'from','images','collections','tags'
  ])
}

const itineraries = async (params) => {
  return await fetch_builder('itineraries', params, [
    'from','to','user','organization'
  ])
}

const locations = async (params) => {
  return await fetch_builder('locations', params, [])
}

const offers = async (id) => {
  return await fetch_builder('offers', params, [])
}

const users = async (id) => {
  return await fetch_builder('users', params, [])
}

const recursiveRequest = async (params, cb) => {

  params = getKeySet(params)
  let temp_params = JSON.parse(JSON.stringify(params))
  delete temp_params.results
  delete temp_params.headless

  if (params.limit >= 100) {

    params.limit = params.limit - 100
    temp_params.limit = 100
    const data = await cb(temp_params)
    params.results = params.results.concat(data)
    await recursiveRequest(params, cb)

  } else if (params.limit !== 0 ) {

    const data = await cb(temp_params)
    params.results = params.results.concat(data)
    return params.results
  }

  return params.results
}

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


export {
  grabs,
  items,
  itineraries,
  locations,
  offers,
  users,
  recursiveRequest
}
