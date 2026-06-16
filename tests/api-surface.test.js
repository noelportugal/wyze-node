'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const Wyze = require('../src/index.js')

const wyze = new Wyze({ username: 'test@example.com', password: 'x' })

// Contract test: guards against accidentally dropping a public method during
// refactors. If you intentionally rename/remove one, update this list.
const EXPECTED_METHODS = [
  // core / auth
  'login', 'getRefreshToken', 'getObjectList', 'getDeviceList', 'getDeviceByName',
  'getDeviceByMac', 'getDevicesByType', 'getDevicesByModel', 'getDeviceGroupsList',
  'runAction', 'runActionList', 'runActionListBatch', 'setProperty', 'getPropertyList',
  'turnOn', 'turnOff', 'getDeviceState', 'deviceMac',
  // events
  'getEventList', 'getEventVideoURL',
  // lights + groups
  'isMeshBulb', 'isLightStrip', 'setBrightness', 'setColorTemp', 'setColor', 'setSunMatch',
  'getDeviceGroupByName', 'turnOnGroup', 'turnOffGroup', 'setGroupBrightness',
  'setGroupColorTemp', 'setGroupColor',
  // transports
  'exServiceCall', 'fordServiceCall', 'getIotProp', 'setIotProp',
  // vacuum
  'getVacuumStatus', 'startVacuum', 'pauseVacuum', 'dockVacuum', 'controlVacuum',
  // lock
  'getLockInfo', 'lockDoor', 'unlockDoor', 'controlLock', 'lockUuid',
  // wall switch
  'wallSwitchPowerOn', 'wallSwitchPowerOff', 'wallSwitchIotOn', 'wallSwitchIotOff',
  'wallSwitchLedOn', 'wallSwitchLedOff', 'wallSwitchVacationModeOn', 'wallSwitchVacationModeOff',
  // garage + plug
  'garageDoor', 'plugTurnOn', 'plugTurnOff',
  // hms
  'getPlanBindingListByUser', 'getHmsId', 'getHmsState', 'setHmsState',
  // scale
  'getScaleLatestRecord', 'getScaleRecords', 'getScaleFamilyMembers',
  // cameras
  'getCameras', 'getCameraByName', 'getOnlineCameras', 'getOfflineCameras',
  'getCameraThumbnail', 'cameraTurnOn', 'cameraTurnOff', 'cameraMotionOn', 'cameraMotionOff',
  'cameraNotificationsOn', 'cameraNotificationsOff', 'cameraMotionRecordingOn',
  'cameraMotionRecordingOff', 'cameraSoundNotificationOn', 'cameraSoundNotificationOff',
  'cameraFloodLightOn', 'cameraFloodLightOff', 'cameraSpotLightOn', 'cameraSpotLightOff',
  'cameraSirenOn', 'cameraSirenOff',
  // camera streaming
  'getCameraStreamInfo', 'getCameraSignalingInfo', 'cameraCaptureSnapshot', 'saveCameraSnapshot',
]

test('all expected public methods are present', () => {
  const missing = EXPECTED_METHODS.filter((m) => typeof wyze[m] !== 'function')
  assert.deepEqual(missing, [], `missing methods: ${missing.join(', ')}`)
})

test('exposes the Wyze constructor', () => {
  assert.equal(typeof Wyze, 'function')
  assert.ok(wyze instanceof Wyze)
})
