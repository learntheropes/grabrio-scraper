import puppeteer from 'puppeteer'

async function chromium(headless) {
  if (typeof headless === 'undefined') headless = true

  return await puppeteer.launch({
    timeout: 0,
    headless,
    devtools: true,
    // defaultViewport: {
    //   width: 1323,
    //   height: 1200
    // },
    args: [
      `--user-agent=Mozilla/5.0 (X11; Linux x86_64)
      AppleWebKit/537.36 (KHTML, like Gecko)
      Ubuntu Chromium/73.0.3683.86 Chrome/73.0.3683.86 Safari/537.36`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '-disable-gpu',
      '--no-first-run',
      '--disable-notifications',
      // '--window-size=2000,1200',
    ]
  })
}

async function blockRequests(page, urls) {

  await page.setRequestInterception(true)
  
  page.on('request', (request) => {
    const url = request.url();
    const shouldAbort = urls.some((urlPart) => url.includes(urlPart))
    if (shouldAbort) request.abort()
    else if (request.resourceType() === ('image' || 'stylesheet' || 'font')) request.abort()
    else request.continue();
  })
}

async function concurrentBrowserTabs(browser, args) {

  const {tabs, cb} = args

  let promises = []

  if (tabs.length > 0) {

    for (let index = 0; index < tabs.length; index++) {

      const promise = cb(browser, tabs[index])
      // .catch(error => console.error(`${arr[index].ASIN} : ${error}`))
      
      promises.push(promise)
    }
    await Promise.all(promises);
  }
}


export {
  chromium,
  blockRequests,
  concurrentBrowserTabs
}