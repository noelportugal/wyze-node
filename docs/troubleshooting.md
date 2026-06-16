# 🛠️ Troubleshooting

*Common snags and how to clear them.*

## 🔑 Login fails / no tokens

**Symptom:** `login()` throws, or calls return `AccessTokenError`.

- Make sure you passed a **Key ID and API Key** (`keyId` / `apiKey`), not just username/password. Wyze's old password-only login no longer issues tokens. Generate keys at the [Developer Console](https://developer-api-console.wyze.com/#/apikey/view).
- Delete the cached `scratch/` folder to force a fresh login, then run again.
- Double-check the account email/password are correct and the API key hasn't been revoked.

## 🔴 A device won't respond (code `3019`)

`3019` means **device offline** — Wyze's cloud can't reach it. The command is valid; the device just isn't connected (powered off at the wall, off Wi‑Fi, or unplugged). Check the device in the Wyze app, then retry.

> **Note:** A group command returns a per-member result list, so 5 of 7 bulbs may succeed while 2 offline ones report `3019`. That's expected.

## 💡 `setColor` throws "only supported on color/mesh bulbs"

`setColor` only works on color/mesh bulbs and light strips. Plain white bulbs have no color channel — use `setBrightness` / `setColorTemp` instead.

## 📷 Camera snapshot capture issues

**`needs the optional deps werift / ws / ffmpeg-static`**
Install them: `npm install werift ws ffmpeg-static`.

**`No signaling URL returned for this camera`**
The camera is offline. Live capture needs an online camera — check `getOnlineCameras()`.

**`ffmpeg not found`**
`ffmpeg-static` failed to fetch a binary for your platform. Re-run `npm install`, or install `ffmpeg` on your system PATH as a fallback.

**My script hangs after capturing a frame**
The WebRTC stack (werift) keeps the Node event loop alive after a capture. For a one-shot CLI tool, call `process.exit(0)` once you've saved the image:

```js
const path = await wyze.saveCameraSnapshot(cam, 'frame.jpg')
console.log('saved', path)
process.exit(0)
```

## 🛡️ HMS: `getHmsId()` returns null

HMS arm/disarm requires an **active Wyze Home Monitoring subscription** — that's what binds an `hms_id` to your account. Without the subscription the plan-binding list is empty and there's nothing to arm.

## 🌐 A call suddenly 404s or returns garbage

This is an *unofficial* API built on Wyze's internal app endpoints. A Wyze app update can move or change an endpoint. If something that worked stops working, an endpoint or signing secret may have rotated — check for a library update or open an issue.
