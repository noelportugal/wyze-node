# 🔐 Signing & Transports

*Five backends, five signing schemes, one unified client — reverse-engineered and verified live against real hardware.*

Wyze does not have "an API." It has a constellation of independent backend services, and the cloud team that runs each one made its own call about how clients should prove a request is authentic. A vacuum talks to a different host than a lock, which talks to a different host than a wall switch, which talks to a different host than the camera stream service — and **each of those hosts validates a different signature**.

That fragmentation is normally where third-party Wyze integrations stop. They support cameras, maybe plugs, and give up on the rest. `wyze-node` instead reverse-engineered every signing scheme Wyze ships, normalized them behind a single client, and confirmed each one end-to-end against physical devices.

The payoff is a small, dependency-light library that drives the **whole** Wyze ecosystem — no Home Assistant, no Python bridge, no cloud broker in the middle.

The interesting insight that fell out of the reverse-engineering: **three of the five transports are secretly the same algorithm.** Venus, Olive, and Web all sign with `HMAC-MD5` keyed on `md5(access_token + salt)` over the request body — they differ only in salt, host, and header casing. The lock (Ford) is the genuine outlier, with a completely different `md5(quote_plus(...))` construction that puts its credentials in the payload instead of the headers.

## 📋 Transport summary

| Transport | Devices | Host | Signing |
|---|---|---|---|
| **Auth / Standard API** | Login + most device list / property / `run_action` calls | `auth-prod.api.wyze.com` → `api.wyzecam.com` | API Key flow (`keyid` + `apikey`), triple-MD5 password, bearer access token |
| **Ex / Venus** 🤖 | Robot vacuum | `wyze-venus-service-vn.wyzecam.com` | `HMAC-MD5( md5(token + saltₐ), body )` → `signature2` header |
| **Olive / Sirius** 🔌 | Wall switch, HMS (home monitoring) | `wyze-sirius-service.wyzecam.com`, `hms.api.wyze.com`, `wyze-membership-service.wyzecam.com` | `HMAC-MD5( md5(token + salt_b), body )` → `signature2` header *(different salt)* |
| **Ford** 🔒 | Lock | `yd-saas-toc.wyzecam.com` | `md5( quote_plus( method + path + sortedParams + appSecret ) )` → `sign` in payload |
| **Web** 📹 | Camera WebRTC stream info | `app.wyzecam.com` | `HMAC-MD5( md5(token + salt_c), body )`, camelCase `appId`/`appInfo` headers |

> **Note:** Venus, Olive, and Web are the same `HMAC-MD5(md5(token + salt), body)` family. If you understand one, you understand three — the only moving parts are the salt, the host, and the header casing. Ford is the one that breaks the pattern.

## 🔑 Auth / Standard API

This is the foundation everything else builds on, and the only transport that mints credentials rather than spending them.

Login uses Wyze's developer **API Key** flow. You bring a `keyid` / `apikey` pair (issued from the Wyze developer portal) and your account credentials. The password is never sent in the clear or as a single hash — it is hashed with **MD5 three times in succession** before it ever leaves the process:

```js
// Triple-MD5 password
const hashed = md5(md5(md5(password)));

POST https://auth-prod.api.wyze.com/api/user/login
headers: {
  "keyid":  WYZE_KEY_ID,
  "apikey": WYZE_API_KEY,
  // ...standard app identity headers
}
body: {
  email,
  password: hashed,   // triple-MD5
}
// → { access_token, refresh_token }
```

Once you hold an `access_token`, the bulk of "normal" Wyze operations — enumerating devices, reading and writing device properties, and firing `run_action` commands — go to `api.wyzecam.com` with the token attached as a bearer credential.

```js
POST https://api.wyzecam.com/app/v2/device/get_property_list
body: { access_token, device_mac, device_model, /* ... */ }
```

> **Note:** The triple-MD5 password and the `keyid`/`apikey` headers are specific to the developer API Key login endpoint (`auth-prod.api.wyze.com`). Everything downstream just rides on the resulting `access_token`.

## 🤖 Ex / Venus (Robot Vacuum)

The vacuum lives behind the **venus** service at `wyze-venus-service-vn.wyzecam.com`, and it is the first place the `HMAC-MD5` signing family shows up.

The signature is an HMAC-MD5 where the **key is itself a hash** of the access token plus a service-specific salt, and the **message is the request payload**:

```js
// signature2 header (Venus)
const key = md5(access_token + VENUS_SALT);
const signature2 = hmacMD5(key, body);
```

What counts as `body` depends on the HTTP verb:

- **POST** — the compact (no-whitespace) JSON object that will be sent, including a freshly generated `nonce`.
- **GET** — the query parameters sorted by key and joined as `k=v&k=v`.

Alongside `signature2`, venus expects a cluster of identity headers that tie the request to the app and to this specific call:

