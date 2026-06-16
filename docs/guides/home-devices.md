# 🏠 Home Devices

*One library, every Wyze device in your house — vacuums, locks, switches, plugs, garage doors, and your whole-home security state.*

The `wyze-node` library speaks to a range of Wyze hardware, and some of these devices do not all live on the same backend. The robot vacuum, the lock, the wall switches, and the Home Monitoring System each sit behind a **separate Wyze service with its own request-signing scheme**. You never have to think about that — the library negotiates the right host and signs each request for you. You just call a method and pass it a device.

## Setup

Create a single client and reuse it for every device. The credentials below come from your Wyze account and a developer API key/key-ID pair.

```js
const Wyze = require('wyze-node')

const wyze = new Wyze({
  username: process.env.WYZE_USERNAME,
  password: process.env.WYZE_PASSWORD,
  keyId: process.env.WYZE_KEY_ID,
  apiKey: process.env.WYZE_API_KEY,
})
```

Most methods take a **device object** (the kind returned by the library's device-listing calls), not a raw MAC string. Where a method needs an identifier such as a UUID, the library derives it from the device's MAC for you.

---

## 🤖 Robot Vacuum

Drive a Wyze Robot Vacuum: read where it is in its cycle, send it off to clean, pause it mid-room, or call it home to the dock.

| Method | Description |
| --- | --- |
| `getVacuumStatus(device)` | Fetch the vacuum's current mode, battery level, and cleaning state. |
| `startVacuum(device)` | Begin a cleaning run. |
| `pauseVacuum(device)` | Pause the active run without returning to the dock. |
| `dockVacuum(device)` | Send the vacuum back to its charging dock. |
| `controlVacuum(device, type, value, rooms)` | Low-level control entry point — build custom commands and optionally target specific `rooms`. |

```js
// Kick off a cleaning run, let it work, then call it home.
const vacuum = /* your vacuum device object */

await wyze.startVacuum(vacuum)
console.log('Cleaning started…')

// …later, once the floors are done:
await wyze.dockVacuum(vacuum)
console.log('Vacuum is heading back to the dock.')
```

> **Note:** `controlVacuum` is the low-level primitive that the other vacuum helpers are built on. Reach for it only when you need a command the convenience methods don't cover, such as cleaning a hand-picked set of `rooms`.

---

## 🔒 Lock

Read the live state of a Wyze Lock and drive the deadbolt remotely.

| Method | Description |
| --- | --- |
| `getLockInfo(device)` | Return the lock's current state — locked/unlocked, battery percentage, and door status. |
| `lockDoor(device)` | Engage the deadbolt. |
| `unlockDoor(device)` | Retract the deadbolt and open the lock. |
| `controlLock(device, action)` | Low-level control where `action` is `'remoteLock'` or `'remoteUnlock'`. |

`getLockInfo(device)` accepts the lock device object directly; the UUID it needs internally is derived from the device's MAC automatically.

```js
// Check the lock's battery before you head out.
const lock = /* your lock device object */

const info = await wyze.getLockInfo(lock)
console.log(`Lock is ${info.locked ? 'LOCKED' : 'UNLOCKED'}`)
console.log(`Battery: ${info.power}%`)

if (info.power < 20) {
  console.warn('Lock battery is low — replace it soon.')
}
```

> **⚠️** `unlockDoor` physically retracts a real deadbolt and unlocks a real door. Always gate it behind your own authorization checks and confirmation logic — never call it on an unverified request.

---

## 🔘 Wall Switches

Control Wyze Wall Switches (model **`LD_SS1`**). These switches expose a set of IoT properties you can read and write, plus named helpers for the most common toggles.

| Method | Description |
| --- | --- |
| `getIotProp(device)` | Read the switch's full set of IoT properties. |
| `setIotProp(device, propKey, value)` | Write a single IoT property by key. |
| `wallSwitchPowerOn(device)` / `wallSwitchPowerOff(device)` | Switch the connected load on or off. |
| `wallSwitchIotOn(device)` / `wallSwitchIotOff(device)` | Enable or disable the switch's smart (IoT) control. |
| `wallSwitchLedOn(device)` / `wallSwitchLedOff(device)` | Turn the status LED on or off. |
| `wallSwitchVacationModeOn(device)` / `wallSwitchVacationModeOff(device)` | Toggle vacation mode. |

```js
// Turn off the hallway wall switch.
const wallSwitch = /* your LD_SS1 device object */

await wyze.wallSwitchPowerOff(wallSwitch)
console.log('Hallway switch is off.')

// Need finer control? Set an IoT property directly:
await wyze.setIotProp(wallSwitch, 'iot_state', 'disconnected')
```

> **Note:** The wall-switch methods are specific to the **`LD_SS1`** model. Confirm a device's model before calling them — other Wyze switches won't respond to these IoT properties.

---

## 🔌 Plugs

The simplest devices in the lineup: two methods, on and off.

| Method | Description |
| --- | --- |
| `plugTurnOn(device)` | Energize the plug. |
| `plugTurnOff(device)` | Cut power to the plug. |

```js
const plug = /* your plug device object */

await wyze.plugTurnOn(plug)   // power on
// …
await wyze.plugTurnOff(plug)  // power off
```

---

## 🚪 Garage Door

Trigger a Wyze garage door controller. This isn't a standalone device — the controller is wired to a Wyze camera, and `garageDoor` fires the controller through that camera.

| Method | Description |
| --- | --- |
| `garageDoor(device)` | Trigger the garage controller attached to a Wyze camera (toggles the door). |

```js
const camera = /* the camera that hosts your garage controller */

await wyze.garageDoor(camera)
console.log('Garage door triggered.')
```

---

## 🛡️ Home Monitoring (HMS)

The Home Monitoring System tracks one whole-home security state. First resolve your `hms_id`, then read or set the armed state: `'home'`, `'away'`, or `'off'`.

| Method | Description |
| --- | --- |
| `getHmsId()` | Resolve the account's HMS identifier (no device argument). |
| `getHmsState(hmsId)` | Read the current monitoring state for the given `hmsId`. |
| `setHmsState(hmsId, state)` | Set the state to `'home'`, `'away'`, or `'off'`. |

```js
// Arm the system to "away" as you leave.
const hmsId = await wyze.getHmsId()

await wyze.setHmsState(hmsId, 'away')
console.log('Home Monitoring armed: away')

const state = await wyze.getHmsState(hmsId)
console.log(`Current HMS state: ${state}`)
```

> **Note:** HMS requires an **active Wyze Home Monitoring subscription**. Without one, `getHmsId()` has no `hms_id` to return, and there is nothing to arm or disarm. Confirm the subscription is active before relying on these calls.
