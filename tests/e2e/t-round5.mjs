// 5巡目の不具合の確認
import { put, get, list, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T } from './lib.mjs';
await wipe();
const EV = '1900000008001';
await put(`${T}/members/p1`, { name: '選手いち', role: 'player', grade: '3' });
await put(`${T}/members/p2`, { name: '選手に', role: 'player', grade: '3' });
await put(`${T}/members/p3`, { name: '選手さん', role: 'player', grade: '3' });
await put(`${T}/members/o1`, { name: '役員の母', role: 'officer', childrenIds: ['p1'] });
await put(`${T}/members/o2`, { name: '役員本人参加', role: 'officer' });
await put(`${T}/members/f1`, { name: '運転する父', role: 'father', childrenIds: ['p2'] });
await put(`${T}/events/${EV}`, { title: '親子イベント', date: '2026-11-23', type: 'event', target: [] });
await put(`${T}/eventData/${EV}`, {
  attendance: [
    { name: '選手いち', status: 'present', notes: '' },
    { name: '選手に', status: 'present', notes: '' },
    { name: '選手さん', status: 'present', notes: '' },
    { name: '役員本人参加', status: 'present', notes: '' },
    { name: '役員の母', status: 'unknown', notes: '' }
  ],
  carRegistrations: [{ parent: '運転する父', canDrive: 'both', frontSeat: 1, middleSeat: 2, backSeat: 0, notes: '', extraPassengers: [{ name: '弟くん' }] }]
});
await makeUser('r5admin@example.com', '管理者', 'admin');

const ctx = await context({ email: 'r5admin@example.com', name: '管理者' });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());
await page.goto(BASE + '/carpool/assignments.html?event=' + EV);
await page.waitForFunction(() => document.querySelector('.car-top-view'), null, { timeout: 25000 });
await page.waitForTimeout(600);

// 1) 役員（父・母以外の役割の保護者）も座席の候補に出る
const cands = await page.evaluate(() => FCOjima.Carpool.Assignment.getEventFilteredMembers().map(m => m.name));
chk('出欠で「参加」と答えた役員が座席の候補に出る', cands.includes('役員本人参加'), JSON.stringify(cands));
chk('子供が参加する役員の保護者も座席の候補に出る（父・母と同じ扱い）', cands.includes('役員の母'), JSON.stringify(cands));

// 2) ランダム割り当てでメンバー外乗員が席を追い出されない
const seated = await page.evaluate(() => {
  FCOjima.Carpool.Assignment.generateRandomAssignments();
  return [...document.querySelectorAll('.seat.filled')].map(s => s.dataset.person);
});
await page.evaluate(() => FCOjima.Carpool.whenSaved());
chk('ランダム割り当て後もメンバー外乗員（弟くん）が車に乗っている', seated.includes('弟くん'), JSON.stringify(seated));
const d = await get(`${T}/eventData/${EV}`);
const saved = JSON.stringify(d.assignments || []);
chk('保存された割り当てにもメンバー外乗員が含まれる', saved.includes('弟くん'), saved.slice(0, 200));
await ctx.close();

// 3) 出欠は選んだだけで保存される（「出欠を保存」の押し忘れで回答が消えない）
const ctx2 = await context({ email: 'r5admin@example.com', name: '管理者' });
const p2 = await ctx2.newPage();
await p2.goto(BASE + '/carpool/attendance.html?event=' + EV);
await p2.waitForFunction(() => document.querySelectorAll('.attendance-select').length > 0, null, { timeout: 25000 });
const row = p2.locator('#attendance-table tbody tr', { hasText: '役員の母' });
await row.locator('select').selectOption('absent');
await row.locator('input.attendance-notes').fill('仕事のため');
await row.locator('input.attendance-notes').blur();
await p2.evaluate(() => FCOjima.Carpool.whenSaved());
await p2.click('nav.carpool-nav a[href="index.html"]');
await p2.waitForTimeout(1500);
const d2 = await get(`${T}/eventData/${EV}`);
const it = (d2.attendance || []).find(a => a.name === '役員の母');
chk('出欠を選んで備考を書いただけで（保存ボタンを押さずに移動しても）保存される', it && it.status === 'absent' && it.notes === '仕事のため', JSON.stringify(it));
await ctx2.close();

