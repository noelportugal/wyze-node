#!/usr/bin/env node
'use strict'

/**
 * Interactive Wyze login / token bootstrap.
 *
 * Prompts for your Wyze email + password (the password is NOT echoed and is
 * never written to disk), logs in using your developer API key, and caches the
 * resulting refresh token. After this runs once, future calls renew via the
 * refresh token, so you won't be asked for the password again.
 *
 * The Key ID + API Key are read from the environment (WYZE_KEY_ID /
 * WYZE_API_KEY) and you'll be prompted for anything that's missing. Generate
 * them (free) at: https://developer-api-console.wyze.com/#/apikey/view
 *
 * Usage:  WYZE_KEY_ID=xxx WYZE_API_KEY=yyy node bin/wyze-login.js
 *     or: npm run login
 */

const path = require('path')
const readline = require('readline')

// Keep the token store (./scratch) next to the package, not the caller's cwd.
process.chdir(path.join(__dirname, '..'))
const Wyze = require('../index.js')

// One shared interface for every prompt (sequential reuse works on both a TTY
// and piped stdin; a fresh interface per prompt closes the stream on a pipe).
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function ask(query) {
  return new Promise((resolve) => rl.question(query, (a) => resolve(a.trim())))
}

// Prompt without echoing keystrokes (for the password).
function askHidden(query) {
  return new Promise((resolve) => {
    let shown = false
    const original = rl._writeToOutput.bind(rl)
    rl._writeToOutput = () => {
      if (!shown) { rl.output.write(query); shown = true } // show the prompt once, swallow keystrokes
    }
    rl.question(query, (value) => {
      rl.output.write('\n')
      rl._writeToOutput = original
      resolve(value)
    })
  })
}

;(async () => {
  try {
    const email = process.env.WYZE_EMAIL || await ask('Wyze email: ')
    const password = await askHidden('Wyze password (hidden): ')
    const keyId = process.env.WYZE_KEY_ID || await ask('Wyze Key ID: ')
    const apiKey = process.env.WYZE_API_KEY || await ask('Wyze API Key: ')

    if (!email) throw new Error('Email is required.')
    if (!password) throw new Error('Password is required.')
    if (!keyId || !apiKey) throw new Error('Key ID and API Key are required (https://developer-api-console.wyze.com/#/apikey/view).')

    const wyze = new Wyze({ username: email, password, keyId, apiKey })

    process.stdout.write('\nLogging in… ')
    await wyze.login()

    const devices = await wyze.getDeviceList()
    console.log('OK ✅')
    console.log(`Logged in as ${email}. Found ${devices.length} device(s).`)
    console.log("Refresh token cached — future runs won't need your password.")
  } catch (e) {
    const detail = e && e.response && e.response.data
      ? JSON.stringify(e.response.data)
      : (e && e.message) || String(e)
    console.error('\nLogin failed: ' + detail)
    process.exitCode = 1
  } finally {
    rl.close()
  }
})()
