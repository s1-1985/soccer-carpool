// デバッグの指示書（2026-11-21）で確かめて直した項目の回帰テスト:
// 参加の移動の途中失敗を戻す・役割変更でユーザー一覧が読めないとき中断・車登録の表記揺れ・添付の権限・会場IDのXSS・
// 日付範囲のフリーズ・週末の段取りの競合・保存マージ・ログの検証（ルール）・承認待ちの端末データ
import { put, get, list, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, FS, fv, watchErrors } from './lib.mjs';
await wipe();
const jst = new Date(Date.now() + 9 * 3600e3);
const iso = d => d.toISOString().slice(0, 10);
const D = iso(new Date(jst.getTime() + 3 * 86400e3));
const EA = '1900001100001', EB = '1900001100002';
await put(`${T}/members/p6`, { name: '六年 一郎', role: 'player', grade: '6' });
await put(`${T}/members/p4`, { name: '田中太郎', role: 'player', grade: '4' });
await put(`${T}/members/m4`, { name: '四年 母', role: 'mother', childrenIds: ['p4'] });
await put(`${T}/events/${EA}`, { title: '5・6年 試合', date: D, type: 'game', target: ['5', '6'], startTime: '09:00' });
await put(`${T}/events/${EB}`, { title: '3・4年 練習試合', date: D, type: 'game', target: ['3', '4'], startTime: '10:00' });
await put(`${T}/eventData/${EA}`, { attendance: [{ name: '六年 一郎', status: 'present', notes: '' }] });
await put(`${T}/eventData/${EB}`, { attendance: [] });
await put(`${T}/venues/v1`, { name: '会場', address: '群馬' });
const adminUid = await makeUser('dbg-admin@example.com', '管理 太郎', 'admin');
await makeUser('dbg-parent@example.com', '四年 母', 'parent', { childrenIds: ['p4'] });

async function openHub(email, name, device = 'iPhone 13') {
  const ctx = await context({ email, name, device });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  page.on('dialog', d => d.accept());
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(900);
  return { ctx, page, errs };
}

