'use strict'

/**
 * Headless WebRTC single-frame capture for Wyze cameras.
 *
 * Wyze cameras stream over AWS Kinesis Video WebRTC. This negotiates a
 * recvonly H.264 session against the camera's signed signaling URL (via
 * `werift`), forwards the incoming RTP to a local UDP socket, and pipes that
 * into FFmpeg (bundled by `ffmpeg-static`) to pull a single JPEG frame.
 *
 * Exposed on the client as `wyze.cameraCaptureSnapshot(device)`. These deps
 * (werift / ws / ffmpeg-static) are optional — they're only required when you
 * actually capture a frame.
 */

const dgram = require('dgram')
const fs = require('fs')
const os = require('os')
const path = require('path')
const nodeCrypto = require('crypto')
const { spawn } = require('child_process')

// Wyze only answers H.264 (baseline 3.1). werift's defaults advertise VP8/VP9,
// which the camera rejects — leaving an empty SDP answer and a "negotiate
// codecs failed" throw. Pin H.264 + matching feedback.
function h264Codecs(RTCRtpCodecParameters) {
  return [
    new RTCRtpCodecParameters({
      mimeType: 'video/H264',
      clockRate: 90000,
      rtcpFeedback: [
        { type: 'nack' },
        { type: 'nack', parameter: 'pli' },
        { type: 'goog-remb' },
      ],
      parameters: 'level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001f',
    }),
  ]
}

let _ffmpegPath = null
function resolveFfmpeg() {
  if (_ffmpegPath) return _ffmpegPath
  try {
    const ffmpegStatic = require('ffmpeg-static')
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      _ffmpegPath = ffmpegStatic
      return _ffmpegPath
    }
  } catch (_) { /* fall through to PATH */ }
  _ffmpegPath = 'ffmpeg'
  return _ffmpegPath
}

function pickFreeUdpPort() {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket('udp4')
    sock.once('error', reject)
    sock.bind(0, '127.0.0.1', () => {
      const { port } = sock.address()
      sock.close(() => resolve(port))
    })
  })
}

function writeSdpFile(rtpPort) {
  const sdp = `v=0
o=- 0 0 IN IP4 127.0.0.1
s=WyzeCapture
c=IN IP4 127.0.0.1
t=0 0
m=video ${rtpPort} RTP/AVP 96
a=rtpmap:96 H264/90000
a=fmtp:96 packetization-mode=1
`
  const sdpPath = path.join(os.tmpdir(), `wyze-capture-${process.pid}-${nodeCrypto.randomBytes(4).toString('hex')}.sdp`)
  fs.writeFileSync(sdpPath, sdp)
  return sdpPath
}

function spawnFfmpeg(sdpPath) {
  return spawn(resolveFfmpeg(), [
    '-loglevel', 'error',
    '-protocol_whitelist', 'file,rtp,udp',
    '-fflags', '+genpts+discardcorrupt+nobuffer',
    '-flags', 'low_delay',
    '-i', sdpPath,
    '-frames:v', '1',
    '-vsync', 'passthrough',
    '-f', 'image2',
    '-c:v', 'mjpeg',
    '-q:v', '2',
    'pipe:1',
  ], { stdio: ['ignore', 'pipe', 'pipe'] })
}

// Kinesis signaling envelope: JSON with a base64-encoded inner payload.
function sendSignal(WebSocket, ws, action, payload, recipientClientId = 'MASTER') {
  if (ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({
    action,
    messagePayload: Buffer.from(JSON.stringify(payload)).toString('base64'),
    recipientClientId,
  }))
}

function parseSignal(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null
  try {
    const env = JSON.parse(raw)
    const type = env.messageType || env.action
    if (!type) return null
    let payload = null
    if (env.messagePayload) {
      try { payload = JSON.parse(Buffer.from(env.messagePayload, 'base64').toString('utf8')) } catch (_) {}
    }
    return { type, payload }
  } catch (_) {
    return null
  }
}

/**
 * Capture a single JPEG frame from a camera's WebRTC stream.
 * @param {{signalingUrl:string, iceServers:Array, timeoutMs?:number, logger?:object}} params
 * @returns {Promise<Buffer>} JPEG bytes
 */
