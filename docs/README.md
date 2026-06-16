<div align="center">

# 🥥 wyze-node

### *The unofficial Wyze API for Node — one small library for your whole Wyze home.*

[![npm](https://img.shields.io/npm/v/wyze-node?color=6c5ce7&label=npm)](https://www.npmjs.com/package/wyze-node)
[![node](https://img.shields.io/badge/node-%3E%3D14-43853d)](https://nodejs.org)
[![license](https://img.shields.io/badge/license-ISC-blue)](../LICENSE)

</div>

---

Control lights, plugs, cameras, the robot vacuum, the door lock, wall switches, and more — all from plain Node, no Home Assistant required. `wyze-node` talks directly to Wyze's own backend services and handles the messy parts (auth, token refresh, and the **four different request-signing schemes** Wyze uses across its services) so you don't have to.

```js
const Wyze = require('wyze-node')
const wyze = new Wyze({ username, password, keyId, apiKey })

const lamp = await wyze.getDeviceByName('Living Room Lamp')
await wyze.setColor(lamp, 'FF8800')        // warm orange
await wyze.setBrightness(lamp, 40)

const lock = await wyze.getDeviceByName('Front Door Lock')
console.log(await wyze.getLockInfo(lock))   // { locked, battery, … }
```

## ✨ Highlights

- 🔑 **Modern auth** — developer API Key flow with automatic token refresh
- 💡 **Lights & groups** — brightness, color, temperature; whole groups in one batched call
- 📷 **Cameras** — controls, thumbnails, events, and **live WebRTC snapshot capture**
- 🧹 **Vacuum**, 🔒 **lock**, 🔌 **plugs**, 🎚️ **wall switches**, 🚪 **garage**, 🛡️ **HMS**
- 🔐 **Four signed transports** reverse-engineered and unified — [see how](reference/transports.md)

## 📦 Supported devices

| Category | Examples | Guide |
|---|---|---|
| Lights & bulbs | color bulbs, white bulbs, light strips, groups | [Lights](guides/lights.md) |
| Cameras | controls, thumbnails, events, live snapshots | [Cameras](guides/cameras.md) |
| Vacuum / Lock / Switches / Plugs / Garage / HMS | the rest of the house | [Home Devices](guides/home-devices.md) |

## 🚀 Get started

1. **[Getting Started](getting-started.md)** — install, generate an API key, first call
2. **[Lights](guides/lights.md)** · **[Cameras](guides/cameras.md)** · **[Home Devices](guides/home-devices.md)**
3. **[Signing & Transports](reference/transports.md)** — the engineering deep-dive
4. **[Troubleshooting](troubleshooting.md)** — when things misbehave

> **Note:** This is an *unofficial* library that uses Wyze's internal app APIs. It isn't affiliated with or endorsed by Wyze, and a Wyze app update can change an endpoint at any time.