// ---------- 管理者の画面 ----------
{
  const { ctx, page, errs } = await openHub('dbg-admin@example.com', '管理 太郎');

  // 参加の移動: 2つ目の書き込みで失敗したら、1つ目（学年外の追加＋移動先の出欠）を戻す
  const mv = await page.evaluate(async ({ EA, EB }) => {
    const PM = FCOjima.PlayerMove;
    const from = FCOjima.Hub.events.find(e => String(e.id) === EA), to = FCOjima.Hub.events.find(e => String(e.id) === EB);
    const m = FCOjima.Hub.members.find(x => x.name === '六年 一郎'); // 6年は移動先（3・4年）の学年外 → 学年外の追加になる
    const orig = FCOjima.DB.updateEventData;
    let calls = 0;
    FCOjima.DB.updateEventData = function(id, fn) { calls++; if (calls === 2) return Promise.reject(new Error('テスト用の失敗')); return orig.call(FCOjima.DB, id, fn); };
    let err = null;
    try { await PM.move(m, from, to); } catch (e) { err = e.message; }
    FCOjima.DB.updateEventData = orig;
    const toData = await FCOjima.DB.loadEventData(EB), fromData = await FCOjima.DB.loadEventData(EA);
    const ev = (await FCOjima.DB.loadEvents()).find(e => String(e.id) === EB);
    return { err, toRows: (toData.attendance || []).filter(a => a.name === '六年 一郎').length, extra: (ev.extraPlayers || []), fromStatus: ((fromData.attendance || []).find(a => a.name === '六年 一郎') || {}).status };
  }, { EA, EB });
  chk('参加の移動が途中で失敗したら、済んだ書き込みを戻す（二重に残らない）', mv.err === 'テスト用の失敗' && mv.toRows === 0 && mv.extra.indexOf('六年 一郎') === -1 && mv.fromStatus === 'present', JSON.stringify(mv));

  // 役割変更: ユーザー一覧を読めないときは中断（前の監督がコーチにならないまま進めない）
  const ur = await page.evaluate(async () => {
    const A = FCOjima.Hub.Admin;
    A._users = null;
    const orig = FCOjima.DB.loadAllUsers; let setK = 0; const origSet = FCOjima.DB.setKantoku;
    FCOjima.DB.loadAllUsers = () => Promise.reject(new Error('読めない'));
    FCOjima.DB.setKantoku = function() { setK++; return Promise.resolve(); };
    let alerts = []; const oa = FCOjima.UI.showAlert; FCOjima.UI.showAlert = (m) => alerts.push(m);
    let unhandled = false; window.addEventListener('unhandledrejection', () => { unhandled = true; });
    await A.updateRole('someone', 'coach', 'だれか');
    await A.approveUser('someone', 'だれか', [], { role: 'coach' });
    await new Promise(r => setTimeout(r, 300));
    FCOjima.DB.loadAllUsers = orig; FCOjima.DB.setKantoku = origSet; FCOjima.UI.showAlert = oa; A._users = null;
    return { setK, alerts, unhandled };
  });
  chk('役割変更・監督の承認: ユーザー一覧を読めないときは中断して知らせる（未処理の失敗にならない）', ur.setK === 0 && ur.alerts.length === 2 && !ur.unhandled, JSON.stringify(ur));

  // 都合を聞く日: 年単位の範囲でも固まらない
  const cd = await page.evaluate(async () => {
    FCOjima.Hub.Coaching.openAddDates && FCOjima.Hub.Coaching.openAddDates(function() {});
    const from = document.querySelector('#coach-add-dates-modal input[type="date"], .co-add-from'), inputs = [...document.querySelectorAll('input[type="date"]')].filter(i => i.offsetParent !== null);
    if (inputs.length < 2) return { skipped: true, n: inputs.length };
    const t0 = performance.now();
    inputs[0].value = new Date(Date.now() + 86400e3).toISOString().slice(0, 10);
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1].value = '2099-12-31';
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    const ms = performance.now() - t0;
    const pv = document.querySelector('.co-add-preview, .co-preview') || [...document.querySelectorAll('div,p,span')].find(e => /一度に追加できるのは31日まで/.test(e.textContent) && e.children.length === 0);
    return { ms: Math.round(ms), msg: pv ? pv.textContent : '' };
  });
  chk('都合を聞く日の追加: 76年先までの範囲を入れても固まらず、31日までの案内が出る', cd.skipped ? false : (cd.ms < 500 && /31日まで/.test(cd.msg)), JSON.stringify(cd));
  await page.evaluate(() => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'));

  // 週末の段取り: 古い読み込みが新しい週を上書きしない
  const wk = await page.evaluate(async () => {
    const W = FCOjima.Hub.Weekend; if (!document.getElementById('weekend-modal')) { await W.open(); }
    const orig = FCOjima.DB.loadEventData; let first = true;
    FCOjima.DB.loadEventData = function(id) { const p = orig.call(FCOjima.DB, id); if (first) { first = false; return new Promise(r => setTimeout(() => p.then(r), 600)); } return p; };
    const from0 = W._from;
    W._from = from0; const slow = W.load();           // 遅い読み込み（この週）
    W._from = (function(s, n) { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(from0, 14);
    await W.load();                                     // 速い読み込み（2週先）
    await slow;
    FCOjima.DB.loadEventData = orig;
    return { range: document.querySelector('#weekend-modal .wk-range').textContent, from: W._from };
  });
  chk('週末の段取り: 遅れて終わった古い週の読み込みが、新しい週の表示を上書きしない', /^\s*\d+\/\d+/.test(wk.range) && wk.range.indexOf(String(new Date(wk.from + 'T00:00:00').getMonth() + 1) + '/' + new Date(wk.from + 'T00:00:00').getDate()) === 0, JSON.stringify(wk));
  await page.evaluate(() => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'));

  // 会場: IDに細工があっても実行されず、ボタンが動く
  await put(`${T}/venues/${encodeURIComponent("x');window.__venueXss=1;//")}`, { name: '細工の会場', address: '' }).catch(() => {});
  const vx = await page.evaluate(async () => {
    FCOjima.Hub.venues = (FCOjima.Hub.venues || []).concat([{ id: "x');window.__venueXss=1;//", name: '細工の会場', address: '' }]);
    document.querySelector('.tablinks[onclick*="venues"]').click();
    FCOjima.Hub.Venues.renderVenueList();
    const card = [...document.querySelectorAll('.venue-card')].find(c => /細工の会場/.test(c.textContent));
    const hasOnclick = !!card.querySelector('[onclick]');
    const edit = card.querySelector('.venue-act-edit');
    if (edit) edit.click();
    await new Promise(r => setTimeout(r, 300));
    return { hasOnclick, xss: !!window.__venueXss, edit: !!edit };
  });
  chk('会場の一覧: ボタンは onclick を使わない（IDに細工があっても実行されない）', !vx.hasOnclick && !vx.xss && vx.edit, JSON.stringify(vx));
  await page.evaluate(() => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'));

  // 名簿: 学年・背番号に細工があっても実行されない
  const mx = await page.evaluate(async () => {
    FCOjima.Hub.members = FCOjima.Hub.members.concat([{ id: 'xss1', name: '細工 選手', role: 'player', grade: '<img src=x onerror=window.__memXss=1>', number: '<img src=x onerror=window.__memXss=2>' }]);
    document.querySelector('.tablinks[onclick*="members"]').click();
    FCOjima.Hub.Members.renderMembersList();
    FCOjima.Hub.Members.showMemberDetail('xss1');
    await new Promise(r => setTimeout(r, 400));
    return { xss: window.__memXss || 0, imgs: document.querySelectorAll('img[src="x"]').length };
  });
  chk('名簿: 学年・背番号に仕込んだHTMLが動かない', !mx.xss && mx.imgs === 0, JSON.stringify(mx));
  chk('管理者の画面でページエラーなし', errs.filter(e => !/favicon|manifest|net::ERR|404/.test(e)).length === 0, errs.join(' | ').slice(0, 300));
  await ctx.close();
}

// ---------- 車登録: 表記揺れで選手を運転者にできない ----------
{
  const ctx = await context({ email: 'dbg-admin@example.com', name: '管理 太郎', device: null });
  const page = await ctx.newPage();
  await page.goto(BASE + '/carpool/cars.html?event=' + EB);
  await page.waitForSelector('.cp-car', { timeout: 25000 });
  await page.waitForFunction(() => (FCOjima.Carpool.members || []).length > 0, null, { timeout: 15000 });
  const r = await page.evaluate(() => ({
    spaced: FCOjima.Carpool.CarProvision._cannotDriveReason('田中 太郎'),
    kana: FCOjima.Carpool.CarProvision._cannotDriveReason('田中　太郎'),
    mom: FCOjima.Carpool.CarProvision._cannotDriveReason('四年 母')
  }));
  chk('車の運転者: 「田中 太郎」「田中　太郎」でも選手（田中太郎）は運転者にできない。保護者はできる', /選手なので/.test(r.spaced) && /選手なので/.test(r.kana) && r.mom === '', JSON.stringify(r));
  await ctx.close();
}

// ---------- 添付ファイル: 予定の権限がない人には削除・追加を出さない ----------
{
  await put(`${T}/settings/permissions`, { parent: { events: false } });
  const { ctx, page } = await openHub('dbg-parent@example.com', '四年 母');
  const ro = await page.evaluate(async (EB) => {
    FCOjima.Auth.permissions = { parent: { events: false } };
    const el = document.createElement('div'); document.body.appendChild(el);
    const real = firebase.storage;
    // 添付が1つある一覧を模す
    firebase.storage = function() { return { ref: function() { return { listAll: async () => ({ items: [{ name: 'a.pdf', getDownloadURL: async () => 'https://example.com/a.pdf', delete: async () => {} }] }) }; } }; };
    await FCOjima.EventFiles.render(EB, el);
    const noDel = el.querySelectorAll('.event-file-delete').length;
    await FCOjima.EventFiles.render(EB, el, { readOnly: false });
    const withDel = el.querySelectorAll('.event-file-delete').length;
    firebase.storage = real;
    FCOjima.Hub.Calendar.showEventDetails(EB);
    await new Promise(r => setTimeout(r, 1200));
    const btn = document.getElementById('calendar-event-file-btn');
    return { noDel, withDel, btnHidden: !btn || btn.style.display === 'none' };
  }, EB);
  chk('添付: 予定の権限がない人には削除ボタン・追加ボタンを出さない（見るのはできる）', ro.noDel === 0 && ro.withDel === 1 && ro.btnHidden, JSON.stringify(ro));
  await ctx.close();
}

// ---------- ログのルール ----------
{
  const tok = async (email, name) => (await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=k', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postBody: 'id_token=' + encodeURIComponent(JSON.stringify({ sub: 'sub-' + email, email, email_verified: true, name })) + '&providerId=google.com', requestUri: 'http://127.0.0.1', returnSecureToken: true }) })).json();
  const p = await tok('dbg-parent@example.com', '四年 母');
  const w = async (id, data) => (await fetch(`${FS}/${T}/logs/${id}`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + p.idToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, fv(v)])) }) })).ok;
  const base = { datetime: new Date().toISOString(), type: 'events', action: 'イベント追加', details: '「x」', user: '四年 母' };
  chk('ログ: 画面が書く項目だけなら書ける', await w('lg-ok', base));
  chk('ログ: 関係のない項目・巨大な文字列は書けない', !(await w('lg-x1', { ...base, hack: 1 })) && !(await w('lg-x2', { ...base, details: 'x'.repeat(2500) })) && !(await w('lg-x3', { ...base, datetime: 2999 })));
}

