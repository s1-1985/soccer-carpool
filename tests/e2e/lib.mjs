import { chromium, devices } from 'playwright';
import fs from 'fs';
export const BASE = 'http://127.0.0.1:5000';
export const VENDOR = new URL('./vendor', import.meta.url).pathname;
export const FS = 'http://127.0.0.1:8080/v1/projects/fc-ojimajr-hub/databases/(default)/documents';
export const T = 'teams/fc-ojima';

const R = [];
export function chk(n, ok, x = '') { R.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`); }
export function summary() { console.log(`\n${R.length}項目 FAIL ${R.filter(x => !x).length}件`); return R.filter(x => !x).length; }

export function fv(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fv) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fv(x)])) } };
}
export function unfv(v) {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(unfv);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, unfv(x)]));
  if ('timestampValue' in v) return v.timestampValue;
  return undefined;
}
export async function put(p, d) {
  const r = await fetch(`${FS}/${p}`, { method: 'PATCH', headers: { 'Authorization': 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, fv(v)])) }) });
  if (!r.ok) throw new Error(p + ':' + r.status + ' ' + await r.text());
}
export async function get(p) {
  const r = await fetch(`${FS}/${p}`, { headers: { 'Authorization': 'Bearer owner' } });
  if (r.status === 404) return null;
  const j = await r.json();
  return Object.fromEntries(Object.entries(j.fields || {}).map(([k, v]) => [k, unfv(v)]));
}
export async function list(col) {
  const out = [];
  let tok = '';
  do {
    const r = await fetch(`${FS}/${col}?pageSize=1000` + (tok ? '&pageToken=' + encodeURIComponent(tok) : ''), { headers: { 'Authorization': 'Bearer owner' } });
    const j = await r.json();
    (j.documents || []).forEach(d => out.push({ id: d.name.split('/').pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, unfv(v)])) }));
    tok = j.nextPageToken || '';
  } while (tok);
  return out;
}
export async function del(p) {
  await fetch(`${FS}/${p}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer owner' } });
}
export async function wipe() {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/fc-ojimajr-hub/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/fc-ojimajr-hub/accounts', { method: 'DELETE' });
}

async function idpToken(email, name) {
  const t = JSON.stringify({ sub: 'sub-' + email, email, email_verified: true, name });
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=k', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postBody: 'id_token=' + encodeURIComponent(t) + '&providerId=google.com', requestUri: 'http://127.0.0.1', returnSecureToken: true }) });
  return r.json();
}

/** ユーザーを作成（users ドキュメント付き）し uid を返す */
export async function makeUser(email, name, role = 'admin', extra = {}) {
  const j = await idpToken(email, name);
  await put(`${T}/users/${j.localId}`, { name, role, status: 'approved', email, ...extra });
  return j.localId;
}

let _browser = null;
export async function browser() {
  if (!_browser) _browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  return _browser;
}
export async function closeBrowser() { if (_browser) await _browser.close(); _browser = null; }

/** ログイン済みコンテキストを作る */
export async function context({ email, name, device = 'iPhone 13', selectedEvent = null } = {}) {
  const b = await browser();
  const opts = device ? (typeof device === 'object' ? device : { ...devices[device], hasTouch: true }) : { viewport: { width: 1280, height: 900 } };
  const ctx = await b.newContext({ ...opts, ignoreHTTPSErrors: true, timezoneId: 'Asia/Tokyo', locale: 'ja-JP' });
  await ctx.addInitScript(`localStorage.setItem('fcojima_use_emulator','1');` +
    (selectedEvent ? `if(!sessionStorage.getItem('fcojima_selectedEvent'))sessionStorage.setItem('fcojima_selectedEvent', ${JSON.stringify(JSON.stringify(selectedEvent))});` : ''));
  await ctx.route('https://www.gstatic.com/firebasejs/**', r => r.fulfill({ body: fs.readFileSync(`${VENDOR}/${r.request().url().split('/').pop()}`, 'utf8'), contentType: 'text/javascript' }));
  await ctx.route('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/**', r => r.fulfill({ body: fs.readFileSync(`${VENDOR}/html2canvas.min.js`, 'utf8'), contentType: 'text/javascript' }));
  await ctx.route('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/**', r => r.fulfill({ body: 'window.QRCode=function(){};window.QRCode.CorrectLevel={M:0};', contentType: 'text/javascript' }));
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await ctx.route('https://fonts.gstatic.com/**', r => r.fulfill({ status: 404, body: '' }));
  await ctx.route('https://api.open-meteo.com/**', r => r.fulfill({ status: 404, body: '' }));
  await ctx.route('https://geocoding-api.open-meteo.com/**', r => r.fulfill({ status: 404, body: '' }));
  await ctx.route('https://msearch.gsi.go.jp/**', r => r.fulfill({ status: 404, body: '' }));
  if (email) {
    const page = await ctx.newPage();
    await page.goto(BASE + '/hub/login.html');
    await page.waitForFunction(() => window.FCOjimaFirebase && window.FCOjimaFirebase.auth);
    const tok = await idpToken(email, name);
    await page.evaluate(async (idToken) => {
      const cred = window.firebase.auth.GoogleAuthProvider.credential(idToken);
      await window.FCOjimaFirebase.auth.signInWithCredential(cred);
    }, tok.idToken).catch(e => console.log('signin-note', e.message));
    await page.waitForTimeout(1200);
    await page.close();
  }
  return ctx;
}

export function watchErrors(page, label = '') {
  const errs = [];
  page.on('pageerror', e => errs.push(label + String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(label + 'console: ' + m.text()); });
  return errs;
}
