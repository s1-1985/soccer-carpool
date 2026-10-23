// ブラッシュアップ用: 直近の画面をスマホ幅で撮る（検証ではなく観察用）
import fs from 'fs';
import { put, wipe, makeUser, context, closeBrowser, BASE, T } from './lib.mjs';
const OUT = process.argv[2] || 'polish';
fs.mkdirSync(OUT, { recursive: true });
await wipe();
const jst = new Date(Date.now() + 9 * 3600e3);
const iso = d => d.toISOString().slice(0, 10);
const plus = n => { const x = new Date(jst); x.setUTCDate(x.getUTCDate() + n); return iso(x); };
const D1 = plus(1), D2 = plus(2), D5 = plus(5), D9 = plus(9);
const kids = [['p31', '小川 悠真', '3'], ['p32', '加藤 樹', '3'], ['p33', '木村 大和', '3'], ['p41', '工藤 颯', '4'], ['p42', '小林 律', '4'], ['p11', '青木 蓮', '1'], ['p12', '小川 結衣', '1']];
for (const [id, name, grade] of kids) await put(`${T}/members/${id}`, { name, role: 'player', grade });
await put(`${T}/members/f31`, { name: '小川 恵', role: 'mother', childrenIds: ['p31', 'p12'] });
await put(`${T}/members/f32`, { name: '加藤 健一', role: 'father', childrenIds: ['p32'] });
await put(`${T}/members/f41`, { name: '工藤 さおり', role: 'mother', childrenIds: ['p41'] });
await put(`${T}/members/c1`, { name: '佐藤 監督', role: 'coach', abbr: '佐藤' });
await put(`${T}/members/c2`, { name: '鈴木 コーチ', role: 'assist', abbr: '鈴木' });
await put(`${T}/members/c3`, { name: '高橋 コーチ', role: 'assist', abbr: '高橋', kana: 'タカハシ ユウキ' });
await put(`${T}/venues/v1`, { name: '笠懸球技場', address: '群馬県みどり市笠懸町' });
const E1 = '1900000600001', E2 = '1900000600002', E3 = '1900000600003', E4 = '1900000600004';
await put(`${T}/events/${E1}`, { title: '笠懸カップ', date: D1, type: 'game', target: ['3', '4'], startTime: '09:00', endTime: '15:00', departureTime: '07:30', venue: '笠懸球技場', attendanceDeadline: D1 + 'T07:00' });
await put(`${T}/events/${E2}`, { title: '練習', date: D2, type: 'practice', target: ['1', '3', '4'], startTime: '09:00', endTime: '12:00', venue: '尾島小学校' });
await put(`${T}/events/${E3}`, { title: '低学年交流会', date: D5, type: 'event', target: ['1'], startTime: '10:00' });
await put(`${T}/events/${E4}`, { title: '県大会 1回戦', date: D9, type: 'game', target: ['3', '4'], startTime: '10:00' });
await put(`${T}/eventData/${E1}`, {
  attendance: [{ name: '工藤 颯', status: 'present', notes: '' }, { name: '加藤 樹', status: 'absent', notes: '' }, { name: '小川 悠真', status: 'present', notes: '' }],
  carRegistrations: [{ parent: '工藤 さおり', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 0, notes: '', extraPassengers: [] }],
  assignments: [{ carIndex: 0, driver: '工藤 さおり', seats: { '助手席': { 0: '工藤 颯' }, '中列': { 0: '小川 悠真' }, '後列': {} } }],
  notifications: [{ date: plus(0), text: '集合は7時半に尾島小学校の正門前です。雨天でも実施します。', type: 'info', user: '佐藤 監督' }]
});
await put(`${T}/coachAssignments/${E1}`, { memberIds: ['c2'] });
await put(`${T}/notifications/n1`, { date: plus(0).replace(/-/g, '/') + ' 08:00', text: '今月の会費の集金は第4土曜日です。', user: '佐藤 監督' });
await makeUser('kantoku@example.com', '佐藤 監督', 'coach');
await makeUser('ogawa@example.com', '小川 恵', 'parent', { childrenIds: ['p31', 'p12'] });
// 承認待ち（コーチとして申請）
{
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=k', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postBody: 'id_token=' + encodeURIComponent(JSON.stringify({ sub: 'sub-tk', email: 'tk@example.com', email_verified: true, name: '高橋 祐樹' })) + '&providerId=google.com', requestUri: 'http://127.0.0.1', returnSecureToken: true }) });
  const j = await r.json();
  await put(`${T}/users/${j.localId}`, { name: '高橋 祐樹', kana: 'タカハシ ユウキ', requestedRole: 'coach', email: 'tk@example.com', role: 'parent', status: 'pending', childrenIds: [], childrenNames: [] });
}
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const shot = async (page, name, full = false) => { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); console.log('shot', name); };
const ready = async (page) => {
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(2000);
};

