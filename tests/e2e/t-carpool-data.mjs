// 配車管理のイベントデータが、他ページ・他ユーザーの保存で消えたり巻き戻ったりしないことを確認
import { put, get, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors } from './lib.mjs';

const EV = '1900000000601';
const kids = ['颯', 'セナ', 'ジュリ'];
for (let i = 0; i < kids.length; i++) {
  await put(`${T}/members/k${i}`, { name: kids[i], role: 'player', grade: '2', gender: 'male' });
}
await put(`${T}/members/p1`, { name: '曽根父', role: 'father', childrenIds: ['k0'] });
await put(`${T}/members/p2`, { name: '高阪母', role: 'mother', childrenIds: ['k1'] });
const event = { id: EV, title: 'データ保全確認', date: '2026-10-25', type: 'game', target: ['2'], venue: '尾島グラウンド', startTime: '09:00' };
await put(`${T}/events/${EV}`, event);
await put(`${T}/eventData/${EV}`, {
  carRegistrations: [{ parent: '曽根父', canDrive: 'both', frontSeat: 1, middleSeat: 2, backSeat: 0, notes: '' }],
  attendance: kids.map(n => ({ name: n, status: 'unknown', notes: '' })),
  assignments: [],
  notifications: [],
  comment: '集合は8時半です',
  comments: [{ text: '集合は8時半です', author: '配車担当', timestamp: 1790000000000 }]
});

await makeUser('coach@example.com', '配車担当', 'coach');
await makeUser('parentA@example.com', '曽根父', 'parent');
await makeUser('parentB@example.com', '高阪母', 'parent');

const ctxC = await context({ email: 'coach@example.com', name: '配車担当', selectedEvent: event });
const ctxA = await context({ email: 'parentA@example.com', name: '曽根父', selectedEvent: event });
const ctxB = await context({ email: 'parentB@example.com', name: '高阪母', selectedEvent: event });
const pC = await ctxC.newPage(), pA = await ctxA.newPage(), pB = await ctxB.newPage();
const errs = [...watchErrors(pC, 'C:'), ...watchErrors(pA, 'A:'), ...watchErrors(pB, 'B:')];

// 配車担当が先に割り当て画面を開いておく（この時点の出欠はすべて未回答）
await pC.goto(BASE + '/carpool/assignments.html?event=' + EV);
await pC.waitForFunction(() => document.querySelector('.car-top-view'), null, { timeout: 25000 });

// 保護者A・Bが同時に出欠ページを開く
await pA.goto(BASE + '/carpool/attendance.html?event=' + EV);
await pB.goto(BASE + '/carpool/attendance.html?event=' + EV);
await pA.waitForFunction(() => document.querySelectorAll('.attendance-select').length === 3, null, { timeout: 25000 });
await pB.waitForFunction(() => document.querySelectorAll('.attendance-select').length === 3, null, { timeout: 25000 });

async function answer(page, name, status) {
  await page.evaluate(([name, status]) => {
    const rows = [...document.querySelectorAll('#attendance-table tbody tr')];
    const row = rows.find(r => r.cells[0].childNodes[0].textContent === name);
    const sel = row.querySelector('.attendance-select');
    sel.value = status;
    sel.dispatchEvent(new Event('change'));
  }, [name, status]);
}
// A: 颯=参加 → 保存
await answer(pA, '颯', 'present');
await pA.evaluate(() => FCOjima.Carpool.whenSaved ? FCOjima.Carpool.whenSaved() : new Promise(r => setTimeout(r, 1500)));
// B（Aの回答前に開いた画面のまま）: セナ=不参加 → 保存
await answer(pB, 'セナ', 'absent');
await pB.evaluate(() => FCOjima.Carpool.whenSaved ? FCOjima.Carpool.whenSaved() : new Promise(r => setTimeout(r, 1500)));

let d = await get(`${T}/eventData/${EV}`);
const st = n => (d.attendance.find(a => a.name === n) || {}).status;
chk('先に保存した保護者Aの回答（颯=参加）が、後から保存した保護者Bに消されない', st('颯') === 'present', JSON.stringify(d.attendance));
chk('保護者Bの回答（セナ=不参加）も保存される', st('セナ') === 'absent');
chk('出欠の保存で配車担当のコメント履歴が消えない', d.comments && d.comments.length === 1 && d.comment === '集合は8時半です', JSON.stringify({ c: d.comment, cs: d.comments }));
chk('出欠の行が重複しない', d.attendance.length === 3, String(d.attendance.length));

