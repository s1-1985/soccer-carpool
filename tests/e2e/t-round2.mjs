// 2巡目の修正確認: ルール権限・座席入れ替え・メンバー外乗員・却下ユーザー・荷物・天気キャッシュ・承認待ち画面
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, FS, watchErrors } from './lib.mjs';

await wipe();
async function token(email, name) {
  const t = JSON.stringify({ sub: 'sub-' + email, email, email_verified: true, name });
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=k', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postBody: 'id_token=' + encodeURIComponent(t) + '&providerId=google.com', requestUri: 'http://127.0.0.1', returnSecureToken: true }) });
  return r.json();
}
async function asUser(tok, path) {
  const r = await fetch(`${FS}/${path}`, { headers: { Authorization: 'Bearer ' + tok } });
  return r.status;
}
async function queryAs(tok, collectionId, field, value) {
  const r = await fetch(`${FS}/teams/fc-ojima:runQuery`, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } } } }) });
  return r.status;
}

// ---- データ ----
await put(`${T}/members/pl1`, { name: '選手いち', role: 'player', grade: '3', birth: '2017-06-01' });
await put(`${T}/members/pa1`, { name: '保護者いち', role: 'father', childrenIds: ['pl1'] });
const adminUid = await makeUser('r2admin@example.com', 'R2管理者', 'admin');
const parentUid = await makeUser('r2parent@example.com', 'R2保護者', 'parent', { birth: '1985-01-15' });
const strangerTok = await token('stranger@example.com', '部外者');        // usersドキュメントなし（未登録）
const parentTok = await token('r2parent@example.com', 'R2保護者');
const adminTok = await token('r2admin@example.com', 'R2管理者');

// ---- 1) Firestoreルール ----
chk('未登録のGoogleアカウントは承認済み保護者のプロフィール（メール・生年月日）を読めない', await asUser(strangerTok.idToken, `${T}/users/${parentUid}`) === 403);
chk('未登録のGoogleアカウントは users を承認済みで一覧取得できない', await queryAs(strangerTok.idToken, 'users', 'status', 'approved') === 403);
chk('承認済み保護者も他人のプロフィールは読めない', await asUser(parentTok.idToken, `${T}/users/${adminUid}`) === 403);
chk('自分のプロフィールは読める', await asUser(parentTok.idToken, `${T}/users/${parentUid}`) === 200);
chk('マネージャーは他人のプロフィールを読める', await asUser(adminTok.idToken, `${T}/users/${parentUid}`) === 200);
// 6巡目で仕様変更: 未登録のアカウントは選手も読めない（登録画面は子供の氏名を入力する方式）
chk('未登録のアカウントは選手の情報も読めない', await queryAs(strangerTok.idToken, 'members', 'role', 'player') === 403);
chk('未登録のアカウントは保護者メンバーの情報を読めない', await asUser(strangerTok.idToken, `${T}/members/pa1`) === 403);
chk('承認済みならメンバー全員を読める', await asUser(parentTok.idToken, `${T}/members/pa1`) === 200);

// ---- 2) 新規登録ページ（未登録ユーザー）で選手一覧が出る ----
{
  const ctx = await context({ email: 'stranger@example.com', name: '部外者', device: null });
  const page = await ctx.newPage();
  await page.goto(BASE + '/hub/register.html');
  // 6巡目で仕様変更: 名簿は見せず、子供の氏名を入力する
  await page.waitForFunction(() => document.querySelector('#child-inputs input'), null, { timeout: 20000 }).catch(() => {});
  const info = await page.evaluate(() => ({ input: !!document.querySelector('#child-inputs input'), roster: document.body.innerText.includes('選手いち') }));
  chk('新規登録ページは子供の氏名の入力欄を出し、選手名簿は表示しない', info.input && !info.roster, JSON.stringify(info));
  await ctx.close();
}

