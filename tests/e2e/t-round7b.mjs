// 7巡目: メンバー名の変更が予定・出欠・配車に反映される
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T } from './lib.mjs';
await wipe();
await put(`${T}/members/k1`, { name: '高橋 翔', role: 'player', grade: '4', birth: '2016-05-05' });
await put(`${T}/members/f1`, { name: '高橋 父', role: 'father', childrenIds: ['k1'] });
await put(`${T}/events/u1`, { title: '先の試合', date: '2026-12-13', type: 'game', target: ['3'], extraPlayers: ['高橋 翔'] });
await put(`${T}/eventData/u1`, {
  attendance: [{ name: '高橋 翔', status: 'present', notes: '' }],
  carRegistrations: [{ parent: '高橋 父', canDrive: 'both', frontSeat: 1, middleSeat: 2, backSeat: 0 }],
  assignments: [{ carIndex: 0, driver: '高橋 父', seats: { '助手席': {}, '中列': { '0': '高橋 翔' }, '後列': {} } }]
});
await makeUser('r7b@example.com', '管理者', 'admin');
const ctx = await context({ email: 'r7b@example.com', name: '管理者', device: null });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());
await page.goto(BASE + '/hub/index.html');
await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
await page.waitForTimeout(800);
// 選手の名前の漢字を直す（髙）
await page.evaluate(() => { document.querySelector('.tablinks[onclick*="members"]').click(); FCOjima.Hub.Members.openAddMemberModal('k1'); });
await page.fill('#member-name', '髙橋 翔');
await page.click('#member-form button[type="submit"]');
// 父の名前も直す
await page.waitForTimeout(1500);
await page.evaluate(() => FCOjima.Hub.Members.openAddMemberModal('f1'));
await page.fill('#member-name', '髙橋 父');
await page.click('#member-form button[type="submit"]');
await page.waitForTimeout(3000);
const ev = await get(`${T}/events/u1`);
chk('名前を変えた選手が予定の学年外追加に残る', JSON.stringify(ev.extraPlayers) === '["髙橋 翔"]', JSON.stringify(ev.extraPlayers));
const d = await get(`${T}/eventData/u1`);
chk('名前を変えた選手の出欠（参加）がそのまま残る', d.attendance.length === 1 && d.attendance[0].name === '髙橋 翔' && d.attendance[0].status === 'present', JSON.stringify(d.attendance));
chk('名前を変えた保護者の車の登録・運転手がそのまま残る', d.carRegistrations[0].parent === '髙橋 父' && d.assignments[0].driver === '髙橋 父', JSON.stringify([d.carRegistrations[0].parent, d.assignments[0].driver]));
chk('名前を変えた選手の座席がそのまま残る', d.assignments[0].seats['中列']['0'] === '髙橋 翔', JSON.stringify(d.assignments[0].seats));
await ctx.close();
await closeBrowser();
process.exit(summary() ? 1 : 0);
