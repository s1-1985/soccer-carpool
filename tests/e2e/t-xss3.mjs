// XSS 3（t-xss2 のあとに増えた画面）: 名前・会場・指導者の都合とメモ・聞く日・当番グループ・荷物・操作ログ・添付ファイル名・
// 兄弟児・承認待ちの申請に仕込んだ HTML が、管理者・監督・保護者のどの画面を開いてもスクリプトとして動かないこと。
// 名簿・会場などは権限の設定で保護者にも書けるようにできるので、だれが書いたかに関係なく出す側で無害にする必要がある
import { put, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T } from './lib.mjs';
await wipe();

const P = (tag) => `"'><img src=x onerror="(window.__xss=window.__xss||[]).push('${tag}')">`;
const now = new Date();
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const sat = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((6 - now.getDay() + 7) % 7 || 7));
const SAT = iso(sat);
const EV = '1900000007001';

const KNAME = '佐藤' + P('kantokuName');
const PNAME = '保護者' + P('parentName');
await put(`${T}/members/x1`, { name: '山田' + P('playerName'), kana: P('playerKana'), role: 'player', grade: '3' });
await put(`${T}/members/m1`, { name: PNAME, kana: P('parentKana'), role: 'mother', childrenIds: ['x1'], siblings: [{ name: P('sibling'), grade: '未就学' }] });
await put(`${T}/members/k1`, { name: KNAME, role: 'coach' });
await put(`${T}/members/k2`, { name: 'コーチ' + P('coachName'), role: 'coach' });
await put(`${T}/venues/v1`, { name: '会場' + P('venueName'), address: '群馬県太田市' + P('venueAddr'), notes: P('venueNotes') });
await put(`${T}/events/${EV}`, { title: '練習', date: SAT, type: 'practice', target: ['3'], venue: '会場' + P('venueName'), startTime: '09:00', endTime: '12:00' });
await put(`${T}/coachAvailability/k1`, { name: KNAME, answers: { [SAT]: { s: 'ok', note: P('availNote') }, [P('availDateKey')]: { s: P('availS'), note: P('availNote2') } } });
await put(`${T}/coachAvailability/k2`, { name: P('availName'), answers: { [SAT]: { s: 'am', note: P('availNote3') } } });
await put(`${T}/coachAssignments/${EV}`, { memberIds: ['k1', 'k2'] });
await put(`${T}/coachDates/plan`, { add: { [P('coachDateKey')]: true }, skip: { [P('coachSkipKey')]: true } });
await put(`${T}/dutySettings/main`, { enabled: true });
await put(`${T}/dutyGroups/g1`, { name: '当番' + P('dutyGroup'), memberIds: ['m1'] });
await put(`${T}/dutyAssignments/${EV}`, { groupId: 'g1', groupName: P('dutyAssignName') });
await put(`${T}/luggageSettings/main`, { items: [P('luggageItem')] });
await put(`${T}/logs/l1`, { datetime: new Date().toISOString(), type: P('logType'), action: P('logAction'), details: P('logDetails'), user: P('logUser') });
await put(`${T}/notifications/n1`, { date: '2026/10/23 08:00', text: 'お知らせ', user: PNAME, uid: 'someone' });

