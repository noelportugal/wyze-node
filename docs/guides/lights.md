# 💡 Lights & Bulbs

*Control Wyze bulbs and light strips — brightness, color temperature, and full color — from Node.js.*

`wyze-node` exposes a small set of helpers for driving Wyze lighting. Most methods take a single bulb (looked up by name), while a parallel set of `*Group` methods act on a whole room at once. The library inspects each device's model and routes the request to the correct Wyze endpoint for you, so the same helper works for plain white bulbs and color mesh bulbs alike.

## 🔌 Setup

Every example below assumes you've created a client. Do this once and reuse it:

```js
const Wyze = require('wyze-node')
const wyze = new Wyze({ username, password, keyId, apiKey })
```

## 🛠️ Methods

| Method | Description |
| --- | --- |
| `getDeviceByName(name)` | Fetch a single device object by its display name. |
| `getDeviceGroupByName(name)` | Fetch a device group (room) object by its name. |
| `turnOn(device)` | Power a single bulb on. |
| `turnOff(device)` | Power a single bulb off. |
| `setBrightness(device, 0-100)` | Set brightness as a percentage (`0`–`100`). |
| `setColorTemp(device, kelvin)` | Set white color temperature, roughly `1800`–`6500` K. |
| `setColor(device, 'RRGGBB')` | Set an RGB color. Color/mesh bulbs only; throws otherwise. |
| `setSunMatch(device, on)` | Toggle Sun Match (auto-adjusting daylight) on or off. |
| `turnOnGroup(group)` | Power every bulb in a group on. |
| `turnOffGroup(group)` | Power every bulb in a group off. |
| `setGroupBrightness(group, 0-100)` | Set brightness for an entire group. |
| `setGroupColorTemp(group, kelvin)` | Set color temperature for an entire group. |
| `setGroupColor(group, 'RRGGBB')` | Set RGB color for an entire group. |

## 🌅 Single-bulb examples

### Dim a lamp and warm it to orange

This pulls one color bulb by name, drops it to a soft 25% brightness, and washes it in a warm orange. Because `setColor` only applies to color/mesh bulbs, this snippet assumes the device is one (e.g. a WLPA19C).

```js
const Wyze = require('wyze-node')
const wyze = new Wyze({ username, password, keyId, apiKey })

async function cozyLamp() {
  const lamp = await wyze.getDeviceByName('Living Room Lamp')

  await wyze.turnOn(lamp)
  await wyze.setBrightness(lamp, 25)
  await wyze.setColor(lamp, 'FF7A1A') // warm orange
}

cozyLamp()
```

### Set a daylight-matched white bulb

A plain white bulb can't take an RGB value, but it handles brightness, color temperature, and Sun Match. Here we let Sun Match drive the tone automatically:

```js
const Wyze = require('wyze-node')
const wyze = new Wyze({ username, password, keyId, apiKey })

async function naturalLight() {
  const bulb = await wyze.getDeviceByName('Office Bulb')

  await wyze.turnOn(bulb)
  await wyze.setBrightness(bulb, 80)
  await wyze.setSunMatch(bulb, true)
}

naturalLight()
```

> **⚠️ Note:** If a bulb is offline, Wyze returns error code **3019** and the command quietly fails — the bulb can't be controlled until it's back on the network and reachable. Check that a device is online before relying on a state change, since the helper won't be able to apply the property.

## 🏠 Group examples

Group helpers operate on a whole room. For mesh members, the library bundles the change into a **single batched API call** rather than firing one request per bulb, so setting a room of bulbs is fast and atomic from the user's point of view.

### Warm an entire room at once

```js
const Wyze = require('wyze-node')
const wyze = new Wyze({ username, password, keyId, apiKey })

async function warmTheRoom() {
  const room = await wyze.getDeviceGroupByName('Bedroom')

  await wyze.turnOnGroup(room)
  await wyze.setGroupBrightness(room, 40)
  await wyze.setGroupColorTemp(room, 2200) // candle-like warmth
}

warmTheRoom()
```

### Paint a room a single color

```js
const Wyze = require('wyze-node')
const wyze = new Wyze({ username, password, keyId, apiKey })

async function partyMode() {
  const room = await wyze.getDeviceGroupByName('Game Room')

  await wyze.turnOnGroup(room)
  await wyze.setGroupColor(room, '8A2BE2') // violet
}

partyMode()
```

## 🧠 How routing works

You don't have to think about which Wyze endpoint a bulb needs — the library decides from the model:

- **Mesh bulbs** (`WLPA19C`) and **light strips** (`HL_LSL`, `HL_LSLP`) apply their properties through a batched `run_action_list` using `set_mesh_property`. A group change for these members is collapsed into one `run_action_list` call.
- **Plain white bulbs** apply changes through a straightforward `set_property` request.

Both paths are hidden behind the same helpers, so calling `setBrightness` or `setColorTemp` does the right thing regardless of which kind of bulb you handed it. The one exception is `setColor`: it requires a color/mesh bulb and will throw if you pass a white bulb or an invalid hex string.
