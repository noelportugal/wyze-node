const Wyze = require('../index.js')

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