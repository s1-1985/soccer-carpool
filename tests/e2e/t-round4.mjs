// 4巡目の不具合の確認
import { put, get, list, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T } from './lib.mjs';
await wipe();
const EV = '1900000007001';
const EVD = '1900000007002';
await put(`${T}/members/p1`, { name: '四年いち', role: 'player', grade: '4' });
await put(`${T}/members/p2`, { name: '四年に', role: 'player', grade: '4' });
await put(`${T}/members/p3`, { name: '四年さん', role: 'player', grade: '4' });
await put(`${T}/members/f1`, { name: '父いち', role: 'father', childrenIds: ['p1'] });
await put(`${T}/events/${EV}`, { title: '4年の試合', date: '2026-11-15', type: 'game', target: ['4'], venue: '尾島', startTime: '09:00',
  notes: '集合は8時\n水筒を持参\nタオルも' });
await put(`${T}/events/${EVD}`, { title: '当番テスト', date: '2026-11-22', type: 'practice', target: [] });
// 出欠: 1人参加・1人不参加・1人は自動補完された「未回答」
await put(`${T}/eventData/${EV}`, { attendance: [
  { name: '四年いち', status: 'present', notes: '' },
  { name: '四年に', status: 'absent', notes: '' },
  { name: '四年さん', status: 'unknown', notes: '' }
] });
await put(`${T}/dutySettings/main`, { enabled: true });
await put(`${T}/dutyGroups/g1`, { name: 'Aグループ', memberIds: [] });
await put(`${T}/dutyAssignments/${EVD}`, { groupId: 'g1', groupName: 'Aグループ' });
await makeUser('r4admin@example.com', '管理者', 'admin');
const rejUid = await makeUser('r4rej@example.com', '却下さん', 'parent');
await put(`${T}/users/${rejUid}`, { name: '却下さん', role: 'parent', status: 'rejected', email: 'r4rej@example.com' });

const ctx = await context({ email: 'r4admin@example.com', name: '管理者', device: null });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());
await page.goto(BASE + '/hub/index.html');
await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
await page.waitForTimeout(800);

// 1) カレンダーの予定詳細: 未回答の人数
await page.evaluate((id) => FCOjima.Hub.Calendar.showEventDetails(id), EV);
await page.waitForFunction(() => /未回答/.test(document.getElementById('event-details-content').textContent), null, { timeout: 10000 });
const summaryText = await page.evaluate(() => document.getElementById('event-details-content').textContent.replace(/\s+/g, ' '));
chk('予定詳細の出欠集計で「未回答」（自動補完分）が数えられる', /未回答 1/.test(summaryText), (summaryText.match(/参加 \d+.{0,20}/) || [''])[0]);

// 2) 備考の改行が表示に残る
const ws = await page.evaluate(() => {
  const items = [...document.querySelectorAll('#event-details-content .detail-item')];
  const it = items.find(x => /備考/.test(x.textContent));
  if (!it) return null;
  const n = it.querySelector('.detail-notes') || it;
  const lh = parseFloat(getComputedStyle(n).lineHeight) || 20;
  return { ws: getComputedStyle(n).whiteSpace, lines: Math.round(n.getBoundingClientRect().height / lh) };
});
chk('予定詳細の備考で改行が保たれる（3行で表示）', ws && /pre/.test(ws.ws) && ws.lines >= 3, JSON.stringify(ws));

// 3) 添付ファイルの削除手段（HUBの予定詳細）
await page.waitForTimeout(500);
const hasDelUi = await page.evaluate(() => {
  const el = document.getElementById('calendar-event-files');
  return el ? el.innerHTML : null;
});
// テスト用に1ファイル添付してから確認
await page.evaluate(async (id) => {
  const blob = new Blob(['hello'], { type: 'text/plain' });
  const file = new File([blob], '案内.txt', { type: 'text/plain' });
  await FCOjima.EventFiles.upload(id, [file], document.getElementById('calendar-event-files'));
}, EV);
const delBtn = await page.evaluate(() => !!document.querySelector('#calendar-event-files button'));
chk('HUBの予定詳細でも添付ファイルを削除できる（上限10個の案内どおり）', delBtn);

