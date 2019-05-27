# wyze-node
This is an un-official Wyze API. Thanks to [nblavoie](https://github.com/nblavoie/wyzecam-api) for his previous work analyzing the Wyze app. This library wraps the API calls that the mobile Wyze app uses. Please note this is a work in process.

***Important***: 
Unfortunately, I have not being successful making requests using a bogus phoneId. So you need to install [Charles](https://www.charlesproxy.com/) or [Wireshark](https://www.wireshark.org/) to sniff your Wyze mobile app traffic and retrieve your phoneId.

## Setup
`npm install wyze-node --save`

## Example
```
const Wyze = require('wyze-node')

const options = {
    username: '[email]',
    password: '[password]',
    phoneId: '[uniqueid]',
  }

const wyze = new Wyze(options)

const getObjectList = async () => {
    
    // Get tokens from storage 
    let accessToken = 'XXXXXX'
    let refreshToken = 'XXXXXX'
    await wyze.setTokens(accessToken, refreshToken)
    
    // Get list of objects
    const result = await wyze.getObjectList()
    
    //Save tokens to storage if they are different
    if (accessToken != result.accessToken || refreshToken != result.refreshToken){
        console.log('access_token', result.accessToken) 
        console.log('refresh_token', result.refreshToken)
    }
   
    if (Object.keys(result.data).length) {
        result.data['device_list'].forEach((device) => {
            //console.log('device', device)
            let state = device['device_params']['open_close_state'] !== undefined ? (device['device_params']['open_close_state'] === 1 ? '[open]' : '[closed]') : ''
            console.log(`${device['product_type']} - ${device.nickname} ${state}`)
        })
    }

}

getObjectList()
```