async function captureStreamFrame({ signalingUrl, iceServers, timeoutMs = 20_000, logger = null }) {
  let RTCPeerConnection, RTCRtpCodecParameters, WebSocket
  try {
    ({ RTCPeerConnection, RTCRtpCodecParameters } = require('werift'))
    WebSocket = require('ws')
  } catch (err) {
    throw new Error(
      'WebRTC capture needs the optional deps `werift`, `ws`, and `ffmpeg-static`. ' +
      'Install them with: npm install werift ws ffmpeg-static'
    )
  }

  const log = (level, msg) => { if (logger && typeof logger[level] === 'function') logger[level](`[capture] ${msg}`) }

  const rtpPort = await pickFreeUdpPort()
  const sdpPath = writeSdpFile(rtpPort)

  let ffmpeg = null, pc = null, ws = null, fwdSock = null
  const cleanup = () => {
    try { ws?.close() } catch (_) {}
    try { pc?.close() } catch (_) {}
    try { fwdSock?.close() } catch (_) {}
    try { ffmpeg?.kill('SIGKILL') } catch (_) {}
    try { fs.unlinkSync(sdpPath) } catch (_) {}
  }

  try {
    ffmpeg = spawnFfmpeg(sdpPath)
    fwdSock = dgram.createSocket('udp4')

    const stdoutChunks = [], stderrChunks = []
    ffmpeg.stdout.on('data', (c) => stdoutChunks.push(c))
    ffmpeg.stderr.on('data', (c) => stderrChunks.push(c))

    const ffmpegOutcome = new Promise((resolve, reject) => {
      ffmpeg.once('error', (err) => {
        if (err && err.code === 'ENOENT') {
          reject(new Error(`ffmpeg not found (tried: ${resolveFfmpeg()}). Re-run npm install for ffmpeg-static, or put ffmpeg on PATH.`))
        } else reject(err)
      })
      ffmpeg.once('close', (code) => {
        if (stdoutChunks.length > 0) resolve(Buffer.concat(stdoutChunks))
        else reject(new Error(`ffmpeg exited (${code}) without a frame: ${Buffer.concat(stderrChunks).toString()}`))
      })
    })

    pc = new RTCPeerConnection({ iceServers, codecs: { video: h264Codecs(RTCRtpCodecParameters) } })
    pc.addTransceiver('video', { direction: 'recvonly' })
    pc.onTrack.subscribe((track) => {
      log('debug', `track kind=${track.kind} codec=${track.codec?.name}`)
      track.onReceiveRtp.subscribe((rtp) => {
        try { fwdSock.send(rtp.serialize(), rtpPort, '127.0.0.1') } catch (_) {}
      })
    })

    ws = new WebSocket(signalingUrl)
    const remoteAnswered = new Promise((resolve, reject) => {
      ws.on('message', async (raw) => {
        const msg = parseSignal(raw.toString())
        if (!msg) return
        try {
          if (msg.type === 'SDP_ANSWER') { await pc.setRemoteDescription(msg.payload); resolve() }
          else if (msg.type === 'ICE_CANDIDATE') { await pc.addIceCandidate(msg.payload) }
        } catch (err) { reject(err) }
      })
      ws.once('error', reject)
      ws.once('close', (code) => { if (code !== 1000) reject(new Error(`signaling WS closed (${code})`)) })
    })

    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(`capture timed out after ${timeoutMs}ms`)), timeoutMs))

    await Promise.race([
      new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject) }),
      ffmpegOutcome,
      timeout,
    ])
    log('debug', 'signaling open, sending offer')
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    sendSignal(WebSocket, ws, 'SDP_OFFER', { type: 'offer', sdp: pc.localDescription.sdp })
    pc.onIceCandidate.subscribe((c) => { if (c?.candidate) sendSignal(WebSocket, ws, 'ICE_CANDIDATE', c) })

    await Promise.race([remoteAnswered, ffmpegOutcome, timeout])
    log('debug', 'negotiation complete, waiting for frame')
    const buffer = await Promise.race([ffmpegOutcome, timeout])
    log('debug', `captured ${buffer.length} bytes`)
    return buffer
  } finally {
    cleanup()
  }
}

module.exports = { captureStreamFrame }
