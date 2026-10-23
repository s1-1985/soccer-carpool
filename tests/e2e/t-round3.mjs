// 3巡目の機能修正の確認
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T } from './lib.mjs';
await wipe();
const EV = '1900000006001';
await put(`${T}/members/a1`, { name: '三年いち', role: 'player', grade: '3' });
await put(`${T}/members/a2`, { name: '三年に', role: 'player', grade: '3' });
await put(`${T}/members/o1`, { name: '役員の親', role: 'officer', childrenIds: ['a1'] });
const event = { title: '3年の試合', date: '2026-11-08', type: 'game', target: ['3'], venue: '尾島', startTime: '09:00' };
await put(`${T}/events/${EV}`, event);
await put(`${T}/events/evp`, { title: '練習', date: '2026-11-08', type: 'practice', target: [] });
await put(`${T}/events/ev6`, { title: '6年だけ', date: '2026-11-09', type: 'game', target: ['6'] });
// 出欠表は「三年いち」だけで作成済み（その後「三年に」が入部した想定）。「三年さん」は手動で外した
await put(`${T}/members/a3`, { name: '三年さん', role: 'player', grade: '3' });
await put(`${T}/eventData/${EV}`, {
  attendance: [{ name: '三年いち', status: 'present', notes: '' }],
  attendanceRemoved: ['三年さん'],
  carRegistrations: [{ parent: '役員の親', canDrive: 'both', frontSeat: '1', middleSeat: '2', backSeat: '0', notes: '' }]
});
await makeUser('r3admin@example.com', '管理者', 'admin');

const ctx = await context({ email: 'r3admin@example.com', name: '管理者' });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());

// 1) 出欠表の自動補完
await page.goto(BASE + '/carpool/attendance.html?event=' + EV);
await page.waitForFunction(() => document.querySelectorAll('.attendance-select').length > 0, null, { timeout: 25000 });
await page.evaluate(() => FCOjima.Carpool.whenSaved());
let names = await page.evaluate(() => [...document.querySelectorAll('#attendance-table tbody tr td:first-child')].map(td => td.textContent));
chk('後から入部した対象学年の選手が出欠表に追加される', names.includes('三年に'), JSON.stringify(names));
chk('手動で外した選手は自動で戻らない', !names.includes('三年さん'));
let d = await get(`${T}/eventData/${EV}`);
chk('追加分はサーバーにも保存され、既存の回答は保たれる', d.attendance.some(a => a.name === '三年に' && a.status === 'unknown') && d.attendance.some(a => a.name === '三年いち' && a.status === 'present'), JSON.stringify(d.attendance));
// 外す → 再読み込みしても戻らない、追加し直すと戻る
await page.evaluate(() => FCOjima.Carpool.Attendance.removeMemberFromAttendance('三年に'));
await page.evaluate(() => FCOjima.Carpool.whenSaved());
await page.reload();
await page.waitForFunction(() => document.querySelectorAll('.attendance-select').length > 0, null, { timeout: 25000 });
names = await page.evaluate(() => [...document.querySelectorAll('#attendance-table tbody tr td:first-child')].map(td => td.textContent));
chk('出欠表から外した選手は、開き直しても戻らない', !names.includes('三年に'), JSON.stringify(names));
await page.evaluate(() => FCOjima.Carpool.Attendance.addMemberToAttendance(FCOjima.Carpool.members.find(m => m.name === '三年さん')));
await page.evaluate(() => FCOjima.Carpool.whenSaved());
d = await get(`${T}/eventData/${EV}`);
chk('手動で追加し直すと「外した」記録も消える', d.attendance.some(a => a.name === '三年さん') && !(d.attendanceRemoved || []).includes('三年さん'), JSON.stringify(d.attendanceRemoved));

// 2) 共有ボタンでLINEが1回だけ開く
await page.goto(BASE + '/carpool/index.html?event=' + EV);
await page.waitForFunction(() => document.querySelector('#status-summary .ov-grid'), null, { timeout: 25000 });
const opens = await page.evaluate(() => {
  let n = 0; const o = window.open; window.open = () => { n++; return null; };
  try { document.getElementById('share-event-button').click(); } finally { window.open = o; }
  return n;
});
chk('概要ページの「LINEで共有」でLINEが1回だけ開く', opens === 1, String(opens));

// 3) 座席数が文字列の旧データでも統計バーの座席数が正しい
await page.goto(BASE + '/carpool/assignments.html?event=' + EV);
await page.waitForFunction(() => document.querySelector('.car-top-view'), null, { timeout: 25000 });
await page.waitForTimeout(500);
const stats = await page.evaluate(() => (document.getElementById('assignment-stats-bar-nav') || document.getElementById('assignment-stats-bar-fs')).textContent);
chk('座席数が文字列の旧データでも統計バーの座席数が正しい（"0"+"1"+"2"+"0"="0120"にならない）', /座席数\s*3/.test(stats), stats.replace(/\s+/g, ' '));
await ctx.close();

// 4) HUB: カレンダーの色分け・対象学年の保持・役員の子供の保持
const ctx2 = await context({ email: 'r3admin@example.com', name: '管理者', device: null });
const p2 = await ctx2.newPage();
p2.on('dialog', d => d.accept());
await p2.goto(BASE + '/hub/index.html');
await p2.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
await p2.waitForTimeout(800);
const colors = await p2.evaluate(() => {
  FCOjima.Hub.currentDate = new Date(2026, 10, 1);
  FCOjima.Hub.Calendar.renderCalendar();
  const bg = id => { const el = document.querySelector(`#calendar-grid .event[data-event-id="${id}"]`); return el ? getComputedStyle(el).backgroundColor : null; };
  return { game: bg('1900000006001'), practice: bg('evp') };
});
chk('カレンダーで試合と練習が色分けされる（全部紫にならない）', colors.game && colors.practice && colors.game !== colors.practice && colors.game !== 'rgb(232, 213, 245)', JSON.stringify(colors));

await p2.evaluate(() => FCOjima.Hub.Calendar.editEvent('ev6'));
const has6 = await p2.evaluate(() => { const cb = document.getElementById('grade-6'); return !!(cb && cb.checked); });
chk('対象学年の選手がいない学年（6年）も編集フォームに出てチェックされている', has6);
await p2.fill('#event-title', '6年だけ（編集）');
await p2.click('#event-form button[type="submit"]');
await p2.waitForTimeout(1500);
const e6 = await get(`${T}/events/ev6`);
chk('編集して保存しても対象学年が消えない（全員対象に変わらない）', JSON.stringify(e6.target) === '["6"]', JSON.stringify(e6.target));

await p2.evaluate(() => { document.querySelector('.tablinks[onclick*="members"]').click(); FCOjima.Hub.Members.openAddMemberModal('o1'); });
await p2.fill('#member-notes', '編集テスト');
await p2.click('#member-form button[type="submit"]');
await p2.waitForTimeout(1500);
const o1 = await get(`${T}/members/o1`);
chk('役員として登録された保護者を編集しても子供の紐づけが消えない', JSON.stringify(o1.childrenIds) === '["a1"]', JSON.stringify(o1.childrenIds));

// 5) 日付表示の安全化
const fmt = await p2.evaluate(() => [FCOjima.Utils.formatDateForDisplay('2026-11-08'), FCOjima.Utils.formatDateForDisplay('<b>x</b>')]);
chk('日付として解釈できない値をそのまま返さない', fmt[0] === '2026年11月8日(日)' && fmt[1] === '-', JSON.stringify(fmt));
await closeBrowser();
process.exit(summary() ? 1 : 0);