const adminUid = await makeUser('x3admin@example.com', '管理 太郎', 'admin');
const kUid = await makeUser('x3kantoku@example.com', KNAME, 'coach');
await makeUser('x3stray@example.com', '別の監督' + P('strayCoach'), 'coach');
await makeUser('x3officer@example.com', '役員' + P('officerName'), 'officer');
await makeUser('x3parent@example.com', PNAME, 'parent', { childrenIds: ['x1'] });
await put(`${T}/settings/roles`, { kantoku: kUid });
// 承認待ち（申請で入れられる項目だけ）
const ptok = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=k', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postBody: 'id_token=' + encodeURIComponent(JSON.stringify({ sub: 'sub-x3pend@example.com', email: 'x3pend@example.com', email_verified: true, name: 'x' })) + '&providerId=google.com', requestUri: 'http://127.0.0.1', returnSecureToken: true }) }).then(r => r.json());
await put(`${T}/users/${ptok.localId}`, { name: '申請' + P('pendName'), kana: P('pendKana'), requestedRole: 'coach', email: 'x3pend@example.com', role: 'parent', childrenIds: [], childrenNames: [P('pendChild'), '山田'], status: 'pending' });
// 添付ファイル（ファイル名に HTML）
const atok = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=k', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postBody: 'id_token=' + encodeURIComponent(JSON.stringify({ sub: 'sub-x3admin@example.com', email: 'x3admin@example.com', email_verified: true, name: '管理 太郎' })) + '&providerId=google.com', requestUri: 'http://127.0.0.1', returnSecureToken: true }) }).then(r => r.json());
const up = await fetch(`http://127.0.0.1:9199/v0/b/fc-ojimajr-hub.firebasestorage.app/o?name=${encodeURIComponent(`teams/fc-ojima/events/${EV}/` + P('fileName') + '.txt')}`, { method: 'POST', headers: { Authorization: 'Bearer ' + atok.idToken, 'Content-Type': 'text/plain' }, body: 'x' });
chk('（前提）添付ファイルを置けた', up.ok, String(up.status));

async function openHub(email, name) {
  const ctx = await context({ email, name, device: null });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss());
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  return { ctx, page };
}
// 仕込んだ文字が画面に「文字として」出ているか（空振りで PASS にならないよう、どの画面まで描けたかも確かめる）
const shown = (page) => page.evaluate(() => {
  const t = document.body.textContent + ' ' + [...document.querySelectorAll('input,textarea,select')].map(e => e.value).join(' ');
  return [...new Set((t.match(/push\('([A-Za-z0-9]+)'\)/g) || []).map(x => x.slice(6, -2)))].sort();
});
async function runSteps(page, steps) {
  for (const [label, fn] of steps) {
    await page.evaluate(fn, { EV, SAT }).catch(e => console.log('step error', label, e.message.slice(0, 120)));
    await page.waitForTimeout(700);
  }
  return page.evaluate(() => [...new Set(window.__xss || [])]);
}

// ---------- 管理者 ----------
{
  const { ctx, page } = await openHub('x3admin@example.com', '管理 太郎');
  const hits = await runSteps(page, [
    ['ホーム', () => FCOjima.Hub.Home && FCOjima.Hub.Home.render()],
    ['予定の詳細（添付・担当・当番）', (a) => FCOjima.Hub.Calendar.showEventDetails(a.EV)],
    ['予定の編集', (a) => FCOjima.Hub.Calendar.editEvent(a.EV)],
    ['名簿', () => { FCOjima.UI.closeModal('event-modal'); document.querySelector('.tablinks[onclick*="members"]').click(); }],
    ['メンバーの詳細・編集', () => { FCOjima.Hub.Members.showMemberDetail('m1'); FCOjima.Hub.Members.openAddMemberModal('m1'); }],
    ['会場', () => { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); document.querySelector('.tablinks[onclick*="venues"]').click(); }],
    ['会場の編集・選択', () => { FCOjima.Hub.Venues.openAddVenueModal('v1'); }],
    ['管理タブ（承認待ちのカード）', () => { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); document.querySelector('.tablinks[onclick*="admin"]').click(); }],
    ['登録済みユーザー・監督の欄', () => document.getElementById('btn-all-users').click()],
    ['権限の設定', () => FCOjima.Hub.PermSettings.open()],
    ['当番グループ', () => { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); FCOjima.Hub.Admin.loadDutyGroups(); }],
    ['荷物設定', () => FCOjima.Hub.Admin.loadLuggageSettings()],
    ['指導者の予定・担当', (a) => FCOjima.Hub.Coaching.openPlanner(a.SAT)],
    ['指導者の担当を決める', (a) => { const ev = FCOjima.Hub.events.find(e => String(e.id) === a.EV); return FCOjima.Hub.Coaching.openAssign(ev); }],
    ['出欠状況', () => FCOjima.Hub.Admin.loadAttendanceMatrix()],
    ['管理タブの予定の概要（添付）', (a) => { const ev = FCOjima.Hub.events.find(e => String(e.id) === a.EV); FCOjima.Hub.Admin.openEventDetailModal(ev, null, true); }],
    ['操作ログ（削除ボタン付き）', () => FCOjima.Hub.openLogsModal()],
    ['参加予定', () => { const b = document.getElementById('my-events-tab'); if (b) b.click(); }]
  ]);
  const imgs = await page.evaluate(() => document.querySelectorAll('img[src="x"]').length);
  const seen = await shown(page);
  const need = ['availNote', 'dutyGroup', 'fileName', 'kantokuName', 'logDetails', 'luggageItem', 'parentName', 'pendChild', 'pendName', 'strayCoach', 'venueName'];
  chk('（前提）管理者の画面に、仕込んだ文字がそのまま文字として出ている（各画面を描けている）', need.every(x => seen.includes(x)), 'missing=' + need.filter(x => !seen.includes(x)).join(','));
  chk('管理者の画面（承認待ち・登録済みユーザー・監督の欄・権限の設定・当番・荷物・指導者の予定と担当・添付・操作ログほか）で、仕込んだ HTML が動かない',
    hits.length === 0 && imgs === 0, JSON.stringify({ hits, imgs }));
  await ctx.close();
}

