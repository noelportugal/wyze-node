'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const Wyze = require('../index.js')

const wyze = new Wyze({ username: 'test@example.com', password: 'x' })

// These all reject BEFORE any network call, so they're safe to run hermetically.

test('setColor rejects on non-mesh bulbs', async () => {
  await assert.rejects(
    () => wyze.setColor({ product_model: 'WLPA19', product_type: 'Light', mac: 'x' }, 'FF0000'),
    /only supported on color\/mesh/i
  )
})

test('setColor rejects malformed hex', async () => {
  await assert.rejects(
    () => wyze.setColor({ product_model: 'WLPA19C', product_type: 'MeshLight', mac: 'x' }, 'nothex'),
    /Invalid color/i
  )
})

test('setGroupColor rejects malformed hex', async () => {
  await assert.rejects(
    () => wyze.setGroupColor({ device_list: [] }, 'ZZZ'),
    /Invalid color/i
  )
})

test('setHmsState rejects an unknown mode', async () => {
  await assert.rejects(
    () => wyze.setHmsState('hms-id', 'bogus'),
    /Unknown HMS mode/i
  )
})

test('login throws without API key credentials', async () => {
  const noKey = new Wyze({ username: 'a@b.com', password: 'x' })
  await assert.rejects(() => noKey.login(), /developer API key/i)
})
