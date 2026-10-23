// 7巡目: 古い形式・欠けたデータが混ざっていても画面が壊れない
import { put, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors } from './lib.mjs';
await wipe();
await put(`${T}/members/p1`, { name: '選手いち', role: 'player', grade: '3' });
await put(`${T}/members/p2`, { name: '名前だけ' });                         // role なし
await put(`${T}/members/p3`, { role: 'player', grade: '2' });               // name なし
await put(`${T}/members/f1`, { name: '父', role: 'father', childrenIds: 'p1' }); // 配列でない
await put(`${T}/events/o1`, { title: '正常', date: '2026-11-15', type: 'game', target: ['3'] });
await put(`${T}/events/o2`, { date: '2026-11-15', type: 'practice' });     // title なし
await put(`${T}/events/o3`, { title: '日付なし', type: 'game' });           // date なし
await put(`${T}/events/o4`, { title: '対象が文字列', date: '2026-11-16', type: 'game', target: '3', extraPlayers: '選手いち' });
await put(`${T}/events/o5`, { title: '種別なし', date: '2026-11-17' });
await put(`${T}/eventData/o1`, { attendance: { a: 1 }, carRegistrations: null, assignments: 'x' });
await put(`${T}/eventData/o4`, { attendance: [{ name: '選手いち' }, null, { status: 'present' }], carRegistrations: [{ parent: '父' }, null] });
await put(`${T}/notifications/n1`, { text: '日付なし' });
await put(`${T}/notifications/n2`, { date: '2026/10/16 10:00' });
await put(`${T}/venues/v1`, { address: '住所だけ' });
await makeUser('odd@example.com', '管理者', 'admin', { childrenIds: ['p1'] });

const ctx = await context({ email: 'odd@example.com', name: '管理者' });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());
const errs = watchErrors(page);
await page.goto(BASE + '/hub/index.html');
await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
await page.waitForTimeout(1000);
await page.evaluate(() => { FCOjima.Hub.currentDate = new Date(2026, 10, 1); FCOjima.Hub.Calendar.renderCalendar(); FCOjima.Hub.Calendar.renderEventsList(); });
for (const tab of ['calendar', 'my-events', 'notifications', 'members', 'venues', 'admin']) {
  await page.evaluate((t) => { const b = document.querySelector(`.tablinks[onclick*="'${t}'"]`); if (b && b.offsetParent) b.click(); }, tab);
  await page.waitForTimeout(400);
}
for (const id of ['o1', 'o2', 'o3', 'o4', 'o5']) {
  await page.evaluate((id) => FCOjima.Hub.Calendar.showEventDetails(id), id).catch(e => errs.push('detail ' + id + ': ' + e.message));
  await page.waitForTimeout(400);
}
await page.evaluate(() => { document.getElementById('btn-attendance-matrix').click(); });
await page.waitForTimeout(1500);
await page.evaluate(() => { FCOjima.UI.closeModal('attendance-matrix-modal'); document.getElementById('btn-attendance-rate').click(); });
await page.waitForTimeout(1200);
await page.evaluate(() => { FCOjima.UI.closeModal('attendance-rate-modal'); document.getElementById('btn-driver-stats').click(); });
await page.waitForTimeout(1200);
const hubErrs = errs.filter(e => !/404|Failed to load resource/.test(e));
chk('欠けた・古い形式のデータが混ざっていてもHUBの画面でエラーが出ない', hubErrs.length === 0, hubErrs.join(' | ').slice(0, 400));
const mx = await page.evaluate(() => document.getElementById('driver-stats-container').textContent.slice(0, 60));
for (const id of ['o1', 'o4']) {
  const before = errs.length;
  for (const pg of ['index', 'attendance', 'cars', 'assignments', 'notifications']) {
    await page.goto(BASE + `/carpool/${pg}.html?event=${id}`);
    await page.waitForTimeout(2000);
  }
  const ce = errs.slice(before).filter(e => !/404|Failed to load resource/.test(e));
  chk(`欠けた・古い形式の出欠/配車データ（${id}）でも配車管理の画面でエラーが出ない`, ce.length === 0, ce.join(' | ').slice(0, 400));
}
await ctx.close();
await closeBrowser();
process.exit(summary() ? 1 : 0);
