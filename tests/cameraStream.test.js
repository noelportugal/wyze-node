'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { makeDeadline } = require('../src/cameraStream.js')

// Regression: a successful capture used to leave the timeout's setTimeout
// pending for the rest of timeoutMs, holding the event loop open so a one-shot
// CLI caller never exited. makeDeadline must clear its timer on cancel().

test('makeDeadline rejects after the timeout elapses', async () => {
  const d = makeDeadline(10)
  // The deadline timer is unref'd (so it can't keep a real process alive). On
  // Node 18 the test runner exits the loop when only unref'd timers remain, so
  // hold it open with a ref'd timer until the deadline has had time to fire.
  const keepAlive = setTimeout(() => {}, 1000)
  try {
    await assert.rejects(() => d.promise, /timed out after 10ms/)
  } finally {
    clearTimeout(keepAlive)
  }
})

test('cancel() clears the timer and stops it from firing', async () => {
  const d = makeDeadline(20)
  d.cancel()
  // Wait past the original deadline; the promise must stay pending (never reject).
  const settled = await Promise.race([
    d.promise.then(() => 'resolved', () => 'rejected'),
    new Promise((r) => setTimeout(() => r('still-pending'), 60)),
  ])
  assert.equal(settled, 'still-pending')
})

test('cancel() leaves no active Timeout holding the event loop', async () => {
  const before = process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length
  const d = makeDeadline(10_000)
  d.cancel()
  const after = process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length
  // The unref'd timer is cleared, so it must not add a live Timeout resource.
  assert.equal(after, before)
})

test('cancel() is idempotent', () => {
  const d = makeDeadline(50)
  d.cancel()
  assert.doesNotThrow(() => d.cancel())
})
