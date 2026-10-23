// 5巡目: HUBの予定フォームまわり
import { put, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T } from './lib.mjs';
await wipe();
const A1 = 'a1-' + Date.now();
await put(`${T}/events/${A1}`, { title: '別の予定', date: '2026-11-30', type: 'game', target: [] });
await makeUser('r5b@example.com', '管理者', 'admin');
const ctx = await context({ email: 'r5b@example.com', name: '管理者', device: null });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());
await page.goto(BASE + '/hub/index.html');
await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
await page.waitForTimeout(800);
// 追加フォームでファイルを選んでキャンセル → 別の予定を編集して保存
await page.evaluate(() => FCOjima.Hub.Calendar.openAddEventModal(new Date(2026, 10, 20)));
await page.setInputFiles('#event-form-files', { name: '誤添付.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
await page.click('#cancel-event');
await page.evaluate((id) => FCOjima.Hub.Calendar.editEvent(id), A1);
await page.click('#event-form button[type="submit"]');
await page.waitForTimeout(2500);
const names = await page.evaluate((id) => FCOjima.EventFiles.listNames(id), A1);
chk('キャンセルしたフォームで選んだファイルが、次に編集した別の予定に添付されない', names.length === 0, JSON.stringify(names));
// 役員として登録された保護者の子供を設定できる
await put(`${T}/members/kid1`, { name: '役員の子', role: 'player', grade: '2' });
await put(`${T}/members/off1`, { name: '役員さん', role: 'officer' });
await page.reload();
await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
await page.waitForTimeout(800);
await page.evaluate(() => { document.querySelector('.tablinks[onclick*="members"]').click(); FCOjima.Hub.Members.openAddMemberModal('off1'); });
const shown = await page.evaluate(() => getComputedStyle(document.getElementById('children-group')).display !== 'none');
if (shown) {
  await page.evaluate(() => { const cb = [...document.querySelectorAll('#children-selector input')].find(c => c.closest('label').textContent.includes('役員の子')); cb.click(); });
  await page.click('#member-form button[type="submit"]');
  await page.waitForTimeout(1500);
}
const { get } = await import('./lib.mjs');
const off = await get(`${T}/members/off1`);
chk('役員として登録された保護者の子供をメンバー編集で設定できる', shown && JSON.stringify(off.childrenIds) === '["kid1"]', JSON.stringify({ shown, c: off.childrenIds }));
const card = await page.evaluate(() => { const c = document.querySelector('.member-card[data-member-id="off1"]'); return c ? c.textContent : ''; });
chk('役員の保護者のメンバーカードに子供が表示される', /子: 役員の子/.test(card), card);
await ctx.close();
await closeBrowser();
process.exit(summary() ? 1 : 0);
