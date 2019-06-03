import 'dotenv/config'
import {stringify} from 'querystring';
import {getRealDomain} from './index'
import {domains} from './index'

const getLoginUrl = (domain) => {
  const real_domain = domains.real[domains.parsed.indexOf(domain)]
  const flex = (domain === 'com') ? 'us' : domain
  const querystring = stringify({
    "_encoding":"UTF8",
    "ignoreAuthState:":"1",
    "openid.assoc_handle":`${flex}flex`,
    "openid.claimed_id":"http://specs.openid.net/auth/2.0/identifier_select",
    "openid.identity":"http://specs.openid.net/auth/2.0/identifier_select",
    "openid.mode":"checkid_setup",
    "openid.ns":"http://specs.openid.net/auth/2.0",
    "openid.ns.pape":"http://specs.openid.net/extensions/pape/1.0",
    "openid.pape.max_auth_age":"0"
  })
  return `https://www.amazon.${real_domain}/ap/signin?${querystring}`
}



const login = async (context, parsed_domain) => {
 
  const real_domain = getRealDomain(parsed_domain)

  const page = await context.newPage()

  const loginUrl = getLoginUrl(real_domain)
  await page.goto(loginUrl)

  const email = 'input[name="email"]'
  await page.waitForSelector(email)
  await page.type(email, process.env.AMAZON_USER)

  const password = 'input[name="password"]'
  await page.waitForSelector(password)
  await page.type(password, process.env.AMAZON_PASSWORD)

  const login = 'input#signInSubmit'
  await page.waitForSelector(login)
  await page.click(login)
  
  await page.close()
}

export {
  login
}