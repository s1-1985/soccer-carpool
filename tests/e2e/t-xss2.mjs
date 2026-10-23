// 網羅版: 保護者・未承認ユーザーが書き込めるすべての文字列フィールドにHTMLを仕込み、
// 管理者があらゆる画面を開いてもスクリプトが実行されないこと
import { put, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, FS, fv } from './lib.mjs';

await wipe();
const P = (tag) => `"'><img src=x onerror="(window.__xss=window.__xss||[]).push('${tag}')">`;
await put(`${T}/members/x1`, { name: '選手えっくす', role: 'player', grade: '3' });
await put(`${T}/members/xp`, { name: '保護者えっくす', role: 'father', childrenIds: ['x1'] });
await makeUser('xss2admin@example.com', '管理者', 'admin', { childrenIds: ['x1'] });
await makeUser('xss2parent@example.com', '保護者えっくす', 'parent');

async function tokenFor(email, name) {
  return (await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=k', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postBody: 'id_token=' + encodeURIComponent(JSON.stringify({ sub: 'sub-' + email, email, email_verified: true, name })) + '&providerId=google.com', requestUri: 'http://127.0.0.1', returnSecureToken: true }) }).then(r => r.json()));
}
const ptok = await tokenFor('xss2parent@example.com', '保護者えっくす');
async function putAs(tok, path, data) {
  const r = await fetch(`${FS}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, fv(v)])) }) });
  if (!r.ok) console.log('write failed', path, r.status, await r.text());
}

const now = new Date();
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const future = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3);
const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3);
const EV = '1900000005001', EV2 = '1900000005002', EVP = '1900000005003';
const evDoc = (date) => ({
  title: P('title'), date, type: P('type'), target: ['3', P('target')], extraPlayers: [P('extraPlayers')],
  targetNotes: P('targetNotes'), venue: P('venue'), meetingPlace: P('meetingPlace'), notes: P('notes'),
  startTime: P('startTime'), endTime: P('endTime'), departureTime: P('departureTime'),
  attendanceDeadline: P('deadline'), checklist: [P('checklist')], checklistExtra: [P('checklistExtra')],
  luggage: [{ name: P('luggageName'), count: P('luggageCount') }]
});
await putAs(ptok.idToken, `${T}/events/${EV}`, evDoc(iso(future)));
await putAs(ptok.idToken, `${T}/events/${EV2}`, Object.assign(evDoc(iso(future)), { type: 'game', title: '同日の別イベント' }));
await putAs(ptok.idToken, `${T}/events/${EVP}`, evDoc(iso(past)));
const ed = {
  attendance: [{ name: '選手えっくす', status: 'present', notes: P('attNotes') }, { name: P('attName'), status: P('attStatus'), notes: '' }],
  carRegistrations: [{ parent: P('carParent'), canDrive: P('canDrive'), frontSeat: 1, middleSeat: 2, backSeat: 0, notes: P('carNotes'), extraPassengers: [{ name: P('epName') }] }],
  assignments: [{ carIndex: 0, driver: P('asgDriver'), seats: { '助手席': { '0': P('seatPerson') }, '中列': { '0': '選手えっくす' }, '後列': {} } }],
  notifications: [{ date: P('cnDate'), text: P('cnText'), type: P('cnType'), user: P('cnUser') }],
  comment: P('comment'), comments: [{ text: P('commentsText'), author: P('commentsAuthor'), timestamp: 1790000000000 }]
};
await putAs(ptok.idToken, `${T}/eventData/${EV}`, ed);
await putAs(ptok.idToken, `${T}/eventData/${EVP}`, ed);
await putAs(ptok.idToken, `${T}/notifications/nx1`, { date: P('notifDate'), text: P('notifText'), user: P('notifUser') });
await putAs(ptok.idToken, `${T}/notifications/nx2`, { type: 'move', date: '2026/10/16 10:00', ts: Date.now(), text: P('moveText'), user: P('moveUser'), memberId: 'x1', memberName: P('moveMember'), eventDate: iso(future), fromEventTitle: P('fromTitle'), toEventTitle: P('toTitle'), fromEventId: EV, toEventId: EV2 });
// 未承認（申請中）ユーザー: 誰でも作れる
const stok = await tokenFor('xss2pending@example.com', 'x');
await putAs(stok.idToken, `${T}/users/${stok.localId}`, { name: P('pendName'), email: P('pendEmail'), kana: P('pendKana'), gender: P('pendGender'), role: 'parent', status: 'pending', childrenIds: [P('pendChild')] });

const ctx = await context({ email: 'xss2admin@example.com', name: '管理者', device: null });
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss());
await page.goto(BASE + '/hub/index.html');
await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
await page.waitForTimeout(1500);
const steps = [
  ['リスト表示', () => document.getElementById('list-view').click()],
  ['イベント詳細', (a) => FCOjima.Hub.Calendar.showEventDetails(a.EV)],
  ['イベント編集フォーム', (a) => FCOjima.Hub.Calendar.editEvent(a.EV)],
  ['管理タブのイベント概要', (a) => { FCOjima.UI.closeModal('event-modal'); const ev = FCOjima.Hub.events.find(e => String(e.id) === a.EV); FCOjima.Hub.Admin.openEventDetailModal(ev, null, false); }],
  ['参加予定タブ', () => { const b = document.getElementById('my-events-tab'); if (b) b.click(); }],
  ['参加イベント変更ダイアログ', () => FCOjima.Hub.MyEvents.checkMoveNotices()],
  ['連絡事項タブ', () => document.querySelector('.tablinks[onclick*="notifications"]').click()],
  ['管理タブ', () => document.querySelector('.tablinks[onclick*="admin"]').click()],
  ['出欠マトリクス', () => FCOjima.Hub.Admin.loadAttendanceMatrix()],
  ['参加イベント移動', (a) => { const ev = FCOjima.Hub.events.find(e => String(e.id) === a.EV); const ev2 = FCOjima.Hub.events.find(e => String(e.id) === a.EV2); const m = FCOjima.Hub.members.find(x => x.id === 'x1'); FCOjima.Hub.Admin.openMatrixMoveModal(m, ev, [ev2]); }],
  ['送迎の貢献度', () => FCOjima.Hub.Admin.loadDriverStats()],
  ['参加率', () => FCOjima.Hub.Admin.loadAttendanceRates()],
  ['ログ', () => FCOjima.Hub.openLogsModal()]
];
for (const [label, fn] of steps) {
  await page.evaluate(fn, { EV, EV2 }).catch(e => console.log('step error', label, e.message.slice(0, 120)));
  await page.waitForTimeout(700);
}
const hubHits = await page.evaluate(() => window.__xss || []);
chk('HUBの全タブ・モーダルで仕込まれたHTMLが実行されない', hubHits.length === 0, JSON.stringify([...new Set(hubHits)]));

const carHits = [];
for (const ev of [EV, EVP]) {
  for (const p of ['index.html', 'attendance.html', 'cars.html', 'assignments.html', 'notifications.html']) {
    await page.goto(BASE + '/carpool/' + p + '?event=' + ev);
    await page.waitForFunction(() => window.FCOjima && FCOjima.Carpool && FCOjima.Carpool._base, null, { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(600);
    if (p === 'assignments.html') {
      await page.evaluate(() => {
        const A = FCOjima.Carpool.Assignment;
        A.openCommentModal();
        const seat = document.querySelector('.seat:not(.driver-seat)'); if (seat) A.openSeatEditModal(seat);
        A.editCarDriver(0);
        A.openCanvasMode();
      }).catch(e => console.log('assign step', e.message.slice(0, 100)));
      await page.waitForTimeout(600);
    }
    const h = await page.evaluate(() => window.__xss || []);
    if (h.length) carHits.push(p + ':' + [...new Set(h)].join(','));
  }
}
chk('配車管理の全ページ（全画面・コメント・座席編集を含む）で実行されない', carHits.length === 0, JSON.stringify(carHits));
await closeBrowser();
process.exit(summary() ? 1 : 0);
