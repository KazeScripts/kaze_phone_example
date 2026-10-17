const pending = {};
const id = () => `cb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
const post = (msg) => window.parent.postMessage(msg, '*');

window.addEventListener('message', (e) => {
  const d = e.data || {};
  if ((d.type === 'kphone:callback:response' || d.type === 'kphone:player:response') && pending[d.callbackId]) {
    pending[d.callbackId](d.result);
    delete pending[d.callbackId];
  }
});

const ask = (type, extra) => new Promise((resolve) => {
  const callbackId = id();
  pending[callbackId] = resolve;
  post({ type, callbackId, ...extra });
  setTimeout(() => { if (pending[callbackId]) { delete pending[callbackId]; resolve({ success: false, error: 'Timeout' }); } }, 10000);
});

export const sendCallback = (action, payload = {}, toServer = true) => ask('kphone:callback', { action, payload, server: toServer });
export const getPlayer = () => ask('kphone:player');
export const onInit = (cb) => window.addEventListener('message', (e) => { if (e.data?.type === 'kphone:init') cb(e.data.player || {}, e.data); });
export const onBroadcast = (cb) => window.addEventListener('message', (e) => { if (e.data?.type === 'broadcast') cb(e.data.message); });
export const notify = (header, message) => post({ type: 'kphone:notification', header, message });
export const close = () => post({ type: 'kphone:close' });
export const setWaypoint = (x, y) => post({ type: 'kphone:waypoint', x, y });