// 配車担当（出欠回答前に開いた画面）が座席を割り当てて保存 → 保護者の回答が巻き戻らない
await pC.evaluate(() => {
  const seat = document.querySelector('.seat[data-seat-type="中列"][data-seat-index="0"]');
  FCOjima.Carpool.Assignment.setSeatOccupant(seat, '颯');
  FCOjima.Carpool.Assignment.saveAssignments();
});
await pC.evaluate(() => FCOjima.Carpool.whenSaved ? FCOjima.Carpool.whenSaved() : new Promise(r => setTimeout(r, 1500)));
d = await get(`${T}/eventData/${EV}`);
chk('配車担当の座席保存で、後から回答された出欠が巻き戻らない', st('颯') === 'present' && st('セナ') === 'absent', JSON.stringify(d.attendance));
chk('座席割り当ては保存される', d.assignments && d.assignments[0] && d.assignments[0].seats['中列']['0'] === '颯', JSON.stringify(d.assignments));

// 配車担当がコメント投稿 → 保護者A（古い画面のまま）が再度出欠を保存してもコメントが残る
await pC.evaluate(() => {
  document.getElementById('assignment-comment').value = '雨天時は体育館';
  FCOjima.Carpool.Assignment.saveComment();
});
await pC.evaluate(() => FCOjima.Carpool.whenSaved ? FCOjima.Carpool.whenSaved() : new Promise(r => setTimeout(r, 1500)));
await answer(pA, 'ジュリ', 'present');
await pA.evaluate(() => FCOjima.Carpool.whenSaved ? FCOjima.Carpool.whenSaved() : new Promise(r => setTimeout(r, 1500)));
d = await get(`${T}/eventData/${EV}`);
chk('出欠の再保存でも新しいコメントが残る', d.comment === '雨天時は体育館' && d.comments.length === 2, JSON.stringify({ c: d.comment, n: d.comments.length }));
chk('保護者Bの回答も保持（Aの古い画面のセナ=未回答で上書きされない）', st('セナ') === 'absent' && st('ジュリ') === 'present', JSON.stringify(d.attendance));

// 車両登録を2人がほぼ同時に追加 → 両方残る
await pA.goto(BASE + '/carpool/cars.html?event=' + EV);
await pB.goto(BASE + '/carpool/cars.html?event=' + EV);
await pA.waitForFunction(() => window.FCOjima && FCOjima.Carpool && FCOjima.Carpool.appData && FCOjima.Carpool.appData.carRegistrations.length > 0, null, { timeout: 25000 });
await pB.waitForFunction(() => window.FCOjima && FCOjima.Carpool && FCOjima.Carpool.appData && FCOjima.Carpool.appData.carRegistrations.length > 0, null, { timeout: 25000 });
await pA.fill('#parentName', '曽根母');
await pA.click('#register-car');
await pA.evaluate(() => FCOjima.Carpool.whenSaved ? FCOjima.Carpool.whenSaved() : new Promise(r => setTimeout(r, 1500)));
await pB.fill('#parentName', '高阪父');
await pB.click('#register-car');
await pB.evaluate(() => FCOjima.Carpool.whenSaved ? FCOjima.Carpool.whenSaved() : new Promise(r => setTimeout(r, 1500)));
d = await get(`${T}/eventData/${EV}`);
const parents = d.carRegistrations.map(c => c.parent);
chk('同時に追加した車両登録が両方残る', parents.includes('曽根母') && parents.includes('高阪父') && parents.includes('曽根父'), JSON.stringify(parents));
chk('車両登録の並び順（既存の車が先頭）が保たれる', parents[0] === '曽根父', JSON.stringify(parents));
chk('車両登録で座席割り当てが消えない', d.assignments && d.assignments.length > 0);

// 連絡ページで投稿 → コメントが消えない・日付がローカル日付
await pA.goto(BASE + '/carpool/notifications.html?event=' + EV);
await pA.waitForFunction(() => window.FCOjima && FCOjima.Carpool && FCOjima.Carpool.appData && FCOjima.Carpool.appData.carRegistrations.length > 0, null, { timeout: 25000 });
await pA.fill('#notificationText', '駐車場は第2です');
await pA.click('#send-notification');
await pA.evaluate(() => FCOjima.Carpool.whenSaved ? FCOjima.Carpool.whenSaved() : new Promise(r => setTimeout(r, 1500)));
d = await get(`${T}/eventData/${EV}`);
chk('連絡の投稿でコメント履歴が消えない', d.comments && d.comments.length === 2, String(d.comments && d.comments.length));
const localToday = await pA.evaluate(() => FCOjima.Utils.formatDate(new Date()));
chk('連絡の日付が端末のローカル日付', d.notifications[0].date === localToday, d.notifications[0].date + ' vs ' + localToday);

console.log('errors:', JSON.stringify(errs.slice(0, 8)));
chk('ページエラーなし', errs.filter(e => !/favicon|ERR_|Failed to load resource/.test(e)).length === 0);
await closeBrowser();
process.exit(summary() ? 1 : 0);
