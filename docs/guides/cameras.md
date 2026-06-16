# 📷 Cameras

*Find, control, and stream every Wyze camera on your account from Node.js.*

The camera API in `wyze-node` covers the full lifecycle of working with a Wyze cam: discovering devices, flipping switches (power, motion detection, lights, siren), pulling thumbnails and cloud event clips, and negotiating a live WebRTC session to grab a real frame on demand. The sections below walk through each group with copy-paste examples.

Set up the client once and reuse it across every example on this page:

```js
const Wyze = require('wyze-node')
const wyze = new Wyze({ username, password, keyId, apiKey })
```

> **Note:** Methods that take a `device` argument expect a full camera device object as returned by the discovery helpers below (e.g. from `getCameraByName()`), not a bare MAC string.

## 🔎 Discovery

Use these helpers to enumerate the cameras on your account and filter by name or connection state.

| Method | Description |
| --- | --- |
| `getCameras()` | Returns every camera device object on the account. |
| `getCameraByName(name)` | Looks up a single camera by its nickname. |
| `getOnlineCameras()` | Returns only cameras currently reporting as online. |
| `getOfflineCameras()` | Returns only cameras currently reporting as offline. |

```js
// List every camera and its name
const cameras = await wyze.getCameras()
cameras.forEach(cam => console.log(cam.nickname, cam.mac))

// Grab one camera by its nickname
const driveway = await wyze.getCameraByName('Driveway')

// Split the fleet by connectivity
const online = await wyze.getOnlineCameras()
const offline = await wyze.getOfflineCameras()
console.log(`${online.length} online, ${offline.length} offline`)
```

## 🎛️ Controls

Each control method takes a camera `device` object and toggles a single feature. They come in matching on/off pairs so you can build automations in either direction.

| Method | Description |
| --- | --- |
| `cameraTurnOn(device)` / `cameraTurnOff(device)` | Powers the camera on or off. |
| `cameraMotionOn(device)` / `cameraMotionOff(device)` | Enables or disables motion detection. |
| `cameraNotificationsOn(device)` / `cameraNotificationsOff(device)` | Toggles push notifications for the camera. |
| `cameraMotionRecordingOn(device)` / `cameraMotionRecordingOff(device)` | Toggles event recording triggered by motion. |
| `cameraSoundNotificationOn(device)` / `cameraSoundNotificationOff(device)` | Toggles sound-based notifications. |
| `cameraFloodLightOn(device)` / `cameraFloodLightOff(device)` | Controls the attached flood light (supported models). |
| `cameraSpotLightOn(device)` / `cameraSpotLightOff(device)` | Controls the spotlight (supported models). |
| `cameraSirenOn(device)` / `cameraSirenOff(device)` | Sounds or silences the built-in siren. |

```js
const driveway = await wyze.getCameraByName('Driveway')

// Make sure the camera is powered on
await wyze.cameraTurnOn(driveway)

// Pause motion detection overnight, resume in the morning
await wyze.cameraMotionOff(driveway)
// ...later...
await wyze.cameraMotionOn(driveway)

// Flip on the lights and trip the siren during an alert
await wyze.cameraFloodLightOn(driveway)
await wyze.cameraSirenOn(driveway)
```

> **⚠️** Flood light, spotlight, and siren are only available on the camera models that ship with that hardware. Calling them on an unsupported model has no effect (or returns an error) — check `device.product_model` before wiring these into an automation.

## 🖼️ Thumbnails & Events

Pull the most recent cached thumbnail, page through cloud-recorded events, and resolve a playable URL for any event clip.

| Method | Description |
| --- | --- |
| `getCameraThumbnail(device)` | Returns the latest cached thumbnail URL (supported models only; not real-time). |
| `getEventList({ deviceMacList, count, beginTime, endTime })` | Lists cloud events for one or more cameras in a time window. |
| `getEventVideoURL({ deviceMac, deviceModel, beginTime, endTime })` | Resolves a cloud clip replay URL for an event. |

```js
const driveway = await wyze.getCameraByName('Driveway')

// Latest cached thumbnail URL (may be a few minutes old)
const thumbUrl = await wyze.getCameraThumbnail(driveway)

// List motion events from the last 24 hours
const now = Date.now()
const events = await wyze.getEventList({
  deviceMacList: [driveway.mac],
  count: 20,
  beginTime: now - 24 * 60 * 60 * 1000,
  endTime: now,
})

// Resolve a playable clip URL for the first event
if (events.length) {
  const ev = events[0]
  const clipUrl = await wyze.getEventVideoURL({
    deviceMac: driveway.mac,
    deviceModel: driveway.product_model,
    beginTime: ev.event_ts,
    endTime: ev.event_ts + 10 * 1000,
  })
  console.log('Replay:', clipUrl)
}
```

> **Note:** `getCameraThumbnail()` is **not** real-time and is only populated on some models — it reflects the last frame Wyze cached in the cloud, which can lag by minutes. When you need a fresh frame at the moment you ask for it, use `cameraCaptureSnapshot()` from the next section instead.

## 📡 Live Streaming (WebRTC)

Wyze cameras stream over AWS Kinesis Video WebRTC using H.264. These helpers expose the signaling details, the raw stream response, and a convenience path to capture a single live frame.

| Method | Description |
| --- | --- |
| `getCameraSignalingInfo(device)` | Returns `{ signalingUrl, iceServers, authToken }` for a WebRTC session. |
| `getCameraStreamInfo(device, { substream })` | Returns the raw stream-info response (optionally the lower-bitrate substream). |
| `cameraCaptureSnapshot(device, { timeoutMs })` | Negotiates a live WebRTC session and returns a single JPEG frame as a `Buffer`. |
| `saveCameraSnapshot(device, filePath)` | Captures a live frame and writes it to `filePath`, returning the path. |

`cameraCaptureSnapshot()` and `saveCameraSnapshot()` open a real WebRTC session and pull one frame through ffmpeg, so they need a few optional dependencies that aren't installed by default:

```bash
npm install werift ws ffmpeg-static
```

The ffmpeg binary is provided by `ffmpeg-static` — there's no separate system install to manage.

```js
const driveway = await wyze.getCameraByName('Driveway')

// Capture a fresh frame straight to disk
const path = await wyze.saveCameraSnapshot(driveway, './driveway.jpg')
console.log('Saved live snapshot to', path)

// Or get the JPEG in memory to forward elsewhere
const jpeg = await wyze.cameraCaptureSnapshot(driveway, { timeoutMs: 15000 })
console.log('Captured', jpeg.length, 'bytes')

// Inspect the underlying signaling details
const { signalingUrl, iceServers, authToken } = await wyze.getCameraSignalingInfo(driveway)
```

> **⚠️** The camera must be **online** to capture a live frame — an offline camera has no signaling URL, so `cameraCaptureSnapshot()` and `saveCameraSnapshot()` will fail. Filter with `getOnlineCameras()` (or check the device's connection state) before attempting a live capture.
