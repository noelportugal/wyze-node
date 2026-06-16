'use strict'
const axios = require('axios')
const md5 = require('md5')
const moment = require('moment')
const LocalStorage = require('node-localstorage').LocalStorage
const localStorage = new LocalStorage('./scratch')

// Property IDs used by the bulb/light convenience helpers.
const BULB_PROPERTY_IDS = {
  brightness: 'P1501',   // 0-100
  colorTemp: 'P1502',    // color temperature in Kelvin (~1800-6500)
  color: 'P1507',        // 'RRGGBB' hex (mesh / color bulbs only)
  controlLight: 'P1508', // light strips: 1 = color, 2 = temperature
  sunMatch: 'P1528',     // 0/1 — mimic natural sunlight
}

class Wyze {
  /**
   * @param {object} options
   * @constructor
   */
  constructor(options) {
    this.username = options.username
    this.password = options.password
    // Wyze developer API credentials (required since 2023). Generate at
    // https://developer-api-console.wyze.com/#/apikey/view
    this.keyId = options.keyId || process.env.keyId || process.env.WYZE_KEY_ID
    this.apiKey = options.apiKey || process.env.apiKey || process.env.WYZE_API_KEY
    this.xApiKey = options.xApiKey || 'RckMFKbsds5p6QY3COEXc2ABwNTYY0q18ziEiSEm'
    this.userAgent = options.userAgent || 'wyze_ios_2.21.35'
    this.phoneId = options.phoneId || 'bc151f39-787b-4871-be27-5a20fd0a1937'
    this.authUrl = options.authUrl || 'https://auth-prod.api.wyze.com'
    this.baseUrl = options.baseUrl || 'https://api.wyzecam.com'
    this.baseV1Url = options.baseV1Url || 'https://beta-ams-api.wyzecam.com'
    this.appVer = options.appVer || 'com.hualai.WyzeCam___2.3.69'
    this.sc = '9f275790cab94a72bd206c8876429f3c'
    this.sv = '9d74946e652647e9b6c9d59326aef104',
    this.scV1 = 'a9ecb0f8ea7b4da2b6ab56542403d769'
    this.svV1 = '668988518a6a47fc9c0ef75b0164cfd6'
    this.accessToken = options.accessToken || ''
    this.refreshToken = options.refreshToken || ''
  }

  /**
  * get request data
  */
  async getRequestBodyData(data = {}) {
    return {
      access_token: this.accessToken,
      phone_id: this.phoneId,
      app_ver: this.appVer,
      sc: this.sc,
      sv: this.sv,
      ts: moment().valueOf(),
      ...data,
    }
  }

  /**
  * get tokens
  */
  async getTokens() {
    this.accessToken = localStorage.getItem('access_token')
    this.refreshToken = localStorage.getItem('refresh_token')
  }

  /**
  * set tokens
  */
  async setTokens(accessToken, refreshToken) {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    this.accessToken = accessToken
    this.refreshToken = refreshToken
  }

  /**
   * login to get access_token
   * @returns {data}
   */
  async login() {
    if (!this.keyId || !this.apiKey) {
      throw new Error(
        'Wyze requires a developer API key to log in. Set keyId and apiKey ' +
        '(options, or WYZE_KEY_ID / WYZE_API_KEY env vars). Generate one at ' +
        'https://developer-api-console.wyze.com/#/apikey/view'
      )
    }
    let result
    try {
      // Login body: time-based nonce + triple-md5 password (no access_token here)
      const data = {
        nonce: String(moment().valueOf()),
        email: this.username,
        password: md5(md5(md5((this.password)))),
      }

      const options = {
        headers: {
          'x-api-key': this.xApiKey,
          'apikey': this.apiKey,
          'keyid': this.keyId,
          'user-agent': this.userAgent,
          'phone-id': this.phoneId,
          'content-type': 'application/json',
        },
      }

      result = await axios.post(`${this.authUrl}/api/user/login`, data, options)

      if (!result.data || !result.data.access_token) {
        if (result.data && (result.data.mfa_options || result.data.mfa_details || result.data.sms_session_id)) {
          throw new Error(
            'Wyze login requires 2FA that the API key did not satisfy. Generate a ' +
            'fresh developer API key (it acts as the second factor) at ' +
            'https://developer-api-console.wyze.com/#/apikey/view'
          )
        }
        throw new Error('Wyze login failed: ' + JSON.stringify(result.data))
      }

      this.setTokens(result.data['access_token'], result.data['refresh_token'])
    }
    catch (e) {
      throw e
    }
    return result.data
  }

