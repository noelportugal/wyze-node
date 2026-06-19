'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const Wyze = require('../src/index.js')

const wyze = new Wyze({ username: 'test@example.com', password: 'x' })

test('isMeshBulb routes by model', () => {
  assert.equal(wyze.isMeshBulb({ product_model: 'WLPA19C' }), true)   // color bulb
  assert.equal(wyze.isMeshBulb({ product_model: 'HL_LSLP' }), true)   // light strip pro
  assert.equal(wyze.isMeshBulb({ product_model: 'WLPA19' }), false)   // white bulb
  // falls back to product_type when model is absent (group members lack it)
  assert.equal(wyze.isMeshBulb({ product_type: 'MeshLight' }), true)
})

test('isLightStrip identifies strips only', () => {
  assert.equal(wyze.isLightStrip({ product_model: 'HL_LSL' }), true)
  assert.equal(wyze.isLightStrip({ product_model: 'HL_LSLP' }), true)
  assert.equal(wyze.isLightStrip({ product_model: 'WLPA19C' }), false)
})

test('deviceMac normalizes device vs group-member shapes', () => {
  assert.equal(wyze.deviceMac({ mac: 'AABBCC' }), 'AABBCC')
  assert.equal(wyze.deviceMac({ device_mac: 'DDEEFF' }), 'DDEEFF')   // group member
})

test('lockUuid strips the model prefix', () => {
  assert.equal(wyze.lockUuid({ mac: 'YD_BT1.c508eafa7d5e' }), 'c508eafa7d5e')
  assert.equal(wyze.lockUuid({ mac: 'NOPREFIXMAC' }), 'NOPREFIXMAC')
})

test('vacuumDid prefers did, then mac', () => {
  assert.equal(wyze.vacuumDid({ did: 'D1' }), 'D1')
  assert.equal(wyze.vacuumDid({ mac: 'M1' }), 'M1')
  assert.equal(wyze.vacuumDid({ device_mac: 'DM1' }), 'DM1')
})

test('_normalizeStreamBundle maps url->urls for werift', () => {
  const out = wyze._normalizeStreamBundle({
    signalingUrl: 'wss://kv.example/path',
    iceServers: [
      { url: 'turn:host:443', username: 'u', credential: 'c' },
      { url: 'stun:stun.example:19302' },
      { /* junk with no url */ foo: 'bar' },
    ],
  })
  assert.equal(out.signalingUrl, 'wss://kv.example/path')
  assert.deepEqual(out.iceServers, [
    { urls: 'turn:host:443', username: 'u', credential: 'c' },
    { urls: 'stun:stun.example:19302' },
  ])
})

test('_normalizeStreamBundle decodes a doubly-encoded signaling URL', () => {
  const out = wyze._normalizeStreamBundle({
    signalingUrl: 'wss://kv.example/?X-Amz-Credential=AKIA%252Fus-west-2',
    iceServers: [],
  })
  assert.equal(out.signalingUrl, 'wss://kv.example/?X-Amz-Credential=AKIA%2Fus-west-2')
})

test('isTokenError matches all of Wyze\'s expired-token shapes', () => {
  // legacy message
  assert.equal(wyze.isTokenError({ msg: 'AccessTokenError' }), true)
  // newer shape: code 2001 with a different message
  assert.equal(wyze.isTokenError({ msg: 'access token is error', code: 2001 }), true)
  assert.equal(wyze.isTokenError({ code: '2001' }), true)   // code as string
  assert.equal(wyze.isTokenError({ ErrNo: '2001' }), true)  // ErrNo variant
  // not token errors
  assert.equal(wyze.isTokenError({ msg: 'SUCCESS', code: 1 }), false)
  assert.equal(wyze.isTokenError({}), false)
  assert.equal(wyze.isTokenError(null), false)
  assert.equal(wyze.isTokenError(undefined), false)
})
