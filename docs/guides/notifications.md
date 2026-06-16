# 🔔 Notifications & Events

*Wyze's notification feed, and how to forward it anywhere.*

Wyze delivers real-time push notifications to its mobile apps over FCM/APNs — a channel that **isn't reachable from the REST API**. So there's no "subscribe" call. What you *can* read is the thing those push messages are about: the **event feed** (motion, sound, person, package, etc.) — the same list the Wyze app's **Events** tab shows.

The pattern for "Wyze notifications → somewhere else" (an LCD, a webhook, a chat) is therefore **polling**: check the event list on an interval, forward anything new, and mark it read.

## 🛠️ Methods

| Method | Description |
| --- | --- |
| `getEventList({ deviceMacList, count, beginTime, endTime })` | Recent events (motion/sound/person/…) |
| `markEventsRead(events, { read })` | Mark events read (`read: false` to mark unread) |
| `cameraNotificationsOn/Off(device)` | Whether a camera *generates* notifications at all |

## ⏱️ Polling recipe

A small loop that forwards new events and dismisses them:

```js
const Wyze = require('wyze-node')
const wyze = new Wyze({ username, password, keyId, apiKey })

const seen = new Set()

async function pollOnce(onEvent) {
  const cams = await wyze.getOnlineCameras()
  const res = await wyze.getEventList({ deviceMacList: cams.map(c => c.mac), count: 20 })
  const events = (res.data && (res.data.event_list || res.data)) || []

  const fresh = events.filter(e => !seen.has(e.event_id))
  for (const e of fresh) {
    seen.add(e.event_id)
    onEvent(e)                       // forward to your LCD / webhook / etc.
  }
  if (fresh.length) await wyze.markEventsRead(fresh)   // dismiss in the app too
}

// every 20 seconds
setInterval(() => {
  pollOnce((e) => {
    console.log(new Date(Number(e.event_ts)).toLocaleString(),
                e.device_mac, '→', e.event_value)   // e.g. "Person", "Motion"
  }).catch(console.error)
}, 20_000)
```

> **Note:** Each event carries `event_id`, `device_mac`, `event_value` (the type),
> `event_ts`, `read_state`, and `file_list` / `event_resources` (thumbnail &
> clip URLs). Use `event_id` to de-duplicate across polls.

> **⚠️** Polling interval is up to you — every 15–30s is a sane balance. Wyze
> events usually appear within a few seconds of the trigger.

## What about true push?

There isn't a public path to it. Wyze's push tokens are tied to the mobile apps;
the event list is the supported, stable source — and it's exactly what a push
handler would hand you anyway.
