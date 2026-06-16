# 🚀 Getting Started

*From zero to controlling your first device in about five minutes.*

## 1. Install

```bash
npm install wyze-node
```

For **live camera snapshot capture** you also need three optional packages (skip if you don't need streaming):

```bash
npm install werift ws ffmpeg-static
```

## 2. Get a Wyze API key

Since 2023 Wyze requires a developer **API Key** in addition to your account login. It's free:

1. Go to the [Wyze Developer Console](https://developer-api-console.wyze.com/#/apikey/view)
2. Sign in with your Wyze account → **Create API Key**
3. Copy the **Key ID** and **API Key**

> **Note:** The API key doubles as your second factor, so logins work headlessly even with 2FA enabled.

## 3. First call

```js
const Wyze = require('wyze-node')

const wyze = new Wyze({
  username: process.env.WYZE_EMAIL,
  password: process.env.WYZE_PASSWORD,
  keyId:    process.env.WYZE_KEY_ID,
  apiKey:   process.env.WYZE_API_KEY,
})

;(async () => {
  const devices = await wyze.getDeviceList()
  for (const d of devices) {
    console.log(`${d.nickname} — ${d.product_type} (${d.product_model})`)
  }
})()
```

The first successful login caches a **refresh token** (in a local `scratch/` folder), so subsequent runs renew automatically and never need your password again.

> **⚠️** Keep your password and API key out of source control. Use environment variables or a gitignored file — never commit them.

## 4. Find and control a device

Most helpers take a **device object** from `getDeviceByName` / `getDeviceByMac`:

```js
const lamp = await wyze.getDeviceByName('Living Room Lamp')
await wyze.turnOn(lamp)
await wyze.setBrightness(lamp, 60)
```

## Where next

- 💡 [Lights & Bulbs](guides/lights.md)
- 📷 [Cameras](guides/cameras.md) (incl. live snapshots)
- 🏠 [Home Devices](guides/home-devices.md) — vacuum, lock, switches, plugs, garage, HMS
- 🔐 [Signing & Transports](reference/transports.md)
- 🛠️ [Troubleshooting](troubleshooting.md)