```js
headers: {
  appid:      WYZE_APP_ID,
  appinfo:    WYZE_APP_INFO,
  requestid:  md5(md5(nonce)),   // double-MD5 of the nonce
  signature2,
}
```

> **Note:** `requestid` is `md5(md5(nonce))` — a double-MD5 of the same nonce that gets embedded in the POST body. The nonce is the thread connecting the body, the signature, and the request id.

## 🔌 Olive / Sirius (Wall Switch & HMS)

The **olive** service drives the wall switch at `wyze-sirius-service.wyzecam.com`, and the same signing scheme covers Wyze's **Home Monitoring System (HMS)** endpoints at `hms.api.wyze.com` and `wyze-membership-service.wyzecam.com`.

Algorithmically, olive is venus with one byte changed: the **salt is different**.

```js
// signature2 header (Olive) — same shape as Venus, different salt
const key = md5(access_token + OLIVE_SALT);   // ← salt differs from Venus
const signature2 = hmacMD5(key, body);
// GET  → body = sorted "k=v&k=v" params
// POST → body = JSON request body
```

The header set is a little broader than venus, carrying the phone identity and the token explicitly:

```js
headers: {
  appid:        WYZE_APP_ID,
  appinfo:      WYZE_APP_INFO,
  phoneid:      WYZE_PHONE_ID,
  access_token: access_token,
  signature2,
}
```

> **Note:** Because olive shares its algorithm with venus, the *only* code that needs to be transport-aware is salt selection and which headers to attach. That is the entire reason these three transports collapse into one signer internally.

## 🔒 Ford (Lock)

The lock is the rebel. It talks to `yd-saas-toc.wyzecam.com` and throws out the `HMAC-MD5` family entirely.

Instead of signing the body and putting the signature in a header, Ford computes a plain MD5 over a **URL-encoded concatenation** of the request shape plus a shared app secret — and then ships the signature *inside the request payload*, not the headers:

```js
// sign (Ford)
const sign = md5(
  quote_plus( method + path + sortedParams + FORD_APP_SECRET )
);
```

`sortedParams` is the request's parameters serialized in sorted-key order, and `quote_plus` is the standard form-style URL encoding (spaces → `+`). The signing inputs — the access token, the Ford app `key`, a `timestamp`, and the resulting `sign` — all travel **in the params (GET) or in the JSON body (POST)**. None of them are headers.

```js
// GET — credentials in the query string
{ access_token, key: FORD_APP_KEY, timestamp, ...params, sign }

// POST — credentials in the JSON body, with a casing twist
{ accessToken, key: FORD_APP_KEY, timestamp, ...params, sign }
```

> **Note:** Watch the casing. Ford POST uses **`accessToken`** (camelCase) while Ford GET uses **`access_token`** (snake_case). Get this wrong and the lock service rejects the call with no useful error. This kind of per-verb inconsistency is exactly what makes the Wyze surface hard to integrate — and exactly what this library pins down so you don't have to.

Ford also signs with its own dedicated **app key + app secret** pair, distinct from the app id used by the other transports.

## 📹 Web (Camera WebRTC Stream Info)

The last transport is how you get a live camera feed. It hits `app.wyzecam.com` at `/app/v4/camera/get-streams`, and it is back in the `HMAC-MD5` family — with, predictably, **yet another salt**:

```js
// Web — same family as Venus/Olive, third salt
const key = md5(access_token + WEB_SALT);
const signature2 = hmacMD5(key, body);

POST https://app.wyzecam.com/app/v4/camera/get-streams
headers: {
  appId:   WYZE_APP_ID,    // ← camelCase here
  appInfo: WYZE_APP_INFO,  // ← camelCase here
  signature2,
}
```

The header difference is purely cosmetic but load-bearing: venus and olive use lowercase `appid` / `appinfo`, while the web stream endpoint insists on camelCase **`appId`** / **`appInfo`**.

The response is the genuinely useful part. Rather than a raw H.264 socket, Wyze hands back the coordinates for a **WebRTC** session:

- an **AWS Kinesis Video** signaling channel URL,
- a set of **ICE / TURN** servers for NAT traversal.

From there a standard WebRTC peer connection negotiates the live stream — the same path the official app uses, now available to any Node process.

> **Note:** This means low-latency, peer-negotiated camera streaming with no RTSP firmware hack and no cloud relay you have to operate yourself. You ask Wyze for the signaling URL and connect.

## 💡 Why it matters

Most "Wyze for developers" stories end at cameras and smart plugs because those are the only services with a forgiving, well-trodden API. The vacuum, the lock, the wall switch, and the home monitoring system each sit behind their own host with their own signature, and reverse-engineering one tells you almost nothing about the next.

`wyze-node` did the work once, for all of them, and verified each transport against real hardware rather than against a packet capture and a hope. The result is a single small library — no Home Assistant, no Python sidecar, no broker — that can authenticate, enumerate, read, and command the **entire** Wyze ecosystem from plain Node.js.

That breadth, earned through the signing work above, is the whole point.
