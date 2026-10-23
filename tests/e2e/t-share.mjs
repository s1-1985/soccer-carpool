// 共有リンク（?event=ID）・ログイン後の戻り先・車両削除後の座席対応・承認待ちユーザー
import { put, get, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors, put as putDoc } from './lib.mjs';

const EV = '1900000000801';
await put(`${T}/members/a1`, { name: 'あおい', role: 'player', grade: '4' });
await put(`${T}/members/b1`, { name: 'ばんり', role: 'player', grade: '4' });
await put(`${T}/members/c1`, { name: 'ちひろ', role: 'player', grade: '4' });
// 運転手を替える先（運転席に座れるのは監督・コーチ・保護者など。2026-10-22 から選手や知らない名前は運転手にできない）
await put(`${T}/members/d1`, { name: 'D父', role: 'father' });
await put(`${T}/events/${EV}`, { title: '最新タイトル', date: '2026-11-03', type: 'game', target: ['4'], venue: '尾島グラウンド', startTime: '08:00' });
await put(`${T}/eventData/${EV}`, {
  carRegistrations: [
    { parent: 'A父', canDrive: 'both', frontSeat: 1, middleSeat: 2, backSeat: 0, notes: '' },
    { parent: 'B母', canDrive: 'both', frontSeat: 1, middleSeat: 2, backSeat: 0, notes: '' },
    { parent: 'C父', canDrive: 'both', frontSeat: 1, middleSeat: 2, backSeat: 0, notes: '' }
  ],
  attendance: ['あおい', 'ばんり', 'ちひろ'].map(n => ({ name: n, status: 'present', notes: '' })),
  assignments: [
    { carIndex: 0, driver: 'A父', seats: { '助手席': { '0': 'あおい' }, '中列': {}, '後列': {} } },
    { carIndex: 1, driver: 'B母', seats: { '助手席': { '0': 'ばんり' }, '中列': {}, '後列': {} } },
    { carIndex: 2, driver: 'C父', seats: { '助手席': { '0': 'ちひろ' }, '中列': {}, '後列': {} } }
  ]
});
const uid = await makeUser('share@example.com', '共有テスト', 'parent');

// 1) 未ログインで共有リンクを開く → ログイン → 元のページ（イベント付き）に戻る
{
  const ctx = await context({});
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  await page.goto(BASE + '/carpool/attendance.html?event=' + EV);
  await page.waitForURL(/hub\/login\.html/, { timeout: 20000 });
  await page.waitForFunction(() => window.FCOjimaFirebase && window.FCOjimaFirebase.auth);
  const t = JSON.stringify({ sub: 'sub-share@example.com', email: 'share@example.com', email_verified: true, name: '共有テスト' });
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=k', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postBody: 'id_token=' + encodeURIComponent(t) + '&providerId=google.com', requestUri: 'http://127.0.0.1', returnSecureToken: true }) });
  const tok = await r.json();
  await page.evaluate(async (idToken) => {
    await window.FCOjimaFirebase.auth.signInWithCredential(window.firebase.auth.GoogleAuthProvider.credential(idToken));
  }, tok.idToken);
  await page.waitForURL(/carpool\/attendance\.html\?event=/, { timeout: 20000 });
  chk('ログイン後に共有リンクのページ（イベントID付き）へ戻る', page.url().includes('event=' + EV), page.url());
  await page.waitForFunction(() => document.querySelectorAll('.attendance-select').length > 0, null, { timeout: 20000 });
  const info = await page.textContent('#attendance-event-info');
  chk('別の端末で開いた共有リンクでもイベントが表示される', info.includes('最新タイトル'), info.trim());
  console.log('errors1:', JSON.stringify(errs.slice(0, 5)));
  await ctx.close();
}

