// 9巡目(b): 出欠ページの「参加者を追加」で学年外の選手を加えたとき
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T } from './lib.mjs';
await wipe();
await put(`${T}/members/p3`, { name: '三年さん', role: 'player', grade: '3' });
await put(`${T}/members/p2`, { name: '二年すけっと', role: 'player', grade: '2' });
await put(`${T}/members/f2`, { name: '二年の父', role: 'father', childrenIds: ['p2'] });
await put(`${T}/events/ad1`, { title: '三年の試合', date: '2026-12-19', type: 'game', target: ['3'] });
await put(`${T}/eventData/ad1`, { attendance: [{ name: '三年さん', status: 'present', notes: '' }],
  carRegistrations: [{ parent: '運転手', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 0, notes: '' }] });
await put(`${T}/events/ad2`, { title: '三年の行事', date: '2026-12-20', type: 'event', target: ['3'] });
await makeUser('r9b@example.com', '二年の父', 'admin', { childrenIds: ['p2'] });

const ctx = await context({ email: 'r9b@example.com', name: '二年の父', device: null });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());
await page.goto(BASE + '/carpool/attendance.html?event=ad1');
await page.waitForFunction(() => document.querySelectorAll('.attendance-select').length > 0, null, { timeout: 25000 });
// 参加者を追加（試合: 同じ日の他の予定・予定のない選手から）→ 二年すけっと を入れる（すぐ参加）
await page.click('#add-attendee');
await page.locator('#player-move-modal .pm-row', { hasText: '二年すけっと' }).locator('.pm-add').click();
await page.waitForFunction(() => FCOjima.PlayerMove._state && FCOjima.PlayerMove._state.moved.length === 1, null, { timeout: 10000 });
await page.click('#player-move-modal .close');
await page.waitForFunction(() => [...document.querySelectorAll('#attendance-table tbody tr')].some(r => /二年すけっと/.test(r.textContent)), null, { timeout: 10000 });
await page.evaluate(() => FCOjima.Carpool.whenSaved());
await page.waitForTimeout(800);
const row = await page.evaluate(() => { const r = [...document.querySelectorAll('#attendance-table tbody tr')].find(x => /二年すけっと/.test(x.textContent)); return r && r.querySelector('select').value; });
chk('出欠ページの「参加者を追加」で入れた学年外の選手は、出欠表に「参加」で出る', row === 'present', String(row));
const evDoc = await get(`${T}/events/ad1`);
chk('出欠ページで学年外の選手を参加者に加えると、予定の学年外追加にも入る（HUBの参加予定・出欠状況でも対象になる）', (evDoc.extraPlayers || []).includes('二年すけっと'), JSON.stringify(evDoc.extraPlayers));

// 座席割り当ての候補に出る
await page.goto(BASE + '/carpool/assignments.html?event=ad1');
await page.waitForFunction(() => document.querySelectorAll('.car-layout').length > 0, null, { timeout: 25000 });
await page.waitForTimeout(800);
const dock = await page.evaluate(() => [...document.querySelectorAll('#members-container .member-item')].map(e => e.dataset.name || e.textContent));
chk('出欠ページで加えて「参加」にした学年外の選手が、座席割り当ての候補に出る', dock.some(n => /二年すけっと/.test(n)), JSON.stringify(dock));

// HUBの参加予定に出る
await page.goto(BASE + '/hub/index.html');
await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
await page.waitForTimeout(1500);
await page.evaluate(() => FCOjima.Hub.MyEvents.renderList(false));
await page.waitForTimeout(800);
const me = await page.evaluate(() => document.getElementById('my-events-list').textContent);
chk('出欠ページで加えた学年外の選手の予定が、その保護者の「参加予定」に出る', /三年の試合/.test(me), me.slice(0, 100));

// 行事は従来のメンバーの一覧から加える（学年外の選手は予定の学年外追加にも入る）
await page.goto(BASE + '/carpool/attendance.html?event=ad2');
await page.waitForFunction(() => document.querySelectorAll('.attendance-select').length > 0 && FCOjima.Carpool._base, null, { timeout: 25000 });
await page.click('#add-attendee');
await page.locator('#member-select-list .list-item', { hasText: '二年すけっと' }).click();
await page.evaluate(() => FCOjima.Carpool.whenSaved());
await page.waitForTimeout(800);
const ev2 = await get(`${T}/events/ad2`);
chk('行事の「参加者を追加」は従来のメンバーの一覧で、学年外の選手は予定の学年外追加にも入る', (ev2.extraPlayers || []).includes('二年すけっと'), JSON.stringify(ev2.extraPlayers));
await ctx.close();
await closeBrowser();
process.exit(summary() ? 1 : 0);
