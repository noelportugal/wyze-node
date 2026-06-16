'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { md5hex, hmacMd5, quotePlus, sortedParams } = require('../src/crypto')

test('md5hex matches known vectors', () => {
  assert.equal(md5hex(''), 'd41d8cd98f00b204e9800998ecf8427e')
  assert.equal(md5hex('abc'), '900150983cd24fb0d6963f7d28e17f72')
  // coerces non-strings
  assert.equal(md5hex(123), md5hex('123'))
})

test('hmacMd5 matches the RFC test vector', () => {
  // HMAC-MD5("key", "The quick brown fox jumps over the lazy dog")
  assert.equal(
    hmacMd5('key', 'The quick brown fox jumps over the lazy dog'),
    '80070713463e7749b90c2dc24911e275'
  )
})

test('sortedParams sorts keys and joins k=v', () => {
  assert.equal(sortedParams({ b: '2', a: '1', c: '3' }), 'a=1&b=2&c=3')
  assert.equal(sortedParams({ nonce: '9', did: 'X' }), 'did=X&nonce=9')
  assert.equal(sortedParams({}), '')
})

test('quotePlus matches Python urllib.parse.quote_plus', () => {
  // spaces become '+', reserved chars are percent-encoded
  assert.equal(quotePlus('a b/c=d&e'), 'a+b%2Fc%3Dd%26e')
  // the !'()* set that encodeURIComponent leaves alone must still be encoded
  assert.equal(quotePlus("a!'()*b"), 'a%21%27%28%29%2Ab')
  // unreserved chars pass through untouched
  assert.equal(quotePlus('Aa0-_.~'), 'Aa0-_.~')
})

test('the olive/venus/web signature shape is reproducible', () => {
  // signature2 = HMAC-MD5( md5(token + salt), body )
  const token = 'TESTTOKEN'
  const salt = 'TESTSALT'
  const body = 'did=X&nonce=1'
  const expected = hmacMd5(md5hex(token + salt), body)
  // recomputing the same inputs must yield the same signature (determinism)
  assert.equal(hmacMd5(md5hex(token + salt), body), expected)
  assert.match(expected, /^[0-9a-f]{32}$/)
})
