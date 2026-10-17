# Kaze Phone: custom app example

This is a small working app for [Kaze Phone](https://kazescripts.store). Use it as a template for your own phone apps.

The example is a counter. It shows the player's name and number, keeps a count on the server, sends a phone notification and closes itself.

```
kaze_phone_example/
├── fxmanifest.lua
├── client/main.lua   registers the app with the phone
├── server/main.lua   handles the app's server actions
└── ui/
    ├── index.html    the app screen (plain HTML, CSS and JS)
    ├── icon.svg      home screen icon
    └── kphone.js     optional helper module for bundled apps (React, Vue, Svelte)
```

## Install

1. Put `kaze_phone_example` in your resources folder.
2. Add it to `server.cfg` **after** `kaze_phone`:
   ```
   ensure kaze_phone
   ensure kaze_phone_example
   ```
3. Open the phone. The **Counter** app is on the home screen.

## How it works

1. The client script registers the app with `exports.kaze_phone:AddCustomApp`.
2. The phone shows your page in a sandboxed iframe.
3. The page talks to the phone with `window.parent.postMessage`.
4. The phone sends actions to your Lua code, on the server or the client, and sends back the answer.

```
ui/index.html  --kphone:callback-->  kaze_phone  --event-->  your server/main.lua
               <--:response--------              <--cb(...)--
```

## Step 1: register the app (client)

```lua
local function register()
    while GetResourceState('kaze_phone') ~= 'started' do Wait(200) end
    local res = GetCurrentResourceName()
    local ok, err = exports.kaze_phone:AddCustomApp({
        identifier = 'my-app',                                  -- unique, letters, numbers, - and _ (max 48)
        name = 'My App',                                        -- label under the icon
        ui = LoadResourceFile(res, 'ui/index.html'),            -- the page as an HTML string
        icon = ('nui://%s/ui/icon.svg'):format(res),            -- any image URL
        description = 'What the app does',
        developer = 'Your name',
        notification = true,                                    -- allow the app to send phone notifications
        job = nil,                                              -- see "Job-only apps"
        onOpen = function() end,                                -- called when the player opens the app
        onClose = function() end,                               -- called when the player leaves the app
    })
    if not ok then print('^1[my_app] ' .. tostring(err) .. '^7') end
end

-- the phone loads after your resource on a restart, and again when the player loads
AddEventHandler('kaze_phone:client:loaded', register)
AddEventHandler('onClientResourceStart', function(r) if r == GetCurrentResourceName() then register() end end)
```

Register from **both** events, as above. The phone then picks the app up whatever order the resources start in.

### Options

| Option | Required | Description |
| --- | --- | --- |
| `identifier` | yes | Unique app id. Letters, numbers, `-` and `_`, up to 48 characters. |
| `name` | yes | App name on the home screen. |
| `ui` | `ui` or `url` | The page as an HTML string, usually `LoadResourceFile(res, 'ui/index.html')`. |
| `url` | `ui` or `url` | A page URL instead, for example `nui://my_app/ui/dist/index.html`. Use this for built apps with several files. |
| `icon` | no | Icon URL (`nui://`, `https://` or a data URI). |
| `description` | no | Short description. |
| `developer` | no | Shown in the app details. |
| `color` | no | Accent color. |
| `notification` | no | `false` stops the app from sending notifications. Default `true`. |
| `defaultApp` | no | `true` places the app on the home screen by default. |
| `addAppStore` | no | `true` lists the app in the phone's app store. |
| `headerImage`, `swiperItems` | no | Images for the app store page. |
| `job` | no | Job restriction, see below. |
| `onOpen`, `onClose` | no | Client functions called when the app opens and closes. |

`AddCustomApp` returns `true`, or `false` plus an error message. Only the resource that added an app can update or remove it. The app is removed automatically when your resource stops.

### Job-only apps

```lua
job = { police = true }                 -- every police grade
job = { police = { 3, 4 }, ems = true } -- police grades 3 and 4, and every EMS grade
```

The list updates when the player's job changes (QBox, QBCore and ESX).

## Step 2: handle actions (server)

Each action is an event named `kaze_phone:customApp:<identifier>:<action>`. Server handlers receive the player's server id, the payload and a callback:

```lua
AddEventHandler('kaze_phone:customApp:my-app:get', function(src, payload, cb)
    cb({ success = true, count = 5 })
end)
```

- Call `cb` once with a table. That table is what the page receives.
- If you don't answer within 10 seconds, the page receives `{ success = false, error = 'Timeout' }`.
- The action name must use letters, numbers, `-` and `_` only.
- **Treat the payload as untrusted input.** A player can send any payload. Check permissions, money, items and distance on the server, never in the page.

### Client actions

The page can also call an action on the client by sending `server: false`. Client handlers receive no `src`:

```lua
AddEventHandler('kaze_phone:customApp:my-app:coords', function(payload, cb)
    local c = GetEntityCoords(PlayerPedId())
    cb({ success = true, x = c.x, y = c.y })
end)
```

## Step 3: the page (UI)

Your page runs in an iframe inside the phone screen. It has no access to `fetch('https://<resource>/...')` NUI callbacks. Every request goes through `postMessage`.

### Messages the page receives

| `type` | When | Data |
| --- | --- | --- |
| `kphone:init` | the page has loaded | `player` (`name`, `phoneNumber`, `citizenid`), `identifier`, `theme`, `language` |
| `kphone:callback:response` | an action has answered | `callbackId`, `result` |
| `kphone:player:response` | a player request has answered | `callbackId`, `result` |
| `broadcast` | Lua sent a message to the app | `message` |

### Messages the page sends

| `type` | Fields | What it does |
| --- | --- | --- |
| `kphone:callback` | `action`, `payload`, `callbackId`, `server` | Calls your Lua handler. `server: false` calls the client handler. |
| `kphone:player` | `callbackId` | Asks for the player's name, number and citizenid. |
| `kphone:notification` | `header`, `message` | Shows a phone notification. |
| `kphone:waypoint` | `x`, `y` | Sets a GPS waypoint. |
| `kphone:close` | none | Closes the app and returns to the home screen. |

### Minimal page

```html
<script>
  const pending = {};
  const post = (m) => window.parent.postMessage(m, '*');
  const call = (action, payload = {}, server = true) => new Promise((resolve) => {
    const callbackId = 'cb_' + Date.now() + Math.random();
    pending[callbackId] = resolve;
    post({ type: 'kphone:callback', action, payload, callbackId, server });
  });

  window.addEventListener('message', async (e) => {
    const d = e.data || {};
    if (d.type === 'kphone:callback:response' && pending[d.callbackId]) {
      pending[d.callbackId](d.result);
      delete pending[d.callbackId];
    }
    if (d.type === 'kphone:init') {
      console.log('Hello', d.player.name);
      const r = await call('get');
      if (r.success) console.log(r.count);
    }
    if (d.type === 'broadcast') console.log('From Lua:', d.message);
  });
</script>
```

See [ui/index.html](ui/index.html) for the full example, with a timeout on every call.

### Using a framework (React, Vue, Svelte)

1. Build your app with Vite or a similar tool, and set `base: './'` so the asset paths are relative.
2. Add the build folder to `files` in `fxmanifest.lua`, for example `files { 'ui/dist/**/*' }`.
3. Register the app with `url = 'nui://my_app/ui/dist/index.html'` instead of `ui`.
4. Copy [ui/kphone.js](ui/kphone.js) into your source and import it:

```js
import { onInit, sendCallback, notify, close, setWaypoint, onBroadcast } from './kphone';

onInit(async (player) => {
  const r = await sendCallback('get');          // server action
  const c = await sendCallback('coords', {}, false); // client action
});
onBroadcast((message) => console.log(message));
notify('My App', 'Saved');
setWaypoint(215.0, -810.0);
close();
```

A single HTML file (`ui = LoadResourceFile(...)`) cannot load other files with relative paths. Inline your CSS and JS, or use `url`.

## Push updates from Lua to the page

```lua
-- client
exports.kaze_phone:SendCustomAppMessage('my-app', { unread = 3 })

-- server, to one player
exports.kaze_phone:SendCustomAppMessage(source, 'my-app', { unread = 3 })
```

The page receives `{ type = 'broadcast', message = { unread = 3 } }` while the app is open.

## Other exports (client)

| Export | Returns |
| --- | --- |
| `RemoveCustomApp(identifier)` | `true`, or `false` plus an error |
| `GetCustomApp(identifier)` | the registered app, or `nil` |
| `IsPhoneOpen()` | `true` while the phone is open |

## Tips

- Design for the phone screen: portrait, about 390 × 845 px. Leave room at the top for the status bar.
- Keep state on the server if it must survive the phone closing. The iframe is destroyed when the player leaves the app.
- Use a unique identifier with your own prefix, for example `yourname-bank`.
- Restarting your resource re-registers the app. You don't need to restart the phone.

## Support

Discord: https://discord.gg/SqKhuDMK92 · Store: https://kazescripts.store