// ---------- 承認待ちの人が開いたとき、前の人の端末データを消す ----------
{
  const tokUser = await (await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=k', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postBody: 'id_token=' + encodeURIComponent(JSON.stringify({ sub: 'sub-dbg-pend@example.com', email: 'dbg-pend@example.com', email_verified: true, name: '承認待ち' })) + '&providerId=google.com', requestUri: 'http://127.0.0.1', returnSecureToken: true }) })).json();
  await put(`${T}/users/${tokUser.localId}`, { name: '承認待ち', role: 'parent', status: 'pending', email: 'dbg-pend@example.com', childrenIds: [], childrenNames: [] });
  const ctx = await context({ email: 'dbg-pend@example.com', name: '承認待ち', device: null });
  await ctx.addInitScript(`if (!sessionStorage.getItem('dbg_seed')) { sessionStorage.setItem('dbg_seed', '1'); localStorage.setItem('fcojima_cache_uid', 'someone-else'); localStorage.setItem('fcojima_logs', '[{"id":"o","details":"前の人のログ"}]'); }`);
  const page = await ctx.newPage();
  await page.goto(BASE + '/hub/index.html');
  await page.waitForURL(/pending\.html/, { timeout: 20000 });
  const left = await page.evaluate(() => localStorage.getItem('fcojima_logs'));
  chk('承認待ちの人が開いても、前の人の端末データは消える', left === null, String(left));
  await ctx.close();
}
await closeBrowser();
process.exitCode = summary() ? 1 : 0;