// ---------- 監督（指導の予定・担当の画面）----------
{
  const { ctx, page } = await openHub('x3kantoku@example.com', KNAME);
  const hits = await runSteps(page, [
    ['ホーム（指導の予定）', () => FCOjima.Hub.Home && FCOjima.Hub.Home.render()],
    ['指導の予定の回答', (a) => { const m = FCOjima.Hub.members.find(x => x.id === 'k1'); return FCOjima.Hub.Coaching.openAnswerSheet(m, a.SAT); }],
    ['予定の詳細', (a) => { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); FCOjima.Hub.Calendar.showEventDetails(a.EV); }],
    ['登録済みユーザー（次の監督に指名する）', () => { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); document.querySelector('.tablinks[onclick*="admin"]').click(); document.getElementById('btn-all-users').click(); }]
  ]);
  const imgs = await page.evaluate(() => document.querySelectorAll('img[src="x"]').length);
  const seen = await shown(page);
  chk('（前提）監督の画面に、仕込んだ文字が文字として出ている', ['availNote', 'kantokuName'].every(x => seen.includes(x)), seen.join(','));
  chk('監督の画面（指導の予定・回答・担当・次の監督の指名）で、仕込んだ HTML が動かない', hits.length === 0 && imgs === 0, JSON.stringify({ hits, imgs }));
  await ctx.close();
}

// ---------- 保護者（配車の各ページ・兄弟児）----------
{
  const { ctx, page } = await openHub('x3parent@example.com', PNAME);
  let hits = await runSteps(page, [
    ['ホーム', () => FCOjima.Hub.Home && FCOjima.Hub.Home.render()],
    ['予定の詳細', (a) => FCOjima.Hub.Calendar.showEventDetails(a.EV)],
    ['連絡事項', () => { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); document.querySelector('.tablinks[onclick*="notifications"]').click(); }]
  ]);
  for (const p of ['index.html', 'attendance.html', 'cars.html', 'assignments.html', 'notifications.html']) {
    await page.goto(BASE + '/carpool/' + p + '?event=' + EV);
    await page.waitForFunction(() => window.FCOjima && FCOjima.Carpool && FCOjima.Carpool._base, null, { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(900);
    const h = await page.evaluate(() => window.__xss || []);
    hits = hits.concat(h.map(x => p + ':' + x));
  }
  chk('保護者の画面（ホーム・予定・連絡・配車の各ページ・兄弟児）で、仕込んだ HTML が動かない', hits.length === 0, JSON.stringify([...new Set(hits)]));
  await ctx.close();
}

await closeBrowser();
process.exitCode = summary() ? 1 : 0;
