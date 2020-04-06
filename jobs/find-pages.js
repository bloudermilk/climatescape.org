const dot = require("dotenv")
const Airtable = require("airtable")
const puppeteer = require("puppeteer")
const _ = require("lodash")

dot.config({ path: `../.env.development` })

const LINK_TEST = /(?:career|job)/i
const LEVER_TEST = /\/\/api.lever.co\/v0\/postings\/([^\/\?]+)/i

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  "appNYMWxGF1jMaf5V"
)

async function main() {
  const organizations = await base("Organizations").select().firstPage()//.all()

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 800 }
  })

  // await findJobPage(browser, "https://rivian.com/")
  await detectPlatform(browser, "https://rivian.com/careers")

  // await asyncForEach(organizations, async organization => {
  //   await findJobPage(browser, organization.get("Homepage"))
  // })

  await browser.close()
}

async function detectPlatform(browser, url) {
  let detected

  const page = await browser.newPage()
  const client = await page.target().createCDPSession()

  await client.send("Network.enable")
  await client.send("Page.enable")

  const promise = new Promise((resolve, reject) => {
    client.on("Network.requestWillBeSent", async ({ request }) => {
      // We will detect only one platform
      if (detected) return

      const matchLever = request.url.match(LEVER_TEST)

      if (matchLever) resolve({
        platform: 'lever',
        context: {
          site: matchLever[1]
        }
      })
    })

    client.on("Page.loadEventFired", async timestamp => {
      console.log("load event", timestamp)

      // Sleep for a set amount of time AFTER the page has fully loaded, to allow
      // time for the site to contact the platform
      await sleep(3000)
      stopWaiting()
    })

    client.on("Page.lifecycleEvent", event => {
      console.log("lifecycle event", event)
    })

    console.log(`detectPlatform - ${url}`)
    await page.goto(url)
    await waiting
  })

  // Make sure we clean up the open page
  promise.finally(() => page.close())

  return promise
}

const sleep = async ms => new Promise(resolve => setTimeout(resolve, ms))

async function findJobPage(browser, url) {
  const page = await browser.newPage()
  const client = await page.target().createCDPSession()
  await client.send("DOM.enable")
  await client.send("Page.enable")

  const jobLinks = []

  client.on("Page.domContentEventFired", async ({ timestamp }) => {
    console.log("domContentEventFired", timestamp)

    const { root: document } = await client.send("DOM.getDocument")

    const { nodeIds: anchors } = await client.send("DOM.querySelectorAll", {
      nodeId: document.nodeId,
      selector: "a"
    })

    const anchorHtmls = await Promise.all(anchors.map(async nodeId => {
      const { outerHTML } = await client.send("DOM.getOuterHTML", { nodeId })

      return outerHTML
    }))

    const anchorAttributes = await Promise.all(anchors.map(async nodeId => {
      const { attributes } = await client.send("DOM.getAttributes", { nodeId })

      return _.chain(attributes).chunk(2).fromPairs().value()
    }))

    const tests = _.zip(anchorHtmls, anchorAttributes).map(([html, attributes]) => {
      if (html.match(LINK_TEST)) return attributes.href
    })

    const urls = _.chain(tests).compact().uniq().value()

    console.log(`Found ${urls.length} possible pages`, urls)
  })

  // client.on("Page.loadEventFired", timestamp => {
  //   console.log("load event", timestamp)
  // })

  console.log(`Loading ${url}`)

  await page.goto(url)
  await page.close()
  //
  // let data = await page.evaluate(() => {
  //   const pageTexts = ["jobs", "careers"]
  //   const links = document.querySelectorAll('a')
  //   links.forEach(link => {
  //     const text = link.innerText.toLowerCase().trim()
  //
  //     if (pageTexts.indexOf(text) >= 0) jobLinks.push(link)
  //   })
  // })

  console.log(jobLinks)
  // process.exit()
}

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

(async () => {
  try {
    await main();
  } catch (err) {
    console.error("main() failed with exception", err)
  }
})();
