'use strict'

// Service configs, signing salts, and property IDs used across the client.
// Kept here so the main client and the streaming module share one source.

// Newer Wyze "Ex" services (vacuum, …) live on their own hosts and require
// signed requests: an HMAC-MD5 `signature2` keyed on md5(access_token + salt).
const EX_SERVICES = {
  venus: { // robot vacuum
    baseUrl: 'https://wyze-venus-service-vn.wyzecam.com',
    appId: 'venp_4c30f812828de875',
    salt: 'CVCSNoa0ALsNEpgKls6ybVTVOmGzFoiq',
    appVersion: '2.19.14',
  },
}

// Vacuum control command codes (see wyze-sdk VenusDeviceControlRequest).
const VACUUM_CONTROL_TYPE = { SWEEPING: 0, RECHARGE: 3, AREA_CLEAN: 6, QUICK_MAPPING: 7 }
const VACUUM_CONTROL_VALUE = { STOP: 0, START: 1, PAUSE: 2, FALSE_PAUSE: 3 }

// "olive" IoT-prop transport on the sirius host (wall switches, thermostats…).
// signature2 = HMAC-MD5(md5(access_token + salt), body).
const SIRIUS = {
  baseUrl: 'https://wyze-sirius-service.wyzecam.com',
  appId: '9319141212m2ik',
  salt: 'wyze_app_secret_key_132',
  appInfo: 'wyze_android_2.19.14',
}
const DEFAULT_IOT_KEYS = 'iot_state,switch-power,switch-iot,single_press_type,double_press_type,triple_press_type,long_press_type,palm-state'

// Home Monitoring System (HMS) hosts. Uses the same olive signing.
const HMS = {
  membershipUrl: 'https://wyze-membership-service.wyzecam.com',
  apiUrl: 'https://hms.api.wyze.com',
}

// Wyze Scale — also signed with the olive scheme, on its own host.
const SCALE = {
  baseUrl: 'https://wyze-scale-service.wyzecam.com',
}

// "web" signing for the camera WebRTC stream-info endpoint.
const WEB = {
  baseUrl: 'https://app.wyzecam.com',
  appId: 'strv_e7f78e9e7738dc50',
  appInfo: 'wyze_web_2.3.1',
  salt: 'gbJojEBViLklgwyyDikx5ztSvKBXI5oU',
}

// Camera control property IDs (ported from jfarmer08/wyze-api).
const CAMERA_PROPERTY_IDS = {
  notifications: 'P1',        // push notifications 1/0
  motion: 'P1001',            // motion detection 1/0
  motionRecording: 'P1047',   // event motion recording 1/0
  soundNotification: 'P1048', // sound recording/notification 1/0
  light: 'P1056',             // floodlight / spotlight: 1 = on, 2 = off
}

// The lock lives on the "ford" service, which uses a different signing scheme:
// sign = md5(quote_plus(method + path + sortedParams + appSecret)).
const FORD = {
  baseUrl: 'https://yd-saas-toc.wyzecam.com',
  appKey: '275965684684dbdaf29a0ed9',
  appSecret: '4deekof1ba311c5c33a9cb8e12787e8c',
  appVersion: '2.19.14',
}

// Property IDs used by the bulb/light convenience helpers.
const BULB_PROPERTY_IDS = {
  brightness: 'P1501',   // 0-100
  colorTemp: 'P1502',    // color temperature in Kelvin (~1800-6500)
  color: 'P1507',        // 'RRGGBB' hex (mesh / color bulbs only)
  controlLight: 'P1508', // light strips: 1 = color, 2 = temperature
  sunMatch: 'P1528',     // 0/1 — mimic natural sunlight
}

// Model codes that drive transport selection. Mesh bulbs and light strips apply
// properties via set_mesh_property (run_action_list); plain white bulbs don't.
// Model is used (not product_type) because group members only expose the model.
const BULB_MODELS = {
  lightStrip: ['HL_LSL', 'HL_LSLP'],
  mesh: ['WLPA19C', 'HL_LSL', 'HL_LSLP'],
}

module.exports = {
  EX_SERVICES,
  VACUUM_CONTROL_TYPE,
  VACUUM_CONTROL_VALUE,
  SIRIUS,
  DEFAULT_IOT_KEYS,
  HMS,
  WEB,
  CAMERA_PROPERTY_IDS,
  FORD,
  SCALE,
  BULB_PROPERTY_IDS,
  BULB_MODELS,
}