// 4) 選んだ直後にタブで移動しても保存が途中で切れない（通信を遅くして確認）
await put(`${T}/eventData/${EV}`, { attendance: [{ name: '選手いち', status: 'unknown', notes: '' }, { name: '選手に', status: 'unknown', notes: '' }, { name: '選手さん', status: 'unknown', notes: '' }] });
const ctx3 = await context({ email: 'r5admin@example.com', name: '管理者' });
const p3 = await ctx3.newPage();
await p3.goto(BASE + '/carpool/attendance.html?event=' + EV);
await p3.waitForFunction(() => document.querySelectorAll('.attendance-select').length > 0, null, { timeout: 25000 });
// Firestoreへの書き込み通信を1.5秒遅らせる
await p3.route('**/google.firestore.v1.Firestore/**', async r => { await new Promise(x => setTimeout(x, 1500)); r.continue(); });
await p3.route('**/documents:commit**', async r => { await new Promise(x => setTimeout(x, 1500)); r.continue(); });
const row3 = p3.locator('#attendance-table tbody tr', { hasText: '選手さん' });
await row3.locator('select').selectOption('present');
await p3.click('nav.carpool-nav a[href="cars.html"]');
await p3.waitForURL(/cars\.html/, { timeout: 20000 });
await p3.waitForTimeout(1500);
const d3 = await get(`${T}/eventData/${EV}`);
const it3 = (d3.attendance || []).find(a => a.name === '選手さん');
chk('出欠を選んだ直後に上のタブで移動しても保存される', it3 && it3.status === 'present', JSON.stringify(it3));
await ctx3.close();

// 5) メンバー外乗員: 席をタップして名前を入れて乗せると、その席で登録される
const ctx4 = await context({ email: 'r5admin@example.com', name: '管理者' });
const p4 = await ctx4.newPage();
p4.on('dialog', d => d.accept());
await p4.goto(BASE + '/carpool/cars.html?event=' + EV);
await p4.waitForFunction(() => document.querySelector('#cp-car .cp-seat') && FCOjima.Carpool._base, null, { timeout: 25000 });
await p4.fill('#parentName', '別の運転手');
await p4.click('.cp-seat[data-seat-type="中列"][data-seat-index="0"]');
await p4.fill('#cp-seat-other-name', '妹ちゃん');
await p4.click('#cp-seat-other-add');
await p4.click('#register-car');
await p4.evaluate(() => FCOjima.Carpool.whenSaved());
const d4 = await get(`${T}/eventData/${EV}`);
const car4 = (d4.carRegistrations || []).find(c => c.parent === '別の運転手');
chk('席をタップしてメンバー外乗員を乗せると、その席で登録される', car4 && JSON.stringify(car4.extraPassengers) === JSON.stringify([{ name: '妹ちゃん', seatType: '中列', seatIndex: 0 }]), JSON.stringify(car4));
await ctx4.close();

// 6) 割り当てページの見出しに予定名が出る／配車の連絡は投稿者・管理者だけ削除ボタン
await put(`${T}/eventData/${EV}`, { notifications: [
  { date: '2026-10-16', text: '他の人の連絡', type: 'info', user: '監督' },
  { date: '2026-10-16', text: '自分の連絡', type: 'info', user: '保護者さん' }
] });
await makeUser('r5parent@example.com', '保護者さん', 'parent');
const ctx5 = await context({ email: 'r5parent@example.com', name: '保護者さん' });
const p5 = await ctx5.newPage();
await p5.goto(BASE + '/carpool/assignments.html?event=' + EV);
await p5.waitForFunction(() => document.querySelector('#assignment-event-info strong'), null, { timeout: 25000 });
await p5.waitForTimeout(500);
const head = await p5.evaluate(() => document.getElementById('event-header').textContent);
chk('割り当てページの見出しに「日付 予定名」が出る（他の配車ページと同じ）', /親子イベント/.test(head), head);
await p5.goto(BASE + '/carpool/notifications.html?event=' + EV);
await p5.waitForFunction(() => document.querySelectorAll('.notification-card').length >= 2, null, { timeout: 25000 });
const del = await p5.evaluate(() => [...document.querySelectorAll('.notification-card')].map(c => ({ t: c.querySelector('.notification-content').textContent, del: !!c.querySelector('.delete-button') })));
const other = del.find(x => x.t === '他の人の連絡'), mine = del.find(x => x.t === '自分の連絡');
chk('配車の連絡で、保護者には他の人の連絡の削除ボタンが出ない（自分の連絡は消せる）', other && !other.del && mine && mine.del, JSON.stringify(del));
await ctx5.close();

await closeBrowser();
process.exit(summary() ? 1 : 0);