// 保護者
{
  const ctx = await context({ email: 'ogawa@example.com', name: '小川 恵', device: phone });
  const page = await ctx.newPage();
  await ready(page);
  await shot(page, 'p1-top');
  await shot(page, 'p2-top-full', true);
  await page.tap('#my-events-tab');
  await page.waitForTimeout(1000);
  await shot(page, 'p3-myevents', true);
  await page.evaluate(id => FCOjima.Hub.Calendar.showEventDetails(id), E1);
  await page.waitForSelector('.ed-head', { timeout: 8000 });
  await page.waitForTimeout(800);
  await shot(page, 'p4-detail');
  await page.evaluate(() => document.querySelector('#event-details-modal .modal-content').scrollTop = 600);
  await shot(page, 'p4b-detail-scrolled');
  await page.evaluate(() => FCOjima.UI.closeModal('event-details-modal'));
  await page.tap('#notifications-tab');
  await page.waitForTimeout(1500);
  await shot(page, 'p5-notices', true);
  await page.tap('#defaultTab');
  await page.waitForTimeout(800);
  await page.tap('#list-view');
  await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById('list-view').scrollIntoView());
  await shot(page, 'p6-list');
  await page.goto(BASE + '/carpool/attendance.html?event=' + E2);
  await page.waitForTimeout(3000);
  await shot(page, 'p7-attendance');
  await page.goto(BASE + '/carpool/index.html?event=' + E1);
  await page.waitForTimeout(3000);
  await shot(page, 'p8-overview', true);
  await ctx.close();
}
// iPhone のブラウザ（ホーム画面に追加）
{
  const ctx = await context({ email: 'ogawa@example.com', name: '小川 恵', device: 'iPhone 13' });
  const page = await ctx.newPage();
  await ready(page);
  await shot(page, 'p9-iphone-top');
  await ctx.close();
}
// 監督
{
  const ctx = await context({ email: 'kantoku@example.com', name: '佐藤 監督', device: phone });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  await ready(page);
  await shot(page, 'm1-top');
  await shot(page, 'm1b-top-full', true);
  await page.evaluate(() => document.getElementById('admin-tab').click());
  await page.waitForSelector('#pending-users-list .approve-btn', { timeout: 10000 });
  await shot(page, 'm2-admin');
  await page.tap('#pending-users-list .approve-btn');
  await page.waitForSelector('#approved-notice-modal .approved-notice-text', { state: 'visible', timeout: 8000 });
  await shot(page, 'm3-approved');
  await ctx.close();
}
// 新しい人
{
  const ctx = await context({ email: 'newp@example.com', name: '新井 さくら', device: phone });
  const page = await ctx.newPage();
  await page.goto(BASE + '/hub/index.html');
  await page.waitForURL(/register/, { timeout: 15000 });
  await page.waitForTimeout(800);
  await shot(page, 'n1-register', true);
  await page.fill('#reg-name', '新井 さくら');
  await page.fill('#reg-kana', 'アライ サクラ');
  await page.tap('button[type="submit"]');
  await page.waitForURL(/pending/, { timeout: 15000 });
  await shot(page, 'n2-pending');
  await ctx.close();
}
await closeBrowser();