// ---- 3) 座席の入れ替え・メンバー外乗員 ----
const EV = '1900000002001';
const event = { id: EV, title: '入れ替え確認', date: '2026-11-20', type: 'game', target: ['3'] };
await put(`${T}/events/${EV}`, event);
await put(`${T}/members/pl2`, { name: '選手に', role: 'player', grade: '3' });
await put(`${T}/eventData/${EV}`, {
  carRegistrations: [{ parent: '保護者いち', canDrive: 'both', frontSeat: '1', middleSeat: '2', backSeat: 0, notes: '', extraPassengers: [{ name: 'いとこ' }] }],
  attendance: [{ name: '選手いち', status: 'present', notes: '' }, { name: '選手に', status: 'present', notes: '' }],
  assignments: [{ carIndex: 0, driver: '保護者いち', seats: { '助手席': { '0': '選手いち' }, '中列': { '0': '選手に' }, '後列': {} } }]
});
{
  const ctx = await context({ email: 'r2admin@example.com', name: 'R2管理者', selectedEvent: event });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  page.on('dialog', d => d.accept());
  await page.goto(BASE + '/carpool/assignments.html?event=' + EV);
  await page.waitForFunction(() => document.querySelector('.car-top-view'), null, { timeout: 25000 });
  await page.waitForTimeout(500);
  const seatSel = (t, i) => `.seat[data-seat-type="${t}"][data-seat-index="${i}"]`;
  const ep = await page.evaluate((s) => { const el = document.querySelector(s); return { p: el.dataset.person, ep: el.dataset.isExtraPassenger }; }, seatSel('中列', 1));
  chk('メンバー外乗員（いとこ）が空席に自動配置され印が付く', ep.p === 'いとこ' && ep.ep === 'true', JSON.stringify(ep));

  // 選手いち(助手席) ⇄ 選手に(中列1) を入れ替え → 「外し」通知が出ない
  const toast = await page.evaluate(() => {
    let last = null;
    const orig = FCOjima.UI.showAlert;
    FCOjima.UI.showAlert = (m) => { last = m; };
    FCOjima.Carpool.Assignment.handleSeatExchange('0', '助手席', '0', '0', '中列', '0');
    FCOjima.UI.showAlert = orig;
    return last;
  });
  chk('座席の入れ替えで「○○さんをこの座席から外し」と誤通知しない', !toast, String(toast));
  const after = await page.evaluate(() => [document.querySelector('.seat[data-seat-type="助手席"][data-seat-index="0"]').dataset.person, document.querySelector('.seat[data-seat-type="中列"][data-seat-index="0"]').dataset.person]);
  chk('入れ替え自体は行われる', after[0] === '選手に' && after[1] === '選手いち', JSON.stringify(after));

  // メンバー外乗員 ⇄ 選手 を入れ替え → 印が人について動く
  const epSwap = await page.evaluate(() => {
    FCOjima.Carpool.Assignment.handleSeatExchange('0', '中列', '1', '0', '中列', '0');
    const a = document.querySelector('.seat[data-seat-type="中列"][data-seat-index="0"]');
    const b = document.querySelector('.seat[data-seat-type="中列"][data-seat-index="1"]');
    return { a: [a.dataset.person, a.dataset.isExtraPassenger || ''], b: [b.dataset.person, b.dataset.isExtraPassenger || ''] };
  });
  chk('メンバー外乗員の印が人について移動する（選手の座席に残らない）', epSwap.a[0] === 'いとこ' && epSwap.a[1] === 'true' && epSwap.b[0] === '選手いち' && epSwap.b[1] === '', JSON.stringify(epSwap));

  // メンバー外乗員を×で外す → 空席タップで通常の配置画面が開く
  const opened = await page.evaluate(() => {
    const s = document.querySelector('.seat[data-seat-type="中列"][data-seat-index="0"]');
    s.querySelector('.seat-clear-btn').click();
    const s2 = document.querySelector('.seat[data-seat-type="中列"][data-seat-index="0"]');
    s2.click();
    const vis = id => { const m = document.getElementById(id); return !!m && getComputedStyle(m).display !== 'none'; };
    return { seatEdit: vis('seat-edit-modal'), ep: vis('extra-passenger-modal') };
  });
  chk('メンバー外乗員を外した空席をタップすると通常の配置画面が開く', opened.seatEdit && !opened.ep, JSON.stringify(opened));
  await page.evaluate(() => { FCOjima.UI.closeModal('seat-edit-modal'); });

  // 座席数が文字列の旧データでも＋で1つずつ増える
  await page.evaluate(() => FCOjima.Carpool.Assignment.adjustCarSeat(0, 'middleSeat', 1));
  const fs = await page.evaluate(() => FCOjima.Carpool.appData.carRegistrations[0].middleSeat);
  chk('座席数が文字列の旧データでも＋で1つだけ増える（"2"+1="21"→最大値4にならない）', fs === 3, JSON.stringify(fs));

  // 全画面モードでタイトルがボタンと重ならない
  await page.click('text=全画面で作業');
  await page.waitForTimeout(800);
  const ov = await page.evaluate(() => {
    const t = document.getElementById('canvas-title').getBoundingClientRect();
    const c = document.querySelector('.canvas-controls').getBoundingClientRect();
    return { titleRight: Math.round(t.right), controlsLeft: Math.round(c.left) };
  });
  chk('全画面モードでイベント名がボタンの下に潜り込まない', ov.titleRight <= ov.controlsLeft, JSON.stringify(ov));
  const bad = errs.filter(e => !/favicon|ERR_|Failed to load resource/.test(e));
  chk('座席割り当て画面でエラーなし', bad.length === 0, JSON.stringify(bad.slice(0, 3)));
  await ctx.close();
}

