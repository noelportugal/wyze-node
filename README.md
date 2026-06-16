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



## Internal methods

- wyze.login()
- wyze.getRefreshToken()
- wyze.getObjectList()
- wyze.runAction(instanceId, providerKey, actionKey)
- wyze.getDeviceInfo(deviceMac, deviceModel)
- wyze.getPropertyList(deviceMac, deviceModel)
- wyze.setProperty(deviceMac, deviceModel, propertyId, propertyValue)