  /**
   * get refresh_token
   * @returns {data}
   */
  async getRefreshToken() {
    let result
    try {
      const data = {
        refresh_token: this.refreshToken,
      }
      result = await axios.post(`${this.baseUrl}/app/user/refresh_token`, await this.getRequestBodyData(data))
      this.setTokens(result.data.data['access_token'], result.data.data['refresh_token'])
    }
    catch (e) {
      throw e
    }
    return result.data
  }

  /**
   * get objects list
   * @returns {data}
   */
  async getObjectList() {
    let result
    try {
      await this.getTokens();
      if (!this.accessToken) {
        await this.login()
      }
      result = await axios.post(`${this.baseUrl}/app/v2/home_page/get_object_list`, await this.getRequestBodyData())
      if (result.data.msg === 'AccessTokenError') {
        await this.getRefreshToken()
        return this.getObjectList()
      }
    }
    catch (e) {
      throw e
    }
    return result.data
  }

  /**
   * get event list
   * @returns {data}
   */
  async getEventList(options) {
    let result
    try {
      await this.getTokens();
      if (!this.accessToken) {
        await this.login()
      }
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - 24);

      const data = {
        count: options?.count || 1000,
        event_type: "1",
        device_mac_list: options?.deviceMacList || [],
        event_value_list: [],
        event_tag_list: [],
        order_by: 2,
        end_time: options?.endTime || Date.now(),
        begin_time: options?.beginTime || startDate.getTime(),
      };
      result = await axios.post(`${this.baseUrl}/app/v2/device/get_event_list`, await this.getRequestBodyData(data))
      if (result.data.msg === 'AccessTokenError') {
        await this.getRefreshToken()
        return this.getObjectList()
      }
    }
    catch (e) {
      throw e
    }
    return result.data
  }

  /**
   * get objects list
   * @returns {data}
   */
  async getEventVideoURL(options) {
    let result
    try {
      await this.getTokens();
      if (!this.accessToken) {
        await this.login()
      }
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - 24);

      const data = {
        device_mac: options?.deviceMac,
        end_time: options?.endTime || Date.now(),
        begin_time: options?.beginTime || startDate.getTime(),
        expires: options?.expires || 4000,
        max_manifest_fragment: 1000,
        device_model: options?.deviceModel,
        sc: this.scV1,
        sv: this.svV1,
      };
      result = await axios.post(`${this.baseV1Url}/api/v1/kinesis/replay_url/get`, await this.getRequestBodyData(data))
      if (result.data.msg === 'AccessTokenError') {
        await this.getRefreshToken()
        return this.getObjectList()
      }
    }
    catch (e) {
      throw e
    }
    return result.data
  }

  /**
   * run action
   * @returns {data}
   */
  async runAction(instanceId, providerKey, actionKey) {
    let result
    try {
      await this.getTokens();
      if (!this.accessToken) {
        await this.login()
      }

      const data = {
        provider_key: providerKey,
        instance_id: instanceId,
        action_key: actionKey,
        action_params: {},
        custom_string: '',
      }

      result = await axios.post(`${this.baseUrl}/app/v2/auto/run_action`, await this.getRequestBodyData(data))

      if (result.data.msg === 'AccessTokenError') {
        await this.getRefreshToken()
        return this.runAction(instanceId, actionKey)
      }
    }
    catch (e) {
      throw e
    }
    return result.data
  }

  /**
  * get device info
  * @returns {data.data}
  */
  async getDeviceInfo(deviceMac, deviceModel) {
    let result
    try {
      await this.getTokens();
      if (!this.accessToken) {
        await this.login()
      }
      const data = {
        device_mac: deviceMac,
        device_model: deviceModel,
      }
      result = await axios.post(`${this.baseUrl}/app/v2/device/get_device_info`, await this.getRequestBodyData(data))
    } catch (e) {
      throw e
    }
    return result.data.data
  }

  /**
  * get property
  * @returns {data.property_list}
  */
  async getPropertyList(deviceMac, deviceModel) {
    let result
    try {
      await this.getTokens();
      if (!this.accessToken) {
        await this.login()
      }
      const data = {
        device_mac: deviceMac,
        device_model: deviceModel,
      }
      result = await axios.post(`${this.baseUrl}/app/v2/device/get_property_list`, await this.getRequestBodyData(data))
    } catch (e) {
      throw e
    }
    return result.data.data.property_list
  }

  /**
  * set property
  * @returns {data}
  */
  async setProperty(deviceMac, deviceModel, propertyId, propertyValue) {
    let result
    try {
      await this.getTokens();
      if (!this.accessToken) {
        await this.login()
      }
      const data = {
        device_mac: deviceMac,
        device_model: deviceModel,
        pid: propertyId,
        pvalue: propertyValue,
      }
      result = await axios.post(`${this.baseUrl}/app/v2/device/set_property`, await this.getRequestBodyData(data))

    } catch (e) {
      throw e
    }
    return result.data
  }

  /**
  * run an action list against a single device. Used by mesh bulbs / light
  * strips, which apply properties via `set_mesh_property` instead of the plain
  * set_property endpoint.
  * @param {string} instanceId device mac
  * @param {string} providerKey device model
  * @param {string} actionKey e.g. 'set_mesh_property'
  * @param {Array<{pid:string,pvalue:(string|number)}>} plist properties to set
  * @returns {data}
  */
  async runActionList(instanceId, providerKey, actionKey, plist = []) {
    let result
    try {
      await this.getTokens();
      if (!this.accessToken) {
        await this.login()
      }
      const data = {
        action_list: [
          {
            action_key: actionKey,
            action_params: {
              list: [
                {
                  mac: instanceId,
                  plist: plist.map(p => ({ pid: p.pid, pvalue: String(p.pvalue) })),
                },
              ],
            },
            instance_id: instanceId,
            provider_key: providerKey,
          },
        ],
      }
      result = await axios.post(`${this.baseUrl}/app/v2/auto/run_action_list`, await this.getRequestBodyData(data))
      if (result.data.msg === 'AccessTokenError') {
        await this.getRefreshToken()
        return this.runActionList(instanceId, providerKey, actionKey, plist)
      }
    }
    catch (e) {
      throw e
    }
    return result.data
  }

  /**
  * Helper functions
  */

  /**
  * getDeviceList
  */
  async getDeviceList() {
    const result = await this.getObjectList()
    return result.data.device_list
  }

  /**
  * getDeviceByName
  */
  async getDeviceByName(nickname) {
    const result = await this.getDeviceList()
    const device = result.find(device => device.nickname.toLowerCase() === nickname.toLowerCase())
    return device
  }

  /**
  * getDeviceByMac
  */
  async getDeviceByMac(mac) {
    const result = await this.getDeviceList()
    const device = result.find(device => device.mac === mac)
    return device
  }

  /**
  * getDevicesByType
  */
  async getDevicesByType(type) {
    const result = await this.getDeviceList()
    const devices = result.filter(device => device.product_type.toLowerCase() === type.toLowerCase())
    return devices
  }

  /**
  * getDevicesByModel
  */
  async getDevicesByModel(model) {
    const result = await this.getDeviceList()
    const devices = result.filter(device => device.product_model.toLowerCase() === model.toLowerCase())
    return devices
  }

  /**
  * getDeviceGroupsList
  */
  async getDeviceGroupsList() {
    const result = await this.getObjectList()
    return result.data.device_group_list
  }

  /**
  * getDeviceSortList
  */
  async getDeviceSortList() {
    const result = await this.getObjectList()
    return result.data.device_sort_list
  }


  /**
  * turnOn
  */
  async turnOn(device) {
    return await this.runAction(device.mac, device.product_model, 'power_on')
  }

  /**
  * turnOff
  */
  async turnOff(device) {
    return await this.runAction(device.mac, device.product_model, 'power_off')
  }

  /**
  * getDeviceStatus
  */
  async getDeviceStatus(device) {
    return device.device_params
  }

  /**
  * getDeviceState
  */
  async getDeviceState(device) {
    let state = device.device_params.power_switch !== undefined ? (device.device_params.power_switch === 1 ? 'on' : 'off') : ''
    if (!state) {
      state = device.device_params.open_close_state !== undefined ? (device.device_params.open_close_state === 1 ? 'open' : 'closed') : ''
    }
    return state
  }

  /**
  * Bulb / light helpers
  *
  * Each accepts a device object (from getDeviceByName / getDeviceByMac) and
  * picks the right transport automatically: mesh bulbs and light strips apply
  * properties via run_action_list (set_mesh_property); regular bulbs use
  * set_property.
  */

  isMeshBulb(device) {
    const type = (device.product_type || '').toLowerCase()
    return type === 'meshlight' || type === 'lightstrip'
  }

  isLightStrip(device) {
    return (device.product_type || '').toLowerCase() === 'lightstrip'
  }

  async setBulbProperties(device, plist) {
    if (this.isMeshBulb(device)) {
      return await this.runActionList(device.mac, device.product_model, 'set_mesh_property', plist)
    }
    let result
    for (const p of plist) {
      result = await this.setProperty(device.mac, device.product_model, p.pid, String(p.pvalue))
    }
    return result
  }

  /**
  * setBrightness — brightness 0..100
  */
  async setBrightness(device, brightness) {
    const value = Math.max(0, Math.min(100, Math.round(Number(brightness))))
    return await this.setBulbProperties(device, [{ pid: BULB_PROPERTY_IDS.brightness, pvalue: value }])
  }

  /**
  * setColorTemp — color temperature in Kelvin (~1800..6500)
  */
  async setColorTemp(device, kelvin) {
    const value = Math.max(1800, Math.min(6500, Math.round(Number(kelvin))))
    const plist = [{ pid: BULB_PROPERTY_IDS.colorTemp, pvalue: value }]
    if (this.isLightStrip(device)) {
      plist.push({ pid: BULB_PROPERTY_IDS.controlLight, pvalue: 2 }) // temperature mode
    }
    return await this.setBulbProperties(device, plist)
  }

  /**
  * setColor — hex 'RRGGBB' (mesh / color bulbs and light strips only)
  */
  async setColor(device, hex) {
    if (!this.isMeshBulb(device)) {
      throw new Error('setColor is only supported on color/mesh bulbs and light strips')
    }
    const value = String(hex).replace(/^#/, '').toUpperCase()
    if (!/^[0-9A-F]{6}$/.test(value)) {
      throw new Error(`Invalid color '${hex}': expected 6-digit hex like 'FF0000'`)
    }
    const plist = [{ pid: BULB_PROPERTY_IDS.color, pvalue: value }]
    if (this.isLightStrip(device)) {
      plist.push({ pid: BULB_PROPERTY_IDS.controlLight, pvalue: 1 }) // color mode
    }
    return await this.setBulbProperties(device, plist)
  }

  /**
  * setSunMatch — mimic natural sunlight (on/off)
  */
  async setSunMatch(device, on = true) {
    return await this.setBulbProperties(device, [{ pid: BULB_PROPERTY_IDS.sunMatch, pvalue: on ? 1 : 0 }])
  }

}

module.exports = Wyze