// ---- 4) 却下ユーザーの再承認・荷物設定 ----
const rejUid = await makeUser('rejected@example.com', '誤って却下', 'parent');
await put(`${T}/users/${rejUid}`, { name: '誤って却下', role: 'parent', status: 'rejected', email: 'rejected@example.com' });
{
  const ctx = await context({ email: 'r2admin@example.com', name: 'R2管理者', device: null });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub.Admin && document.querySelector('#all-users-list') && !document.querySelector('#all-users-list .loading'), null, { timeout: 30000 });
  await page.waitForTimeout(800);
  const txt = await page.textContent('#all-users-list');
  chk('管理タブの登録済みユーザー一覧に却下済みユーザーが表示される', txt.includes('誤って却下') && txt.includes('却下済み'), txt.slice(0, 80));
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('#all-users-list button')].find(b => b.textContent === '承認する');
    btn.click();
  });
  await page.waitForTimeout(1500);
  const u = await get(`${T}/users/${rejUid}`);
  chk('却下済みユーザーを承認し直せる', u.status === 'approved', u.status);

  // 荷物: 2つの画面からほぼ同時に追加 → 両方残る
  const ctx2 = await context({ email: 'r2admin@example.com', name: 'R2管理者', device: null });
  const page2 = await ctx2.newPage();
  await page2.goto(BASE + '/hub/index.html');
  await page2.waitForFunction(() => window.FCOjima && FCOjima.DB && FCOjima.Hub && FCOjima.Hub.Admin, null, { timeout: 30000 });
  await Promise.all([
    page.evaluate(() => FCOjima.DB.addLuggageItem('テント')),
    page2.evaluate(() => FCOjima.DB.addLuggageItem('ベンチ'))
  ]);
  const lug = await get(`${T}/luggageSettings/main`);
  chk('荷物を同時に追加しても両方残る', lug.items.includes('テント') && lug.items.includes('ベンチ'), JSON.stringify(lug.items));
  await page.evaluate(() => FCOjima.DB.removeLuggageItem('テント'));
  const lug2 = await get(`${T}/luggageSettings/main`);
  chk('荷物の削除もできる', !lug2.items.includes('テント') && lug2.items.includes('ベンチ'), JSON.stringify(lug2.items));
  await ctx.close(); await ctx2.close();
}

// ---- 5) 天気: 通信エラーの結果を当日キャッシュしない ----
{
  const ctx = await context({ device: null });
  let online = false;
  await ctx.unroute('https://msearch.gsi.go.jp/**');
  await ctx.unroute('https://api.open-meteo.com/**');
  await ctx.route('https://msearch.gsi.go.jp/**', r => online
    ? r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify([{ geometry: { coordinates: [139.3, 36.29] } }]) })
    : r.abort('internetdisconnected'));
  await ctx.route('https://api.open-meteo.com/**', r => {
    const d = new Date(); const iso = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ daily: { time: [iso(d)], weathercode: [1], temperature_2m_max: [20], temperature_2m_min: [10], precipitation_probability_max: [10] } }) });
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/hub/login.html');
  await page.waitForFunction(() => window.FCOjimaFirebase);
  await page.addScriptTag({ url: '/js/common/weather.js?t=' + Date.now() });
  const today = await page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  const r1 = await page.evaluate((t) => FCOjima.Weather.getDailyForecast('天気テスト会場', '群馬県太田市尾島町1', t), today);
  online = true;
  const r2 = await page.evaluate((t) => FCOjima.Weather.getDailyForecast('天気テスト会場', '群馬県太田市尾島町1', t), today);
  chk('通信エラー時は天気を取得できない（想定どおり）', !r1.ok, JSON.stringify(r1));
  chk('通信が戻れば同じ日でも天気を取得し直せる', r2.ok === true, JSON.stringify(r2).slice(0, 80));
  await ctx.close();
}

// ---- 6) 承認待ち画面: 確認ボタンを何度押しても文言が増えない ----
{
  const pendUid = await makeUser('r2pending@example.com', '承認待ち2', 'parent');
  await put(`${T}/users/${pendUid}`, { name: '承認待ち2', role: 'parent', status: 'pending', email: 'r2pending@example.com' });
  const ctx = await context({ email: 'r2pending@example.com', name: '承認待ち2', device: null });
  const page = await ctx.newPage();
  await page.goto(BASE + '/hub/pending.html');
  await page.waitForFunction(() => window.FCOjimaFirebase && FCOjimaFirebase.auth.currentUser, null, { timeout: 20000 });
  for (let i = 0; i < 3; i++) { await page.evaluate(() => checkStatus()); await page.waitForTimeout(300); }
  const n = await page.evaluate(() => (document.querySelector('.pending-msg').textContent.match(/まだ承認されていません/g) || []).length);
  chk('承認待ち画面で「まだ承認されていません」が重複表示されない', n === 1, String(n));
  await ctx.close();
}

await closeBrowser();
process.exit(summary() ? 1 : 0);
