# wyze-node
This is an un-official Wyze API. Thanks to [nblavoie](https://github.com/nblavoie/wyzecam-api) for his previous work analyzing the Wyze app. This library wraps the API calls that the mobile Wyze app uses. Please note this is a work in process.

***Important***: 
Unfortunately, I have not being successful making requests using a bogus phoneId. So you need to install [Charles](https://www.charlesproxy.com/) or [Wireshark](https://www.wireshark.org/) to sniff your Wyze mobile app traffic and retrieve your phoneId.
Scroll down to see instructions using Charles.

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

## Getting phoneId with Charles
### Credit to https://github.com/McMainsLiam

These are steps I took to find the phoneId using Charles proxy and my iPhone. Charles proxy has a 30 day evaluation period so there's no upfront cost.

1. Install Charles proxy. It asked me for my password to autoconfigure the proxy, I hit allow and entered my password. Once the setup had been complete, I could start seeing my network traffic appearing from my computer.
2. Set up HTTP proxy on your iPhone. Following [this guide](https://www.charlesproxy.com/documentation/faqs/using-charles-from-an-iphone/) I was able to set up the proxy from my phone through Charles on my computer. Once this setup had been complete, I could see the requests that were being made on my phone appear on my computer as well.
3. Allow SSL proxying. Click on the Proxy button in the menu bar, click on SSL Proxying Settings, click Enable SSL Proxying, and then click "add" under the include section of SSL Proxying. Then enter `*` for host and `*` for port. This will allow all SSL connections to be proxied through Charles. It probably isn't the best setup in the long run but it got the job done for me.
4. Completely close out of the Wyze app on your phone. Clear the log on Charles and then begin a new recording session. Start up the Wyze app on your phone and you should see quite a few connections come through Charles. There should be a request to `https://wyze-platform-service.wyzecam.com` on the left hand side. Drill down into that request until you come across the `set_phone_status` endpoint. Open up the `Contents` tab on this endpoint and you should see something like this
```javascript
{
	"status": true,
	"phone_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```
Use the value from phone_id.