// 4) 当番グループ名の変更が予定側の表示に反映される
await page.evaluate(() => { document.querySelector('.tablinks[onclick*="admin"]') && document.querySelector('.tablinks[onclick*="admin"]').click(); });
await page.evaluate(() => FCOjima.Hub.Admin.loadDutyGroups());
await page.waitForTimeout(800);
await page.evaluate(() => FCOjima.Hub.Admin.renameDutyGroup({ id: 'g1', name: 'Aグループ', memberIds: [] }, '青グループ'));
await page.waitForTimeout(1200);
await page.evaluate((id) => FCOjima.Hub.Calendar.showEventDetails(id), EVD);
await page.waitForTimeout(800);
const dutyText = await page.evaluate(() => document.getElementById('event-details-content').textContent.replace(/\s+/g, ' '));
chk('当番グループ名を変えると予定詳細の当番表示も新しい名前になる', /🔔\s*当番\s*青グループ/.test(dutyText), (dutyText.match(/🔔.{0,12}/) || [''])[0]);
// 削除したグループは予定に残らない
await page.evaluate(() => FCOjima.Hub.Admin.deleteDutyGroup({ id: 'g1', name: '青グループ' }));
await page.waitForTimeout(1200);
await page.evaluate((id) => FCOjima.Hub.Calendar.showEventDetails(id), EVD);
await page.waitForTimeout(800);
const dutyText2 = await page.evaluate(() => document.getElementById('event-details-content').textContent.replace(/\s+/g, ' '));
const da = await get(`${T}/dutyAssignments/${EVD}`);
// 予定のタイトルが「当番テスト」なので、当番の行（🔔）があるかで判定する
chk('削除した当番グループが予定に「当番」として残らない', !/🔔/.test(dutyText2) && !/当番\s*青グループ/.test(dutyText2) && !da, JSON.stringify({ shown: /🔔/.test(dutyText2), doc: da }));

// 5) 端末の保存領域がいっぱいでもサーバーには保存される
await page.evaluate(() => {
  const big = 'x'.repeat(100000);
  let i = 0;
  try { for (; i < 1000; i++) localStorage.setItem('fcojima_event_fill' + i, big); } catch (e) {}
  // 少しだけ空きを残さず詰める
  let s = 'y'.repeat(1000);
  try { for (let j = 0; j < 100000; j++) localStorage.setItem('fcojima_event_pad' + j, s); } catch (e) {}
});
const errBefore = [];
page.on('pageerror', e => errBefore.push(String(e)));
await page.evaluate(() => {
  FCOjima.UI.closeModal('event-details-modal');
  FCOjima.Hub.Calendar.openAddEventModal(new Date(2026, 10, 29));
  document.getElementById('event-title').value = '容量テスト';
});
await page.click('#event-form button[type="submit"]');
await page.waitForTimeout(2000);
const evs = await list(`${T}/events`);
chk('端末の保存領域がいっぱいでもイベントがサーバーに保存される', evs.some(e => e.title === '容量テスト'), errBefore.join(' | ').slice(0, 200));
await ctx.close();

// 配車側（出欠の保存）
const ctx3 = await context({ email: 'r4admin@example.com', name: '管理者' });
const p3 = await ctx3.newPage();
p3.on('dialog', d => d.accept());
await p3.goto(BASE + '/carpool/attendance.html?event=' + EV);
await p3.waitForFunction(() => document.querySelectorAll('.attendance-select').length > 0, null, { timeout: 25000 });
await p3.evaluate(() => {
  const big = 'x'.repeat(100000);
  try { for (let i = 0; i < 1000; i++) localStorage.setItem('fcojima_event_fill' + i, big); } catch (e) {}
  const s = 'y'.repeat(1000);
  try { for (let j = 0; j < 100000; j++) localStorage.setItem('fcojima_event_pad' + j, s); } catch (e) {}
});
const perr = [];
p3.on('pageerror', e => perr.push(String(e)));
await p3.evaluate(() => {
  const sel = [...document.querySelectorAll('.attendance-select')].find(s => s.closest('tr').textContent.includes('四年さん'));
  sel.value = 'present';
  FCOjima.Carpool.Attendance.saveAttendance();
}).catch(e => perr.push('eval: ' + e.message));
await p3.evaluate(() => FCOjima.Carpool.whenSaved()).catch(() => {});
await p3.waitForTimeout(800);
const d = await get(`${T}/eventData/${EV}`);
chk('端末の保存領域がいっぱいでも出欠がサーバーに保存される', d.attendance.some(a => a.name === '四年さん' && a.status === 'present'), perr.join(' | ').slice(0, 200));
await ctx3.close();

