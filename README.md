# wyze-node

> ✅ **Working again (June 2026).** Wyze's 2023 auth change broke the old
> password-only login; the library now uses the current developer **API Key**
> flow. See [API Key required](#api-key-required) below to get set up.

This is an unofficial Wyze API. This library uses the internal APIs from the Wyze mobile app. A list of all Wyze devices can be retrieved to check the status of Wyze Cameras, Wyze Sense, Wyze Bulbs, Wyze Plugs and possibly Wyze locks (untested). This API can turn on and off cameras, lightbulbs and smart plugs.

## Setup
`npm install wyze-node --save`

### API Key required
Since 2023 Wyze requires a **developer API Key** in addition to your account
login. Generate one (free) at
[developer-api-console.wyze.com](https://developer-api-console.wyze.com/#/apikey/view)
→ **Create API Key**. You'll get a `Key Id` and an `API Key`. The API key acts
as your second factor, so it works headlessly even with 2FA enabled.

Pass them as `keyId` / `apiKey` options, or via the `WYZE_KEY_ID` /
`WYZE_API_KEY` environment variables.

### Interactive login (recommended)
So you don't have to store your account password anywhere, bootstrap once with
the interactive login. It prompts for your email + password (the password is
**not echoed and never written to disk**), then caches a refresh token so future
runs renew automatically — no password needed again.

```
WYZE_KEY_ID=xxxx WYZE_API_KEY=yyyy npm run login
```

After it succeeds you only need the Key ID / API Key going forward; the cached
refresh token handles the rest.

## Example
```
const Wyze = require('wyze-node')

const options = {
  username: process.env.username,
  password: process.env.password,
  keyId: process.env.WYZE_KEY_ID,
  apiKey: process.env.WYZE_API_KEY
}
const wyze = new Wyze(options)

  ; (async () => {
    let device, state, result

    // Get all Wyze devices
    const devices = await wyze.getDeviceList()
    console.log(devices)

    // Get a Wyze Bulb by name and turn it off.
    device = await wyze.getDeviceByName('Porch Light')
    result = await wyze.turnOff(device)
    console.log(result)

    // Get the state of a Wyze Sense contact sensor
    device = await wyze.getDeviceByName('Front Door')
    state = await wyze.getDeviceState(device)
    console.log(`${device.nickname} is ${state}`)

  })()
```

## Run
`username=first.last@email.com password=123456 WYZE_KEY_ID=xxxx WYZE_API_KEY=yyyy node index.js`

## Helper methods

Use this helper methods to interact with wyze-node.

- wyze.getDeviceList()
- wyze.getDeviceByName(nickname)
- wyze.getDeviceByMac(mac)
- wyze.getDevicesByType(type)
- wyze.getDevicesByModel(model)
- wyze.getDeviceGroupsList()
- wyze.getDeviceSortList()
- wyze.turnOn(device)
- wyze.turnOff(device)
- wyze.getDeviceStatus(device)
- wyze.getDeviceState(device)

## Bulb / light helpers

These take a `device` object (from `getDeviceByName` / `getDeviceByMac`) and
automatically pick the right transport: mesh bulbs and light strips apply
properties via `set_mesh_property`; regular bulbs use `set_property`.

- wyze.setBrightness(device, brightness)  // 0-100
- wyze.setColorTemp(device, kelvin)       // ~1800-6500 K
- wyze.setColor(device, 'RRGGBB')         // color/mesh bulbs only, e.g. 'FF0000'
- wyze.setSunMatch(device, on)            // mimic natural sunlight

```
const bulb = await wyze.getDeviceByName('Noel’s Lamp')
await wyze.setBrightness(bulb, 40)
await wyze.setColor(bulb, 'FF8800')   // warm orange
await wyze.setColorTemp(bulb, 2700)   // or back to warm white
```

## Group helpers

Wyze has no native group-action API, so these fan out to a group's members.
Mesh bulbs are applied in a single batched `run_action_list` call; any non-mesh
members fall back to per-device `set_property`.

- wyze.getDeviceGroupByName(name)
- wyze.turnOnGroup(group)
- wyze.turnOffGroup(group)
- wyze.setGroupBrightness(group, brightness)   // 0-100
- wyze.setGroupColorTemp(group, kelvin)        // ~1800-6500 K
- wyze.setGroupColor(group, 'RRGGBB')          // color/mesh bulbs

```
const office = await wyze.getDeviceGroupByName('Office Lights')
await wyze.setGroupColorTemp(office, 3000)   // all 7 bulbs, one request
await wyze.turnOffGroup(office)
```

## Camera helpers

- wyze.getCameraThumbnail(device)  // latest thumbnail URL (supported models only; not real-time)
- wyze.getCameras()
- wyze.getCameraByName(name)
- wyze.getOnlineCameras() / wyze.getOfflineCameras()

### Camera controls

- wyze.cameraTurnOn(device) / wyze.cameraTurnOff(device)
- wyze.cameraMotionOn(device) / wyze.cameraMotionOff(device)        // motion detection
- wyze.cameraNotificationsOn(device) / wyze.cameraNotificationsOff(device)
- wyze.cameraMotionRecordingOn(device) / wyze.cameraMotionRecordingOff(device)
- wyze.cameraSoundNotificationOn(device) / wyze.cameraSoundNotificationOff(device)
- wyze.cameraFloodLightOn(device) / wyze.cameraFloodLightOff(device)
- wyze.cameraSpotLightOn(device) / wyze.cameraSpotLightOff(device)
- wyze.cameraSirenOn(device) / wyze.cameraSirenOff(device)

```
const cam = await wyze.getCameraByName('Driveway')
const url = await wyze.getCameraThumbnail(cam)
await wyze.cameraMotionOff(cam)   // pause motion detection
```

## Plug controls

- wyze.plugTurnOn(device)
- wyze.plugTurnOff(device)

## Wall switch controls (LD_SS1)

- wyze.getIotProp(device[, keys])  // read switch state
- wyze.setIotProp(device, propKey, value)  // low-level
- wyze.wallSwitchPowerOn(device) / wyze.wallSwitchPowerOff(device)
- wyze.wallSwitchIotOn(device) / wyze.wallSwitchIotOff(device)
- wyze.wallSwitchLedOn(device) / wyze.wallSwitchLedOff(device)
- wyze.wallSwitchVacationModeOn(device) / wyze.wallSwitchVacationModeOff(device)

## Garage door

- wyze.garageDoor(device)  // triggers a garage controller attached to a Wyze cam

## Home Monitoring System (HMS)

Requires an active Wyze Home Monitoring subscription (that's what binds an
`hms_id` to your account).

- wyze.getHmsId()
- wyze.getHmsState(hmsId)
- wyze.setHmsState(hmsId, 'home' | 'away' | 'off')

```
const hmsId = await wyze.getHmsId()
await wyze.setHmsState(hmsId, 'away')
```

## Vacuum helpers (Wyze Robot Vacuum)

The vacuum lives on a separate Wyze service that requires signed requests; the
library handles the signing for you.

- wyze.getVacuumStatus(device)
- wyze.startVacuum(device)    // begin / resume a sweep
- wyze.pauseVacuum(device)
- wyze.dockVacuum(device)     // return to charging dock
- wyze.controlVacuum(device, type, value, rooms)  // low-level

```
const vac = await wyze.getDeviceByName('Home Vacuum')
await wyze.startVacuum(vac)
// …later…
await wyze.dockVacuum(vac)
```

## Lock helpers (Wyze Lock)

The lock uses the separate "ford" service (its own signing scheme, handled for
you). `getLockInfo` is read-only and returns lock state, battery, door state, etc.

- wyze.getLockInfo(device)
- wyze.lockDoor(device)
- wyze.unlockDoor(device)
- wyze.controlLock(device, action)  // low-level ('remoteLock' / 'remoteUnlock')

```
const lock = await wyze.getDeviceByName('Front Door Lock')
const info = await wyze.getLockInfo(lock)   // info.device.locker_status, power, etc.
await wyze.lockDoor(lock)
```

## Internal methods

- wyze.login()
- wyze.getRefreshToken()
- wyze.getObjectList()
- wyze.runAction(instanceId, providerKey, actionKey)
- wyze.runActionList(instanceId, providerKey, actionKey, plist)
- wyze.runActionListBatch(actions)  // apply across multiple devices in one call
- wyze.exServiceCall(svc, path, opts)  // signed request to a Wyze "Ex" service
- wyze.fordServiceCall(path, opts)  // signed request to the Wyze "ford" (lock) service
- wyze.getDeviceInfo(deviceMac, deviceModel)
- wyze.getPropertyList(deviceMac, deviceModel)
- wyze.setProperty(deviceMac, deviceModel, propertyId, propertyValue)


