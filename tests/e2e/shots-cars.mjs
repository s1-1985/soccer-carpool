// 観察用: 車の絵・参加予定の車の提供・出欠の編集をスマホ幅で撮る（検証ではない）  使い方: node shots-cars.mjs 出力先
import fs from 'fs';
import { put, wipe, makeUser, context, closeBrowser, BASE, T } from './lib.mjs';
const OUT = process.argv[2] || 'shots-cars';
fs.mkdirSync(OUT, { recursive: true });
await wipe();
const jst = new Date(Date.now() + 9 * 3600e3);
const iso = d => d.toISOString().slice(0, 10);
const D1 = iso(new Date(jst.getTime() + 86400e3));
const kids = [['p31', '小川 悠真', '3'], ['p32', '加藤 樹', '3'], ['p33', '木村 大和', '3'], ['p41', '工藤 颯', '4'], ['p42', '小林 律', '4']];
for (const [id, name, grade] of kids) await put(`${T}/members/${id}`, { name, role: 'player', grade });
await put(`${T}/members/f31`, { name: '小川 恵', role: 'mother', childrenIds: ['p31'] });
await put(`${T}/members/f41`, { name: '工藤 さおり', role: 'mother', childrenIds: ['p41'] });
const E1 = '1900000800001';
await put(`${T}/events/${E1}`, { title: '笠懸カップ', date: D1, type: 'game', target: ['3', '4'], startTime: '09:00', venue: '笠懸球技場' });
await put(`${T}/eventData/${E1}`, {
  attendance: [{ name: '工藤 颯', status: 'present', notes: '' }, { name: '加藤 樹', status: 'absent', notes: '' }, { name: '小川 悠真', status: 'present', notes: '' }],
  carRegistrations: [
    { parent: '工藤 さおり', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 0, notes: '', extraPassengers: [] },
    { parent: '木村 勇', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 3, notes: '', extraPassengers: [] }
  ],
  assignments: [{ carIndex: 0, driver: '工藤 さおり', seats: { '助手席': { 0: '工藤 颯' }, '中列': { 0: '小川 悠真' }, '後列': {} } }]
});
await makeUser('admin@example.com', '管理者', 'admin');
await makeUser('ogawa@example.com', '小川 恵', 'parent', { childrenIds: ['p31'] });

// 管理者: 座席割り当て・車提供
{
  const ctx = await context({ email: 'admin@example.com', name: '管理者' });
  const page = await ctx.newPage();
  const sel = { selectedEvent: { id: E1, title: '笠懸カップ', date: D1 } };
  await page.goto(BASE + '/carpool/assignments.html?event=' + E1);
  await page.waitForSelector('.car-top-view', { timeout: 25000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + '/assign.png', fullPage: false });
  await page.goto(BASE + '/carpool/cars.html?event=' + E1);
  await page.waitForSelector('.cp-car', { timeout: 25000 });
  await page.waitForTimeout(1200);
  await (await page.$('#cp-car')).screenshot({ path: OUT + '/seatmap.png' });
  await ctx.close();
}
// 保護者: 参加予定
{
  const ctx = await context({ email: 'ogawa@example.com', name: '小川 恵' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.getElementById('my-events-tab').click());
  await page.waitForSelector('.me-card', { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/myevents.png' });
  await page.evaluate((id) => FCOjima.Hub.Calendar.showEventDetails(id), E1);
  await page.waitForSelector('.ed-att-grid', { timeout: 10000 });
  await page.click('.ed-att[data-name="工藤 颯"]');
  await page.waitForTimeout(500);
  await (await page.$('.ed-attendance')).screenshot({ path: OUT + '/attedit.png' });
  await ctx.close();
}
await closeBrowser();
