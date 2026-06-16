'use strict'
const crypto = require('crypto')

// Low-level signing primitives shared by the signed Wyze transports
// (venus / ford / olive / web). Each transport combines these differently.

const md5hex = (s) => crypto.createHash('md5').update(String(s)).digest('hex')

const hmacMd5 = (key, body) => crypto.createHmac('md5', key).update(body).digest('hex')

// Python urllib quote_plus equivalent (used inside the ford signature).
const quotePlus = (s) => encodeURIComponent(s)
  .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  .replace(/%20/g, '+')

// Stable "k=v&k=v" join with keys sorted — the basis of several signatures.
const sortedParams = (obj) => Object.keys(obj).sort().map(k => `${k}=${obj[k]}`).join('&')

module.exports = { md5hex, hmacMd5, quotePlus, sortedParams }
