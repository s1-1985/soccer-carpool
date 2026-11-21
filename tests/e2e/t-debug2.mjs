// デバッグの指示書（第2弾）と判断の反映: eventData の削除は予定の権限がある人だけ（出欠などの編集は全員）・
// 添付は予定ごとの場所だけ・保存に失敗したままページを移るときの確認・欠席の人を運転手に新しく選べない・
// ログイン画面の WebView 判定・運転統計は今日まで・承認の確認に同名の警告
import { put, get, list, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, FS, fv } from './lib.mjs';
await wipe();
const jst = new Date(Date.now() + 9 * 3600e3);
const iso = d => d.toISOString().slice(0, 10);
const D = iso(new Date(jst.getTime() + 2 * 86400e3));
const E1 = '1900001200001';
await put(`${T}/members/p1`, { name: '田中 太郎', role: 'player', grade: '4' });
await put(`${T}/members/c1`, { name: '欠席 コーチ', role: 'assist' });
await put(`${T}/members/c2`, { name: '参加 コーチ', role: 'assist' });
await put(`${T}/events/${E1}`, { title: '練習試合', date: D, type: 'game', target: ['4'] });
await put(`${T}/eventData/${E1}`, { attendance: [{ name: '欠席 コーチ', status: 'absent' }, { name: '参加 コーチ', status: 'present' }],
  carRegistrations: [{ parent: '参加 コーチ', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 0, extraPassengers: [] }] });
await makeUser('dbg2-admin@example.com', '管理 太郎', 'admin');
const tok = async (email, name) => (await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=k', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postBody: 'id_token=' + encodeURIComponent(JSON.stringify({ sub: 'sub-' + email, email, email_verified: true, name })) + '&providerId=google.com', requestUri: 'http://127.0.0.1', returnSecureToken: true }) })).json();
const pj = await tok('dbg2-parent@example.com', '保護者 一');
await put(`${T}/users/${pj.localId}`, { name: '保護者 一', role: 'parent', status: 'approved', email: 'dbg2-parent@example.com', childrenIds: ['p1'] });
const aj = await tok('dbg2-admin@example.com', '管理 太郎');

// ---------- ルール ----------
const doc = (who, p, method, data) => fetch(`${FS}/${p}` + (data && method === 'PATCH' ? '?' + Object.keys(data).map(k => 'updateMask.fieldPaths=' + k).join('&') : ''), { method, headers: { Authorization: 'Bearer ' + who.idToken, 'Content-Type': 'application/json' }, body: data ? JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, fv(v)])) }) : undefined }).then(r => r.ok);
chk('eventData: 保護者も出欠などは書ける（みんなで編集）', await doc(pj, `${T}/eventData/${E1}`, 'PATCH', { comment: 'よろしく' }));
// 初期値では保護者にも「予定」の権限がある（予定の追加・編集・削除は全員。設計どおり）。権限を外した状態で確かめる
await put(`${T}/settings/permissions`, { parent: { events: false } });
await new Promise(r => setTimeout(r, 1500));
chk('eventData: 予定の権限がない保護者は、予定のデータを丸ごと消せない', !(await doc(pj, `${T}/eventData/${E1}`, 'DELETE')) && !!(await get(`${T}/eventData/${E1}`)));
chk('eventData: 予定の権限がある人（管理者）は消せる', await doc(aj, `${T}/eventData/${E1}`, 'DELETE') && !(await get(`${T}/eventData/${E1}`)));
await put(`${T}/eventData/${E1}`, { attendance: [{ name: '欠席 コーチ', status: 'absent' }, { name: '参加 コーチ', status: 'present' }],
  carRegistrations: [{ parent: '参加 コーチ', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 0, extraPassengers: [] }] });
const ST = `http://127.0.0.1:9199/v0/b/fc-ojimajr-hub.firebasestorage.app/o`;
const up = (who, path) => fetch(`${ST}?name=${encodeURIComponent(path)}`, { method: 'POST', headers: { Authorization: 'Bearer ' + who.idToken, 'Content-Type': 'text/plain' }, body: 'x' }).then(r => r.status);
chk('添付: 予定ごとの場所には置ける。それ以外の場所には置けない', await up(pj, `teams/fc-ojima/events/${E1}/a.txt`) === 200 && await up(pj, `teams/fc-ojima/other/a.txt`) === 403 && await up(pj, `teams/fc-ojima/a.txt`) === 403);

// ---------- 画面 ----------
{
  const ctx = await context({ email: 'dbg2-admin@example.com', name: '管理 太郎', device: null });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  await page.goto(BASE + '/carpool/assignments.html?event=' + E1);
  await page.waitForSelector('.car-top-view', { timeout: 25000 });
  await page.waitForTimeout(800);
  const dr = await page.evaluate(() => {
    FCOjima.Carpool.Assignment.editCarDriver(0);
    return [...document.querySelectorAll('#driver-modal-list > *')].map(b => b.textContent);
  });
  chk('運転手を選ぶ画面: 不参加の人（欠席 コーチ）は出ない。参加の人は出る', !dr.some(t => /欠席 コーチ/.test(t)) && dr.some(t => /参加 コーチ/.test(t)), JSON.stringify(dr));
  // 保存に失敗したままページを移るときは確認する
  const lv = await page.evaluate(async () => {
    const C = FCOjima.Carpool; let asked = 0;
    const oc = window.confirm; window.confirm = () => { asked++; return false; };
    C._saveFailed = true; const r1 = await C.confirmLeave();
    C._saveFailed = false; const r2 = await C.confirmLeave();
    window.confirm = oc;
    return { r1, r2, asked };
  });
  chk('ページを移るとき: 保存に失敗していれば確認し（キャンセルなら残る）、失敗していなければそのまま移る', lv.r1 === false && lv.r2 === true && lv.asked === 1, JSON.stringify(lv));
  await ctx.close();
}
{
  const ctx = await context({ email: 'dbg2-admin@example.com', name: '管理 太郎', device: null });
  const page = await ctx.newPage();
  await page.goto(BASE + '/hub/login.html');
  await page.waitForTimeout(500);
  const ua = await page.evaluate(() => {
    const re = (ua) => /Line\/|FBAN|FBAV|Instagram|Twitter|Snapchat|MicroMessenger/i.test(ua) || (/Android/.test(ua) && /; wv\)/.test(ua));
    return { wv: re('Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36'), chrome: re('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36') };
  });
  const src = await (await fetch(BASE + '/hub/login.html')).text();
  chk('ログイン画面: Android の WebView（; wv）を検出する。ふつうの Chrome は検出しない（式そのものを確かめる）', ua.wv && !ua.chrome && /Android\/\.test\(ua\) && \/; wv\\\)\/\.test\(ua\)/.test(src), JSON.stringify(ua));
  await ctx.close();
}
await closeBrowser();
process.exitCode = summary() ? 1 : 0;
