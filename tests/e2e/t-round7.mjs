// 7巡目: モーダルの重なり など
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T } from './lib.mjs';
await wipe();
await put(`${T}/members/p1`, { name: '三年いち', role: 'player', grade: '3' });
await put(`${T}/events/m1`, { title: '午前の試合', date: '2026-12-06', type: 'game', target: ['3'] });
await put(`${T}/events/m2`, { title: '午後の試合', date: '2026-12-06', type: 'game', target: ['3'] });
await put(`${T}/eventData/m1`, { attendance: [{ name: '三年いち', status: 'present', notes: '' }] });
await put(`${T}/luggageSettings/main`, { items: ['テント'] });
await makeUser('r7@example.com', '管理者', 'admin');
const ctx = await context({ email: 'r7@example.com', name: '管理者' });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());
await page.goto(BASE + '/hub/index.html');
await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
await page.waitForTimeout(800);
// 見えている最前面のモーダルを返す
const topModal = () => page.evaluate(() => {
  const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
  const m = el && el.closest('.modal');
  return m ? m.id : null;
});

// 1) 予定フォーム → 荷物ピッカー
await page.evaluate(() => FCOjima.Hub.Calendar.openAddEventModal(new Date(2026, 11, 13)));
await page.evaluate(() => document.getElementById('event-luggage-btn').click());
await page.waitForTimeout(800);
chk('予定フォームから開いた「荷物」の選択画面が前面に出る', (await topModal()) === 'event-luggage-modal', await topModal());
await page.evaluate(() => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'));

// 2) 出欠状況（マトリクス）→ 参加イベント移動・イベント概要
await page.evaluate(() => { document.querySelector('.tablinks[onclick*="admin"]').click(); document.getElementById('btn-attendance-matrix').click(); });
await page.waitForFunction(() => document.querySelector('.attendance-matrix .mx-cell-movable'), null, { timeout: 15000 });
await page.evaluate(() => document.querySelector('.attendance-matrix .mx-cell-movable').click());
await page.waitForTimeout(500);
chk('出欠状況の表から開いた「参加イベントの移動」が前面に出る', (await topModal()) === 'matrix-move-modal', await topModal());
await page.evaluate(() => FCOjima.UI.closeModal('matrix-move-modal'));
await page.evaluate(() => document.querySelector('.attendance-matrix th.mx-evt').click());
await page.waitForTimeout(800);
chk('出欠状況の表の見出しから開いたイベント概要が前面に出る', (await topModal()) === 'event-detail-modal', await topModal());
await page.evaluate(() => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'));

// 3) 同じ名前のメンバー・会場
const dialogs = [];
page.removeAllListeners('dialog');
page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
await page.evaluate(() => { document.querySelector('.tablinks[onclick*="members"]').click(); FCOjima.Hub.Members.openAddMemberModal(); });
await page.fill('#member-name', '三年 いち');
await page.click('#member-form button[type="submit"]');
await page.waitForTimeout(800);
const cnt = (await (await import('./lib.mjs')).list(`${T}/members`)).length;
chk('同じ名前のメンバーを追加しようとすると確認が出て、取りやめられる', dialogs.some(m => /同じ名前/.test(m)) && cnt === 1, JSON.stringify({ dialogs, cnt }));
await page.evaluate(() => FCOjima.UI.closeModal('member-modal'));
await put(`${T}/venues/v1`, { name: '尾島グラウンド', address: '太田市' });
await page.reload();
await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
await page.waitForTimeout(800);
await page.evaluate(() => { document.querySelector('.tablinks[onclick*="venues"]').click(); FCOjima.Hub.Venues.openAddVenueModal(); });
await page.fill('#venue-name', '尾島グラウンド');
await page.click('#venue-form button[type="submit"]');
await page.waitForTimeout(800);
const vcnt = (await (await import('./lib.mjs')).list(`${T}/venues`)).length;
const toast = await page.evaluate(() => (document.querySelector('.toast-notification') || {}).textContent || '');
chk('同じ名前の会場は登録できない（予定から住所を引けなくなるため）', vcnt === 1 && /すでに登録/.test(toast), JSON.stringify({ vcnt, toast }));
await page.evaluate(() => FCOjima.UI.closeModal('venue-modal'));

// 4) 編集中に他の人が予定を削除した（同じ日の対象選手重複の確認はOKで進める）
page.removeAllListeners('dialog');
page.on('dialog', d => d.accept());
await page.evaluate(() => { document.querySelector('.tablinks[onclick*="calendar"]').click(); FCOjima.Hub.Calendar.editEvent('m2'); });
await (await import('./lib.mjs')).del(`${T}/events/m2`);
await page.waitForFunction(() => !FCOjima.Hub.events.some(e => String(e.id) === 'm2'), null, { timeout: 15000 });
await page.fill('#event-title', '午後の試合（変更）');
await page.click('#event-form button[type="submit"]');
await page.waitForTimeout(800);
const t2 = await page.evaluate(() => (document.querySelector('.toast-notification') || {}).textContent || '');
chk('編集中に他の人が削除した予定を保存すると「保存しました」ではなく削除された旨を表示', /削除/.test(t2) && !/保存しました/.test(t2), t2);
await ctx.close();

// 5) ログインに失敗したときの表示が日本語で、対処が分かる
const lctx = await context({});
const lp = await lctx.newPage();
await lp.goto(BASE + '/hub/login.html');
await lp.waitForFunction(() => window.FCOjimaFirebase && window.FCOjimaFirebase.auth);
const msg = await lp.evaluate(async () => {
  window.FCOjimaFirebase.auth.signInWithPopup = () => Promise.reject(Object.assign(new Error('Firebase: Error (auth/popup-closed-by-user).'), { code: 'auth/popup-closed-by-user' }));
  document.getElementById('google-signin-btn').click();
  await new Promise(r => setTimeout(r, 300));
  return document.getElementById('login-error').textContent;
});
chk('ログイン画面を閉じたときのエラーが英語のまま出ない', !/Firebase: Error/.test(msg) && /もう一度/.test(msg), msg);
await lctx.close();

await closeBrowser();
process.exit(summary() ? 1 : 0);