// 2) HUBで選んだ後にイベントが編集された → 最新の内容を表示
{
  const stale = { id: EV, title: '古いタイトル', date: '2026-11-03', type: 'game', target: ['4'] };
  const ctx = await context({ email: 'share@example.com', name: '共有テスト', selectedEvent: stale });
  const page = await ctx.newPage();
  await page.goto(BASE + '/carpool/attendance.html');
  await page.waitForFunction(() => document.querySelectorAll('.attendance-select').length > 0, null, { timeout: 20000 });
  const info = await page.textContent('#attendance-event-info');
  chk('配車管理はFirestoreの最新のイベント内容を表示する', info.includes('最新タイトル'), info.trim());
  const shareUrl = await page.evaluate(() => FCOjima.Carpool.pageUrl('attendance.html'));
  chk('共有用URLにイベントIDが付く（LINE で押すと Safari・Chrome で開く）', shareUrl.endsWith('/carpool/attendance.html?event=' + EV + '&openExternalBrowser=1'), shareUrl);

  // 3) 車提供ページで先頭の車（A父）を削除 → 割り当て画面でB母・C父の乗員がずれない
  page.on('dialog', d => d.accept());
  await page.goto(BASE + '/carpool/cars.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Carpool && FCOjima.Carpool._base, null, { timeout: 20000 });
  await page.evaluate(() => FCOjima.Carpool.CarProvision.deleteCarRegistration(0));
  await page.evaluate(() => FCOjima.Carpool.whenSaved());
  await page.goto(BASE + '/carpool/assignments.html');
  await page.waitForFunction(() => document.querySelectorAll('.car-layout').length === 2, null, { timeout: 20000 });
  const cars = await page.evaluate(() => [...document.querySelectorAll('.car-layout')].map(cl => ({
    driver: cl.querySelector('.driver-seat').dataset.person,
    front: (cl.querySelector('.seat[data-seat-type="助手席"]') || {}).dataset ? cl.querySelector('.seat[data-seat-type="助手席"]').dataset.person : null
  })));
  chk('先頭の車を削除しても、B母の車にはばんり・C父の車にはちひろが乗ったまま', cars[0].driver === 'B母' && cars[0].front === 'ばんり' && cars[1].driver === 'C父' && cars[1].front === 'ちひろ', JSON.stringify(cars));

  // 4) 運転手変更 → 保存した割り当ての運転手名も更新され、再読み込み後も乗員が残る
  await page.evaluate(() => FCOjima.Carpool.Assignment._applyDriverChange(0, 'D父'));
  await page.evaluate(() => FCOjima.Carpool.whenSaved());
  const d = await get(`${T}/eventData/${EV}`);
  chk('運転手変更が割り当ての運転手名にも保存される', d.assignments.some(a => a.driver === 'D父' && a.seats['助手席']['0'] === 'ばんり'), JSON.stringify(d.assignments));
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.car-layout').length === 2, null, { timeout: 20000 });
  const front0 = await page.evaluate(() => document.querySelector('.car-layout .seat[data-seat-type="助手席"]').dataset.person);
  chk('運転手変更後に再読み込みしても乗員が残る', front0 === 'ばんり', String(front0));
  await ctx.close();
}

// 5) 承認待ちユーザーが配車管理ページを開く → 承認待ちページへ（エラーで止まらない）
{
  await makeUser('pending@example.com', '承認待ち', 'parent');
  const tok = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=k', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postBody: 'id_token=' + encodeURIComponent(JSON.stringify({ sub: 'sub-pending@example.com', email: 'pending@example.com', email_verified: true, name: '承認待ち' })) + '&providerId=google.com', requestUri: 'http://127.0.0.1', returnSecureToken: true }) }).then(r => r.json());
  await putDoc(`${T}/users/${tok.localId}`, { name: '承認待ち', role: 'parent', status: 'pending', email: 'pending@example.com' });
  const ctx = await context({ email: 'pending@example.com', name: '承認待ち' });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  await page.goto(BASE + '/carpool/attendance.html?event=' + EV);
  await page.waitForURL(/hub\/pending\.html/, { timeout: 20000 });
  chk('承認待ちユーザーは承認待ちページへ移動する', page.url().includes('pending.html'));
  const bad = errs.filter(e => /TypeError|Cannot read/.test(e));
  chk('承認待ちユーザーで配車管理の初期化エラーが出ない', bad.length === 0, JSON.stringify(bad.slice(0, 3)));
  await ctx.close();
}

await closeBrowser();
process.exit(summary() ? 1 : 0);
