require("log-timestamp") // Adds timestamps to console.log() output
const dotenv = require("dotenv")
const { camelCase, toPairs, fromPairs } = require("lodash")

// Unlike NODE_ENV, this solution doesn't require any local setup moves from devs, nor setting any configs in Heroku.
// See https://stackoverflow.com/a/28489160
const isProduction = !!(process.env._ && process.env._.indexOf("heroku") >= 0)
console.log(`isProduction: ${isProduction}`)

async function sleep(timeMs) {
  await new Promise(resolve => setTimeout(resolve, timeMs))
}

function configureEnvironment() {
  if (!isProduction) {
    dotenv.config({
      path: `../.env.development`,
    })
  }
}

/**
 * This is different from {@link setInterval} because the time to execute the function is not taken into account
 * @param {function: Promise<any>} fn
 * @param {number} delayMs
 */
function executeWithFixedDelayAsync(fn, delayMs) {
  setTimeout(function wrapper() {
    fn()
      .then(() => setTimeout(wrapper, delayMs))
      .catch(err => console.error(err))
  }, delayMs)
}

/**
 * Converts URLs like http://twitter.com/something to just "something", cleaning the tail slash if needed.
 * @param {string} urlString
 * @returns {string}
 */
function getCleanPath(urlString) {
  const url = new URL(urlString)
  let path = url.pathname.substring(1) // Remove leading "/"
  if (path.charAt(path.length - 1) === "/") {
    path = path.substring(0, path.length - 1)
  }
  return path
}

// Given a URL, return just the domain. Strip the subdomain if it equals "www"
function getUrlDomain(string) {
  let hostname

  try {
    ;({ hostname } = new URL(string))
  } catch {
    return null
  }

  return hostname.startsWith("www.") ? hostname.substr(4) : hostname
}

// Given an `object`, return a new object converted to camelCase
function camelizeKeys(object) {
  return fromPairs(toPairs(object).map(([k, v]) => [camelCase(k), v]))
}

module.exports = {
  isProduction,
  sleep,
  configureEnvironment,
  executeWithFixedDelayAsync,
  getCleanPath,
  getUrlDomain,
  camelizeKeys,
}
