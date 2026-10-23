// 保護者（承認済み・一般）が書き込めるデータに仕込んだHTMLが、管理者の画面でスクリプトとして実行されないか
import { put, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, FS } from './lib.mjs';

await wipe();
const P = (tag) => `<img src=x onerror="window.__xss=(window.__xss||[]);window.__xss.push('${tag}')">`;
await put(`${T}/members/x1`, { name: '選手えっくす', role: 'player', grade: '3' });
const adminUid = await makeUser('xssadmin@example.com', '管理者', 'admin');
await makeUser('xssparent@example.com', '悪意ある保護者', 'parent');

// 保護者のトークンで（アプリを介さず）直接書き込む。ルール上、承認済みなら誰でも書ける
const tok = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=k', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postBody: 'id_token=' + encodeURIComponent(JSON.stringify({ sub: 'sub-xssparent@example.com', email: 'xssparent@example.com', email_verified: true, name: '悪意ある保護者' })) + '&providerId=google.com', requestUri: 'http://127.0.0.1', returnSecureToken: true }) }).then(r => r.json());
const { fv } = await import('./lib.mjs');
async function putAs(path, data) {
  const r = await fetch(`${FS}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + tok.idToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, fv(v)])) }) });
  return r.status;
}
const EV = '1900000004001';
const today = new Date(); const d = new Date(today.getFullYear(), today.getMonth(), 20);
const date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-20';
const evDoc = {
  title: '通常の練習', date, type: 'practice" ' + P('type-attr') + '<b x="', target: ['3', P('target')],
  startTime: P('startTime'), endTime: P('endTime'), departureTime: P('departureTime'), venue: '尾島',
  luggage: [{ name: 'テント', count: '1' + P('luggage') }]
};
console.log('event write status (parent):', await putAs(`${T}/events/${EV}`, evDoc));
console.log('eventData write status (parent):', await putAs(`${T}/eventData/${EV}`, {
  carRegistrations: [{ parent: '保護者', canDrive: P('canDrive'), frontSeat: P('front'), middleSeat: 1, backSeat: 0, notes: '' }],
  attendance: [{ name: '選手えっくす', status: 'unknown" ' + P('status-attr') + '<b x="', notes: '' }]
}));
console.log('notification write status (parent):', await putAs(`${T}/notifications/n1`, { date: P('notif-date'), text: 'お知らせ', user: '保護者' }));

const ctx = await context({ email: 'xssadmin@example.com', name: '管理者', device: null });
const page = await ctx.newPage();
await page.goto(BASE + '/hub/index.html');
await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
await page.waitForTimeout(800);
await page.evaluate(() => document.getElementById('list-view').click());
// リスト表示は今日からなので、今日より前の予定（仕込んだ予定が20日のとき）も出して確かめる
await page.evaluate(() => { const t = document.querySelector('#events-list .list-past-toggle'); if (t) t.click(); });
await page.evaluate((id) => FCOjima.Hub.Calendar.showEventDetails(id), EV);
await page.waitForTimeout(500);
await page.evaluate((id) => { const ev = FCOjima.Hub.events.find(e => String(e.id) === id); FCOjima.Hub.Admin.openEventDetailModal(ev, null, false); }, EV);
await page.evaluate(() => document.querySelector('.tablinks[onclick*="notifications"]').click());
await page.waitForTimeout(500);
const hubHits = await page.evaluate(() => window.__xss || []);
chk('HUB（カレンダー・イベント詳細・管理タブ・連絡事項）で仕込まれたHTMLが実行されない', hubHits.length === 0, JSON.stringify(hubHits));
const calOk = await page.evaluate(() => document.querySelectorAll('#calendar-grid .event').length);
chk('細工されたイベントがあってもカレンダーに予定が表示される', calOk >= 1, String(calOk));

const hits2 = [];
for (const p of ['index.html', 'attendance.html', 'cars.html', 'assignments.html']) {
  await page.goto(BASE + '/carpool/' + p + '?event=' + EV);
  await page.waitForFunction(() => window.FCOjima && FCOjima.Carpool && FCOjima.Carpool._base, null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(700);
  const h = await page.evaluate(() => window.__xss || []);
  if (h.length) hits2.push(p + ':' + h.join(','));
}
chk('配車管理の各ページで仕込まれたHTMLが実行されない', hits2.length === 0, JSON.stringify(hits2));
await closeBrowser();
process.exit(summary() ? 1 : 0);
