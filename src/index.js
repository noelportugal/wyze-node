'use strict'
const axios = require('axios')
const md5 = require('md5')
const moment = require('moment')
const LocalStorage = require('node-localstorage').LocalStorage
const localStorage = new LocalStorage('./scratch')

const {
  EX_SERVICES, VACUUM_CONTROL_TYPE, VACUUM_CONTROL_VALUE, SIRIUS, DEFAULT_IOT_KEYS,
  HMS, WEB, CAMERA_PROPERTY_IDS, FORD, SCALE, BULB_PROPERTY_IDS, BULB_MODELS,
} = require('./constants')
const { md5hex: _md5hex, hmacMd5: _hmacMd5, quotePlus: _quotePlus, sortedParams: _sortedParams } = require('./crypto')

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
   * Detect an expired/invalid access token in an API response so callers can
   * refresh and retry. Wyze is inconsistent: older endpoints return
   * `msg: 'AccessTokenError'`, newer ones return `code`/`ErrNo` `2001` with a
   * message like `'access token is error'`. Match all of them.
   * @param {object} data axios `response.data`
   * @returns {boolean}
   */
  isTokenError(data) {
    if (!data) return false
    return data.msg === 'AccessTokenError' ||
      String(data.code) === '2001' ||
      String(data.ErrNo) === '2001'
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
      if (this.isTokenError(result.data)) {
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
      if (this.isTokenError(result.data)) {
        await this.getRefreshToken()
        return this.getEventList(options)
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
      if (this.isTokenError(result.data)) {
        await this.getRefreshToken()
        return this.getEventVideoURL(options)
      }
    }
    catch (e) {
      throw e
    }
    return result.data
  }

  /**
  * markEventsRead — mark notification events read (or unread). Pass event
  * objects from getEventList(); they're grouped by device automatically.
  * @param {Array<{device_mac:string,event_id:string}>} events
  * @param {{read?:boolean}} [opts]
  * @returns {data}
  */
  async markEventsRead(events, { read = true } = {}) {
    await this.getTokens();
    if (!this.accessToken) {
      await this.login()
    }
    const byMac = {}
    for (const e of (events || [])) {
      const mac = e.device_mac || e.deviceMac
      const id = e.event_id || e.eventId || e.id
      if (!mac || !id) continue
      ;(byMac[mac] = byMac[mac] || []).push(id)
    }
    const data = {
      event_list: Object.keys(byMac).map(mac => ({ device_mac: mac, event_id_list: byMac[mac], event_type: 1 })),
      read_state: read ? 1 : 0,
    }
    let result = await axios.post(`${this.baseUrl}/app/v2/device_event/set_read_state_list`, await this.getRequestBodyData(data))
    if (this.isTokenError(result.data)) {
      await this.getRefreshToken()
      return this.markEventsRead(events, { read })
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

      if (this.isTokenError(result.data)) {
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
    return await this.runActionListBatch([
      { mac: instanceId, model: providerKey, actionKey, plist },
    ])
  }

  /**
  * run an action list across one or more devices in a single request. This is
  * how the app applies a property to a whole group of mesh bulbs at once.
  * @param {Array<{mac:string,model:string,actionKey:string,plist:Array<{pid:string,pvalue:(string|number)}>}>} actions
  * @returns {data}
  */
  async runActionListBatch(actions = []) {
    let result
    try {
      await this.getTokens();
      if (!this.accessToken) {
        await this.login()
      }
      const data = {
        action_list: actions.map(a => ({
          action_key: a.actionKey,
          action_params: {
            list: [
              {
                mac: a.mac,
                plist: (a.plist || []).map(p => ({ pid: p.pid, pvalue: String(p.pvalue) })),
              },
            ],
          },
          instance_id: a.mac,
          provider_key: a.model,
        })),
      }
      result = await axios.post(`${this.baseUrl}/app/v2/auto/run_action_list`, await this.getRequestBodyData(data))
      if (this.isTokenError(result.data)) {
        await this.getRefreshToken()
        return this.runActionListBatch(actions)
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

  // device objects use `mac`; group members use `device_mac`.
  deviceMac(device) {
    return device.mac || device.device_mac
  }

  isMeshBulb(device) {
    const model = (device.product_model || '').toUpperCase()
    if (BULB_MODELS.mesh.includes(model)) return true
    const type = (device.product_type || '').toLowerCase()
    return type === 'meshlight' || type === 'lightstrip'
  }

  isLightStrip(device) {
    const model = (device.product_model || '').toUpperCase()
    if (BULB_MODELS.lightStrip.includes(model)) return true
    return (device.product_type || '').toLowerCase() === 'lightstrip'
  }

  async setBulbProperties(device, plist) {
    const mac = this.deviceMac(device)
    if (this.isMeshBulb(device)) {
      return await this.runActionList(mac, device.product_model, 'set_mesh_property', plist)
    }
    let result
    for (const p of plist) {
      result = await this.setProperty(mac, device.product_model, p.pid, String(p.pvalue))
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

  /**
  * Group helpers
  *
  * Wyze has no native group-action endpoint, so these fan out to the group's
  * member devices. Mesh bulbs are applied in a single batched run_action_list
  * call; any non-mesh members fall back to per-device set_property.
  */

  /**
  * getDeviceGroupByName
  */
  async getDeviceGroupByName(name) {
    const groups = await this.getDeviceGroupsList()
    return (groups || []).find(g => (g.group_name || '').toLowerCase() === String(name).toLowerCase())
  }

  async setGroupProperties(group, plist) {
    const members = (group && group.device_list) || []
    const results = []
    const mesh = members.filter(m => this.isMeshBulb(m))
    const regular = members.filter(m => !this.isMeshBulb(m))
    if (mesh.length) {
      results.push(await this.runActionListBatch(mesh.map(m => ({
        mac: this.deviceMac(m),
        model: m.product_model,
        actionKey: 'set_mesh_property',
        plist,
      }))))
    }
    for (const m of regular) {
      for (const p of plist) {
        results.push(await this.setProperty(this.deviceMac(m), m.product_model, p.pid, String(p.pvalue)))
      }
    }
    return results
  }

  async _groupRunAction(group, actionKey) {
    const members = (group && group.device_list) || []
    const results = []
    for (const m of members) {
      results.push(await this.runAction(this.deviceMac(m), m.product_model, actionKey))
    }
    return results
  }

  /**
  * turnOnGroup / turnOffGroup
  */
  async turnOnGroup(group) {
    return await this._groupRunAction(group, 'power_on')
  }

  async turnOffGroup(group) {
    return await this._groupRunAction(group, 'power_off')
  }

  /**
  * setGroupBrightness — brightness 0..100 for every bulb in the group
  */
  async setGroupBrightness(group, brightness) {
    const value = Math.max(0, Math.min(100, Math.round(Number(brightness))))
    return await this.setGroupProperties(group, [{ pid: BULB_PROPERTY_IDS.brightness, pvalue: value }])
  }

  /**
  * setGroupColorTemp — color temperature in Kelvin for every bulb in the group
  */
  async setGroupColorTemp(group, kelvin) {
    const value = Math.max(1800, Math.min(6500, Math.round(Number(kelvin))))
    return await this.setGroupProperties(group, [{ pid: BULB_PROPERTY_IDS.colorTemp, pvalue: value }])
  }

  /**
  * setGroupColor — hex 'RRGGBB' for every (color/mesh) bulb in the group
  */
  async setGroupColor(group, hex) {
    const value = String(hex).replace(/^#/, '').toUpperCase()
    if (!/^[0-9A-F]{6}$/.test(value)) {
      throw new Error(`Invalid color '${hex}': expected 6-digit hex like 'FF0000'`)
    }
    return await this.setGroupProperties(group, [{ pid: BULB_PROPERTY_IDS.color, pvalue: value }])
  }

  /**
  * getCameraThumbnail — returns the latest thumbnail URL for a camera, or null.
  * Note: Wyze only populates this for some models (e.g. V2) and it is not
  * real-time — it can lag behind by minutes/hours.
  */
  async getCameraThumbnail(device) {
    const fresh = await this.getDeviceByMac(this.deviceMac(device))
    const thumbs = fresh && fresh.device_params && fresh.device_params.camera_thumbnails
    return (thumbs && thumbs.thumbnails_url) || null
  }

  /**
  * Signed request to a newer Wyze "Ex" service (vacuum, lock, …). These hosts
  * require an HMAC-MD5 `signature2` over the request body (POST) or sorted
  * params (GET), keyed on md5(access_token + service salt).
  * @param {object} svc one of EX_SERVICES (baseUrl, appId, salt, appVersion)
  * @param {string} path e.g. '/plugin/venus/<did>/control'
  * @param {object} opts { method='POST', params, json }
  * @returns {data}
  */
  async exServiceCall(svc, path, { method = 'POST', params = null, json = null } = {}) {
    await this.getTokens();
    if (!this.accessToken) {
      await this.login()
    }

    const send = async () => {
      const nonce = moment().valueOf()
      const secret = _md5hex(`${this.accessToken}${svc.salt}`)
      const headers = {
        'appid': svc.appId,
        'appinfo': `wyze_android_${svc.appVersion}`,
        'phoneid': this.phoneId,
        'User-Agent': `wyze_android_${svc.appVersion}`,
        'access_token': this.accessToken,
        'requestid': _md5hex(_md5hex(String(nonce))),
        'Accept-Encoding': 'gzip',
      }
      let data
      let axiosParams
      if (method === 'GET') {
        const p = { ...(params || {}), nonce }
        const signStr = Object.keys(p).sort().map(k => `${k}=${p[k]}`).join('&')
        headers['signature2'] = _hmacMd5(secret, signStr)
        axiosParams = p
      } else {
        // build the exact JSON we sign and send (compact, so they match)
        data = JSON.stringify({ ...(json || {}), nonce: String(nonce) })
        headers['signature2'] = _hmacMd5(secret, data)
        headers['Content-Type'] = 'application/json;charset=utf-8'
      }
      return await axios({ method, url: `${svc.baseUrl}${path}`, headers, data, params: axiosParams })
    }

    let result = await send()
    if (this.isTokenError(result.data)) {
      await this.getRefreshToken()
      result = await send()
    }
    return result.data
  }

  /**
  * Vacuum helpers (Wyze Robot Vacuum). `device` is the vacuum device object;
  * its mac is used as the venus device id (did).
  */

  vacuumDid(device) {
    return device.did || device.mac || device.device_mac
  }

  async getVacuumStatus(device) {
    const did = this.vacuumDid(device)
    return await this.exServiceCall(EX_SERVICES.venus, `/plugin/venus/${did}/status`, {
      method: 'GET', params: { did },
    })
  }

  async controlVacuum(device, type, value, rooms = null) {
    const did = this.vacuumDid(device)
    const json = { type, value, vacuumMopMode: 0 }
    if (rooms != null) json.rooms_id = Array.isArray(rooms) ? rooms : [rooms]
    return await this.exServiceCall(EX_SERVICES.venus, `/plugin/venus/${did}/control`, { json })
  }

  /**
  * startVacuum — begin/resume a full sweep
  */
  async startVacuum(device) {
    return await this.controlVacuum(device, VACUUM_CONTROL_TYPE.SWEEPING, VACUUM_CONTROL_VALUE.START)
  }

  /**
  * pauseVacuum — pause the current sweep
  */
  async pauseVacuum(device) {
    return await this.controlVacuum(device, VACUUM_CONTROL_TYPE.SWEEPING, VACUUM_CONTROL_VALUE.PAUSE)
  }

  /**
  * dockVacuum — send the vacuum back to its charging dock
  */
  async dockVacuum(device) {
    return await this.controlVacuum(device, VACUUM_CONTROL_TYPE.RECHARGE, VACUUM_CONTROL_VALUE.START)
  }

  /**
  * Signed request to the "ford" lock service. Signing differs from exServiceCall:
  * sign = md5(quote_plus(method + path + sortedParams + appSecret)), and the
  * access token / key / timestamp / sign travel in the params (GET) or body
  * (POST), not headers.
  * @param {string} path e.g. '/openapi/lock/v1/info'
  * @param {object} opts { method='GET', params, json }
  * @returns {data}
  */
  async fordServiceCall(path, { method = 'GET', params = null, json = null } = {}) {
    await this.getTokens();
    if (!this.accessToken) {
      await this.login()
    }

    const send = async () => {
      const nonce = moment().valueOf()
      const headers = {
        'appVer': `And-${FORD.appVersion}`,
        'language': 'en_US',
        'Keep-Alive': 'timeout=120',
        'User-Agent': 'okhttp/4.7.2',
        'Accept-Encoding': 'gzip',
      }
      if (method === 'GET') {
        const p = { ...(params || {}), access_token: this.accessToken, key: FORD.appKey, timestamp: String(nonce) }
        p.sign = _md5hex(_quotePlus(`get${path}${_sortedParams(p)}${FORD.appSecret}`))
        return await axios({ method: 'GET', url: `${FORD.baseUrl}${path}`, headers, params: p })
      }
      // POST uses camelCase accessToken (per the ford API)
      const body = { ...(json || {}), accessToken: this.accessToken, key: FORD.appKey, timestamp: String(nonce) }
      body.sign = _md5hex(_quotePlus(`${method.toLowerCase()}${path}${_sortedParams(body)}${FORD.appSecret}`))
      headers['Content-Type'] = 'application/json;charset=utf-8'
      return await axios({ method, url: `${FORD.baseUrl}${path}`, headers, data: JSON.stringify(body) })
    }

    let result = await send()
    if (this.isTokenError(result.data)) {
      await this.getRefreshToken()
      result = await send()
    }
    return result.data
  }

  /**
  * Lock helpers (Wyze Lock). The lock is addressed by `uuid`, which is the
  * device mac with its model prefix removed (e.g. 'YD_BT1.abc123' -> 'abc123').
  */

  lockUuid(device) {
    const mac = this.deviceMac(device) || ''
    return mac.includes('.') ? mac.slice(mac.indexOf('.') + 1) : mac
  }

  /**
  * getLockInfo — lock state, battery, door state, etc. (read-only)
  */
  async getLockInfo(device) {
    return await this.fordServiceCall('/openapi/lock/v1/info', {
      method: 'GET', params: { uuid: this.lockUuid(device), with_keypad: 1 },
    })
  }

  async controlLock(device, action) {
    return await this.fordServiceCall('/openapi/lock/v1/control', {
      method: 'POST', json: { uuid: this.lockUuid(device), action },
    })
  }

  /**
  * lockDoor / unlockDoor
  */
  async lockDoor(device) {
    return await this.controlLock(device, 'remoteLock')
  }

  async unlockDoor(device) {
    return await this.controlLock(device, 'remoteUnlock')
  }

  /**
  * IoT-prop transport ("olive" signing on the sirius service), used by wall
  * switches. signature2 = HMAC-MD5(md5(access_token + salt), body).
  */
  _oliveSignature(body) {
    return _hmacMd5(_md5hex(`${this.accessToken}${SIRIUS.salt}`), body)
  }

  _siriusHeaders(signature, hasJson) {
    const headers = {
      'Accept-Encoding': 'gzip',
      'User-Agent': this.userAgent,
      'appid': SIRIUS.appId,
      'appinfo': SIRIUS.appInfo,
      'phoneid': this.phoneId,
      'access_token': this.accessToken,
      'signature2': signature,
    }
    if (hasJson) headers['Content-Type'] = 'application/json'
    return headers
  }

  async getIotProp(device, keys = DEFAULT_IOT_KEYS) {
    await this.getTokens();
    if (!this.accessToken) {
      await this.login()
    }
    const keysStr = Array.isArray(keys) ? keys.join(',') : keys
    const send = async () => {
      const payload = { keys: keysStr, did: this.deviceMac(device), nonce: String(moment().valueOf()) }
      const body = Object.keys(payload).sort().map(k => `${k}=${payload[k]}`).join('&')
      const headers = this._siriusHeaders(this._oliveSignature(body), false)
      return await axios.get(`${SIRIUS.baseUrl}/plugin/sirius/get_iot_prop`, { headers, params: payload })
    }
    let result = await send()
    if (this.isTokenError(result.data)) {
      await this.getRefreshToken()
      result = await send()
    }
    return result.data
  }

  async setIotProp(device, propKey, value) {
    await this.getTokens();
    if (!this.accessToken) {
      await this.login()
    }
    const send = async () => {
      const payload = {
        did: this.deviceMac(device),
        model: device.product_model,
        props: { [propKey]: value },
        is_sub_device: 0,
        nonce: String(moment().valueOf()),
      }
      const body = JSON.stringify(payload)
      const headers = this._siriusHeaders(this._oliveSignature(body), true)
      return await axios.post(`${SIRIUS.baseUrl}/plugin/sirius/set_iot_prop_by_topic`, body, { headers })
    }
    let result = await send()
    if (this.isTokenError(result.data)) {
      await this.getRefreshToken()
      result = await send()
    }
    return result.data
  }

  /**
  * Wall switch (LD_SS1) controls. switch-power is the relay; switch-iot is the
  * "smart control" mode. Values ported from jfarmer08/wyze-api.
  */
  async wallSwitchPowerOn(device) { return await this.setIotProp(device, 'switch-power', true) }
  async wallSwitchPowerOff(device) { return await this.setIotProp(device, 'switch-power', false) }
  async wallSwitchIotOn(device) { return await this.setIotProp(device, 'switch-iot', true) }
  async wallSwitchIotOff(device) { return await this.setIotProp(device, 'switch-iot', false) }
  async wallSwitchLedOn(device) { return await this.setIotProp(device, 'led_state', true) }
  async wallSwitchLedOff(device) { return await this.setIotProp(device, 'led_state', false) }
  async wallSwitchVacationModeOn(device) { return await this.setIotProp(device, 'vacation_mode', 0) }
  async wallSwitchVacationModeOff(device) { return await this.setIotProp(device, 'vacation_mode', 1) }

  /**
  * Home Monitoring System (HMS) — arm/disarm via the Sense Hub. Uses olive
  * signing on the membership + hms hosts.
  */
  async getPlanBindingListByUser() {
    await this.getTokens();
    if (!this.accessToken) {
      await this.login()
    }
    const payload = { group_id: 'hms', nonce: String(moment().valueOf()) }
    const body = Object.keys(payload).sort().map(k => `${k}=${payload[k]}`).join('&')
    const headers = this._siriusHeaders(this._oliveSignature(body), false)
    const res = await axios.get(`${HMS.membershipUrl}/platform/v2/membership/get_plan_binding_list_by_user`, { headers, params: payload })
    return res.data
  }

  // Extracts the HMS id from the plan binding list.
  async getHmsId() {
    const data = await this.getPlanBindingListByUser()
    const bindings = (data && data.data && (data.data.binding_list || data.data.bindingList)) || []
    for (const b of bindings) {
      const devices = b.device_list || b.deviceList || []
      for (const d of devices) {
        const id = d.device_id || d.deviceId
        if (id) return id
      }
    }
    return null
  }

  async getHmsState(hmsId) {
    await this.getTokens();
    if (!this.accessToken) {
      await this.login()
    }
    const payload = { hms_id: hmsId, nonce: String(moment().valueOf()) }
    const body = Object.keys(payload).sort().map(k => `${k}=${payload[k]}`).join('&')
    const headers = this._siriusHeaders(this._oliveSignature(body), false)
    const res = await axios.get(`${HMS.apiUrl}/api/v1/monitoring/v1/profile/state-status`, { headers, params: payload })
    return res.data
  }

  async monitoringProfileActive(hmsId, home, away) {
    await this.getTokens();
    if (!this.accessToken) {
      await this.login()
    }
    const payload = { hms_id: hmsId } // signature covers hms_id only (no nonce)
    const body = Object.keys(payload).sort().map(k => `${k}=${payload[k]}`).join('&')
    const headers = this._siriusHeaders(this._oliveSignature(body), false)
    headers['Authorization'] = this.accessToken
    const data = [
      { state: 'home', active: home },
      { state: 'away', active: away },
    ]
    const res = await axios.patch(`${HMS.apiUrl}/api/v1/monitoring/v1/profile/active`, data, { headers, params: payload })
    return res.data
  }

  async disableRemeAlarm(hmsId) {
    await this.getTokens();
    if (!this.accessToken) {
      await this.login()
    }
    const res = await axios.delete(`${HMS.apiUrl}/api/v1/reme-alarm`, {
      headers: { Authorization: this.accessToken, 'User-Agent': this.userAgent },
      data: { hms_id: hmsId, remediation_id: 'emergency' },
    })
    return res.data
  }

  /**
  * setHmsState — 'home', 'away', or 'off'/'disarm'
  */
  async setHmsState(hmsId, mode) {
    if (mode === 'off' || mode === 'disarm') {
      await this.disableRemeAlarm(hmsId)
      return await this.monitoringProfileActive(hmsId, 0, 0)
    } else if (mode === 'away') {
      return await this.monitoringProfileActive(hmsId, 0, 1)
    } else if (mode === 'home') {
      return await this.monitoringProfileActive(hmsId, 1, 0)
    }
    throw new Error(`Unknown HMS mode '${mode}' (use 'home', 'away', or 'off')`)
  }

  /**
  * Generic olive-signed GET to an arbitrary Wyze service host (used by the
  * scale). Signs sorted params with the olive scheme and refreshes on token error.
  */
  async _oliveGet(baseUrl, path, params = {}) {
    await this.getTokens();
    if (!this.accessToken) {
      await this.login()
    }
    const send = async () => {
      const p = { ...params, nonce: String(moment().valueOf()) }
      const body = Object.keys(p).sort().map(k => `${k}=${p[k]}`).join('&')
      const headers = this._siriusHeaders(this._oliveSignature(body), false)
      return await axios.get(`${baseUrl}${path}`, { headers, params: p })
    }
    let result = await send()
    if (this.isTokenError(result.data)) {
      await this.getRefreshToken()
      result = await send()
    }
    return result.data
  }

  /**
  * Scale helpers (Wyze Scale). `device` is the scale device object; its mac is
  * the scale device id. Records include weight + body composition (BMI, body
  * fat %, water %, BMR, etc.).
  */
  async getScaleLatestRecord(device, { userId } = {}) {
    const params = { did: this.deviceMac(device) }
    if (userId) params.family_member_id = userId
    return await this._oliveGet(SCALE.baseUrl, '/plugin/scale/get_latest_record', params)
  }

  async getScaleRecords(device, { userId, startTime = 0, endTime = Date.now() } = {}) {
    // record_range uses MILLISECOND timestamps; start_time 0 = full history.
    // Resolve the family member from the latest record if not supplied, so
    // history comes back without the caller having to look up an id first.
    if (!userId) {
      const latest = await this.getScaleLatestRecord(device)
      const r = Array.isArray(latest.data) ? latest.data[0] : latest.data
      userId = r && (r.family_member_id || r.user_id)
    }
    const params = {
      did: this.deviceMac(device),
      start_time: String(Math.floor(startTime)),
      end_time: String(Math.floor(endTime)),
    }
    if (userId) params.family_member_id = userId
    return await this._oliveGet(SCALE.baseUrl, '/plugin/scale/get_record_range', params)
  }

  async getScaleFamilyMembers(device) {
    return await this._oliveGet(SCALE.baseUrl, '/plugin/scale/get_family_member', { did: this.deviceMac(device) })
  }

  /**
  * Camera controls (ported from jfarmer08/wyze-api). Each takes a camera device
  * object.
  */
  async cameraTurnOn(device) {
    return await this.runAction(this.deviceMac(device), device.product_model, 'power_on')
  }
  async cameraTurnOff(device) {
    return await this.runAction(this.deviceMac(device), device.product_model, 'power_off')
  }
  async cameraSirenOn(device) {
    return await this.runAction(this.deviceMac(device), device.product_model, 'siren_on')
  }
  async cameraSirenOff(device) {
    return await this.runAction(this.deviceMac(device), device.product_model, 'siren_off')
  }
  async cameraMotionOn(device) {
    return await this.setProperty(this.deviceMac(device), device.product_model, CAMERA_PROPERTY_IDS.motion, 1)
  }
  async cameraMotionOff(device) {
    return await this.setProperty(this.deviceMac(device), device.product_model, CAMERA_PROPERTY_IDS.motion, 0)
  }
  async cameraNotificationsOn(device) {
    return await this.setProperty(this.deviceMac(device), device.product_model, CAMERA_PROPERTY_IDS.notifications, '1')
  }
  async cameraNotificationsOff(device) {
    return await this.setProperty(this.deviceMac(device), device.product_model, CAMERA_PROPERTY_IDS.notifications, '0')
  }
  async cameraMotionRecordingOn(device) {
    return await this.setProperty(this.deviceMac(device), device.product_model, CAMERA_PROPERTY_IDS.motionRecording, '1')
  }
  async cameraMotionRecordingOff(device) {
    return await this.setProperty(this.deviceMac(device), device.product_model, CAMERA_PROPERTY_IDS.motionRecording, '0')
  }
  async cameraSoundNotificationOn(device) {
    return await this.setProperty(this.deviceMac(device), device.product_model, CAMERA_PROPERTY_IDS.soundNotification, '1')
  }
  async cameraSoundNotificationOff(device) {
    return await this.setProperty(this.deviceMac(device), device.product_model, CAMERA_PROPERTY_IDS.soundNotification, '0')
  }
  // Floodlight and spotlight share property P1056 (1 = on, 2 = off).
  async cameraFloodLightOn(device) {
    return await this.setProperty(this.deviceMac(device), device.product_model, CAMERA_PROPERTY_IDS.light, '1')
  }
  async cameraFloodLightOff(device) {
    return await this.setProperty(this.deviceMac(device), device.product_model, CAMERA_PROPERTY_IDS.light, '2')
  }
  async cameraSpotLightOn(device) {
    return await this.cameraFloodLightOn(device)
  }
  async cameraSpotLightOff(device) {
    return await this.cameraFloodLightOff(device)
  }

  /**
  * garageDoor — triggers the garage-door controller attached to a Wyze camera.
  */
  async garageDoor(device) {
    return await this.runAction(this.deviceMac(device), device.product_model, 'garage_door_trigger')
  }

  /**
  * getCameraStreamInfo — WebRTC connection info for a camera (signaling URL +
  * ICE servers). This is the descriptor a WebRTC client needs to open a live
  * stream; it does not itself stream. Uses the "web" signing scheme.
  */
  async getCameraStreamInfo(device, { substream = false } = {}) {
    await this.getTokens();
    if (!this.accessToken) {
      await this.login()
    }
    const parameters = { use_trickle: true }
    if (substream) parameters.sub_stream = true
    const payload = {
      device_list: [
        {
          device_id: this.deviceMac(device),
          device_model: device.product_model,
          provider: 'webrtc',
          parameters,
        },
      ],
      nonce: String(moment().valueOf()),
    }
    const body = JSON.stringify(payload)
    const signature = _hmacMd5(_md5hex(`${this.accessToken}${WEB.salt}`), body)
    const headers = {
      'Accept-Encoding': 'gzip',
      'Content-Type': 'application/json',
      'User-Agent': this.userAgent,
      appId: WEB.appId,
      appInfo: WEB.appInfo,
      phoneid: this.phoneId,
      access_token: this.accessToken,
      Authorization: this.accessToken,
      signature2: signature,
    }
    const res = await axios.post(`${WEB.baseUrl}/app/v4/camera/get-streams`, body, { headers })
    return res.data
  }

  /**
  * getCameraSignalingInfo — convenience: just the signaling URL + ICE servers.
  */
  async getCameraSignalingInfo(device, options = {}) {
    const data = await this.getCameraStreamInfo(device, options)
    const list = data && data.data
    const info = (Array.isArray(list) ? list[0] : list) || {}
    const params = info.params || info
    return {
      signalingUrl: params.signaling_url || null,
      iceServers: params.ice_servers || [],
      authToken: params.auth_token || params.client_id || null,
    }
  }

  // Wyze returns ICE servers as { url, username, credential }; werift wants
  // { urls, ... }. Also decode a doubly-encoded signaling URL if present.
  _normalizeStreamBundle(bundle) {
    let signalingUrl = bundle.signalingUrl
    if (typeof signalingUrl === 'string' && signalingUrl.includes('%25')) {
      try { signalingUrl = decodeURIComponent(signalingUrl) } catch (_) {}
    }
    const iceServers = (bundle.iceServers || [])
      .map((s) => {
        if (!s || !(s.url || s.urls)) return null
        const out = { urls: s.urls || s.url }
        if (s.username) out.username = s.username
        if (s.credential) out.credential = s.credential
        return out
      })
      .filter(Boolean)
    return { signalingUrl, iceServers }
  }

  /**
  * cameraCaptureSnapshot — capture a live JPEG frame from a camera over WebRTC.
  * Returns the image as a Buffer. Requires the optional deps werift / ws /
  * ffmpeg-static (npm install werift ws ffmpeg-static).
  * @returns {Promise<Buffer>} JPEG bytes
  */
  async cameraCaptureSnapshot(device, { timeoutMs = 20000, logger = null } = {}) {
    const bundle = await this.getCameraSignalingInfo(device)
    const { signalingUrl, iceServers } = this._normalizeStreamBundle(bundle)
    if (!signalingUrl) throw new Error('No signaling URL returned for this camera (is it online?)')
    const { captureStreamFrame } = require('./cameraStream')
    return await captureStreamFrame({ signalingUrl, iceServers, timeoutMs, logger })
  }

  /**
  * saveCameraSnapshot — capture a frame and write it to a file. Returns the path.
  */
  async saveCameraSnapshot(device, filePath, options = {}) {
    const buffer = await this.cameraCaptureSnapshot(device, options)
    require('fs').writeFileSync(filePath, buffer)
    return filePath
  }

  /**
  * Plug controls
  */
  async plugTurnOn(device) {
    return await this.setProperty(this.deviceMac(device), device.product_model, 'P3', '1')
  }
  async plugTurnOff(device) {
    return await this.setProperty(this.deviceMac(device), device.product_model, 'P3', '0')
  }

  /**
  * Camera filters
  */
  async getCameras() {
    return await this.getDevicesByType('Camera')
  }
  async getCameraByName(name) {
    const cams = await this.getCameras()
    return cams.find(c => (c.nickname || '').toLowerCase() === String(name).toLowerCase())
  }
  async getOnlineCameras() {
    return (await this.getCameras()).filter(c => c.conn_state === 1)
  }
  async getOfflineCameras() {
    return (await this.getCameras()).filter(c => c.conn_state !== 1)
  }

}

module.exports = Wyze