// 6) 却下されたユーザーがログアウトできる
const ctx4 = await context({ email: 'r4rej@example.com', name: '却下さん', device: null });
const p4 = await ctx4.newPage();
await p4.goto(BASE + '/hub/index.html');
await p4.waitForTimeout(3000);
const rejInfo = await p4.evaluate(() => ({ text: document.body.innerText.slice(0, 120), btn: [...document.querySelectorAll('button')].map(b => b.textContent) }));
chk('却下されたユーザーの画面にログアウト（別アカウントで入り直す）手段がある', rejInfo.btn.some(t => /ログアウト|サインアウト/.test(t)), JSON.stringify(rejInfo));
await p4.goto(BASE + '/hub/register.html');
await p4.waitForTimeout(2500);
const regInfo = await p4.evaluate(() => ({ url: location.pathname, text: document.body.innerText.slice(0, 80) }));
chk('却下されたユーザーが登録ページを開いても空の申請フォームのまま止まらない', regInfo.url !== '/hub/register.html' || /却下/.test(regInfo.text), JSON.stringify(regInfo));
await ctx4.close();

// 7) 会場名の変更が予定にも反映される／空白だけのタイトルは保存されない
await put(`${T}/venues/v1`, { name: '旧グラウンド', address: '群馬県太田市尾島町1' });
await put(`${T}/events/evv`, { title: '会場テスト', date: '2026-12-06', type: 'game', target: [], venue: '旧グラウンド', meetingPlace: '旧グラウンド' });
const ctx5 = await context({ email: 'r4admin@example.com', name: '管理者', device: null });
const p5 = await ctx5.newPage();
p5.on('dialog', d => d.accept());
await p5.goto(BASE + '/hub/index.html');
await p5.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
await p5.waitForTimeout(800);
await p5.evaluate(() => { document.querySelector('.tablinks[onclick*="venues"]').click(); FCOjima.Hub.Venues.openAddVenueModal('v1'); });
await p5.fill('#venue-name', '新グラウンド');
await p5.click('#venue-form button[type="submit"]');
await p5.waitForTimeout(1500);
const evv = await get(`${T}/events/evv`);
chk('会場名を変えると、その会場を使っている予定の会場名・集合場所も変わる（確認あり）', evv.venue === '新グラウンド' && evv.meetingPlace === '新グラウンド', JSON.stringify([evv.venue, evv.meetingPlace]));
const before = (await list(`${T}/events`)).length;
const alertMsg = await p5.evaluate(() => {
  document.querySelector('.tablinks[onclick*="calendar"]').click();
  FCOjima.Hub.Calendar.openAddEventModal(new Date(2026, 11, 13));
  document.getElementById('event-title').value = '   ';
  FCOjima.Hub.Calendar.saveEvent();
  const t = document.querySelector('.toast-notification');
  return t ? t.textContent : '';
});
await p5.waitForTimeout(1000);
const after = (await list(`${T}/events`)).length;
chk('空白だけのタイトルの予定は保存されない', after === before && /必須/.test(alertMsg), JSON.stringify({ before, after, alertMsg }));
await ctx5.close();

// 8) 削除されたイベントを配車管理で開き続けない
const ctx6 = await context({ email: 'r4admin@example.com', name: '管理者', selectedEvent: { id: 'gone1', title: '削除済みの予定', date: '2026-12-20', type: 'game' } });
const p6 = await ctx6.newPage();
p6.on('dialog', d => d.accept());
await p6.goto(BASE + '/carpool/attendance.html');
await p6.waitForTimeout(4000);
const info = await p6.evaluate(() => ({ head: document.getElementById('attendance-event-info').textContent, sel: sessionStorage.getItem('fcojima_selectedEvent') }));
const goneData = await get(`${T}/eventData/gone1`);
chk('削除されたイベントは「選択されていません」になり、出欠データも作られない', /選択されていません/.test(info.head) && !info.sel && !goneData, JSON.stringify({ info, goneData }));
await ctx6.close();

// 9) 保存後のトースト通知が下部の固定ボタン（次へ・保存など）を覆って押せなくしない
const ctx7 = await context({ email: 'r4admin@example.com', name: '管理者' });
const p7 = await ctx7.newPage();
await p7.goto(BASE + '/carpool/attendance.html?event=' + EV);
await p7.waitForFunction(() => document.querySelectorAll('.attendance-select').length > 0, null, { timeout: 25000 });
const blocked = await p7.evaluate(() => {
  FCOjima.UI.showAlert('出欠を保存しました。とても長いメッセージで幅いっぱいに広がる場合も確認します');
  const btns = [...document.querySelectorAll('.global-navigation button')].filter(b => b.offsetParent);
  return btns.map(b => {
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { btn: b.textContent.trim(), hit: el === b || b.contains(el) };
  });
});
chk('トースト通知が表示中でも下部の固定ボタンを押せる', blocked.length > 0 && blocked.every(x => x.hit), JSON.stringify(blocked));
await ctx7.close();

await closeBrowser();
process.exit(summary() ? 1 : 0);
