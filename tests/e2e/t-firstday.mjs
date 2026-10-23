// はじめて使う人の導線: LINE から開く・登録と承認・やること・出欠をその場で答える・乗る車・今週の予定・配車の画面
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors } from './lib.mjs';
await wipe();
const jst = new Date(Date.now() + 9 * 3600e3);
const iso = d => d.toISOString().slice(0, 10);
const plus = n => { const x = new Date(jst); x.setUTCDate(x.getUTCDate() + n); return iso(x); };
const D1 = plus(1), D2 = plus(2), D9 = plus(9);
const kids = [['p31', '小川 悠真', '3'], ['p32', '加藤 樹', '3'], ['p33', '木村 大和', '3'], ['p41', '工藤 颯', '4'], ['p11', '青木 蓮', '1']];
for (const [id, name, grade] of kids) await put(`${T}/members/${id}`, { name, role: 'player', grade });
await put(`${T}/members/f31`, { name: '小川 恵', role: 'mother', childrenIds: ['p31'] });
await put(`${T}/members/f32`, { name: '加藤 健一', role: 'father', childrenIds: ['p32'], kana: 'カトウ ケンイチ' });
await put(`${T}/members/f33`, { name: '木村 由美', role: 'mother', childrenIds: ['p33'] });
await put(`${T}/members/c1`, { name: '佐藤 監督', role: 'coach', abbr: '佐藤' });
await put(`${T}/members/c2`, { name: '鈴木 コーチ', role: 'assist', abbr: '鈴木' });
await put(`${T}/members/c3`, { name: '高橋 コーチ', role: 'assist', abbr: '高橋', kana: 'タカハシ ユウキ' });
const E1 = '1900000400001', E2 = '1900000400002', E3 = '1900000400003';
await put(`${T}/events/${E1}`, { title: '笠懸カップ', date: D1, type: 'game', target: ['3', '4'], startTime: '09:00', venue: '笠懸球技場', attendanceDeadline: D1 + 'T07:00' });
await put(`${T}/events/${E2}`, { title: '練習', date: D2, type: 'practice', target: ['1', '3', '4'], startTime: '09:00' });
await put(`${T}/events/${E3}`, { title: '来週の試合', date: D9, type: 'game', target: ['3'], startTime: '10:00' });
await makeUser('kantoku@example.com', '佐藤 監督', 'coach');
await makeUser('suzuki@example.com', '鈴木 コーチ', 'assist');
await makeUser('ogawa@example.com', '小川 恵', 'parent', { childrenIds: ['p31'] });
await makeUser('kimura@example.com', '木村 由美', 'parent', { childrenIds: ['p33'] });
const mob = (w) => ({ viewport: { width: w, height: w <= 320 ? 568 : 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const ignorable = e => /favicon|ERR_|Failed to load resource|open-meteo|gsi|storage/i.test(e);
const overflow = (s => {
  const vw = document.documentElement.clientWidth;
  return [...document.querySelectorAll(s + ' *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > vw + .5 || r.left < -.5); }).map(e => e.className || e.tagName).slice(0, 5);
});
const hubReady = async (page) => {
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
};
const att = async (ev) => { const d = await get(`${T}/eventData/${ev}`); return Object.fromEntries(((d && d.attendance) || []).map(a => [a.name, a.status])); };

// ① LINE の中のブラウザで共有リンクを開く
{
  const ctx = await context({ device: { ...mob(390), userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/13.0.0' } });
  const page = await ctx.newPage();
  const urls = [];
  page.on('framenavigated', f => { if (f === page.mainFrame()) urls.push(f.url()); });
  await page.goto(BASE + '/carpool/attendance.html?event=' + E1);
  await page.waitForTimeout(4000);
  const v = await page.evaluate(() => ({ url: location.href, warn: getComputedStyle(document.getElementById('browser-warning')).display, box: document.getElementById('current-url').textContent }));
  chk('LINE の中で開くと、元のページを openExternalBrowser=1 付きで開き直す（Safari・Chrome で開く）', urls.some(u => u.includes('/carpool/attendance.html?event=' + E1 + '&openExternalBrowser=1')), JSON.stringify(urls));
  chk('開き直せなかったときは繰り返さず、URL をコピーする案内を出す（URL は元のページ）', /login\.html/.test(v.url) && v.warn !== 'none' && v.box.endsWith('/carpool/attendance.html?event=' + E1) && urls.filter(u => /openExternalBrowser/.test(u)).length === 1, JSON.stringify(v));
  await ctx.close();
}

// ④ 新しい人の申請（立場・名簿と同じ名前の案内。性別・生年月日は聞かない）
{
  const ctx = await context({ email: 'takahashi@example.com', name: '高橋 祐樹', device: mob(360) });
  const page = await ctx.newPage();
  await page.goto(BASE + '/hub/index.html');
  await page.waitForURL(/register/, { timeout: 15000 });
  await page.waitForTimeout(600);
  const f = await page.evaluate(() => ({ roles: [...document.querySelectorAll('input[name="reg-role"]')].map(i => i.value + (i.checked ? '*' : '')), gender: !!document.getElementById('reg-gender'), birth: !!document.getElementById('reg-birth'), note: document.querySelector('#reg-name').parentElement.textContent }));
  chk('申請の画面に立場（保護者・監督・コーチ・役員）があり、性別・生年月日は聞かない。名前は名簿と同じ漢字で、と出る', JSON.stringify(f.roles) === JSON.stringify(['parent*', 'coach', 'officer']) && !f.gender && !f.birth && /名簿と同じ漢字/.test(f.note), JSON.stringify(f));
  const ov = await page.evaluate(overflow, '.register-container');
  chk('360px で申請の画面がはみ出さない', ov.length === 0, JSON.stringify(ov));
  await page.screenshot({ path: 'fd-register.png', fullPage: true });
  await page.tap('input[name="reg-role"][value="coach"]');
  await page.fill('#reg-name', '高橋 祐樹');
  await page.fill('#reg-kana', 'タカハシ ユウキ');
  await page.tap('button[type="submit"]');
  await page.waitForURL(/pending/, { timeout: 15000 });
  const msg = await page.textContent('.pending-msg');
  chk('承認待ちの画面: 承認されたら自動で進むと出る', /自動でアプリの画面に進みます/.test(msg), msg.replace(/\s+/g, ''));
  await ctx.close();
}

// ③④⑨ 監督: やること（承認待ち・都合）、承認（役割・名簿の人）、今週の予定の状況
{
  // 先に配車データ: 笠懸カップに 小川の車（3席）、工藤 颯が参加・座席に、帯同は鈴木
  await put(`${T}/eventData/${E1}`, {
    attendance: [{ name: '工藤 颯', status: 'present', notes: '' }, { name: '加藤 樹', status: 'absent', notes: '' }],
    carRegistrations: [{ parent: '小川 恵', canDrive: 'both', frontSeat: 1, middleSeat: 2, backSeat: 0, notes: '', extraPassengers: [] }],
    assignments: [{ carIndex: 0, driver: '小川 恵', seats: { '助手席': { 0: '工藤 颯' }, '中列': {}, '後列': {} } }]
  });
  await put(`${T}/coachAssignments/${E1}`, { memberIds: ['c2'] });
  const ctx = await context({ email: 'kantoku@example.com', name: '佐藤 監督', device: mob(390) });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  page.on('dialog', d => d.accept());
  await hubReady(page);
  await page.waitForSelector('#hub-home .hh-link', { timeout: 10000 });
  const h = await page.evaluate(() => ({
    links: [...document.querySelectorAll('#hub-home .hh-link')].map(b => b.textContent.replace(/\s+/g, '')),
    adminBadge: document.getElementById('admin-badge').textContent,
    meBadge: document.getElementById('my-events-badge').textContent
  }));
  chk('監督のやることに「指導の都合 未回答 N日」「承認待ち 1人」が出て、管理タブに件数', h.links.some(t => /🧢指導の都合未回答\d+日答える›/.test(t)) && h.links.some(t => /👤承認待ち1人確認する›/.test(t)) && h.adminBadge === '1' && /^\d+$/.test(h.meBadge), JSON.stringify(h));
  // 今週の予定の状況
  const wk = await page.evaluate(() => [...document.querySelectorAll('#hub-home .hh-week-row')].map(r => r.querySelector('.hh-row-title').textContent + '|' + [...r.querySelectorAll('.hh-chip')].map(c => c.textContent + (c.className.match(/is-(\w+)/) || ['', ''])[1]).join(',')));
  chk('今週の予定（今日から7日間）ごとに 出欠・帯同・車の席・割り当て（参加が0人なら「配車は参加の回答待ち」。来週の予定は出ない）', wk.length === 2 && wk[0] === '笠懸カップ|出欠 2/4未2warn,帯同 鈴木ok,車の席 3/2ok,割り当て 1/2part' && wk[1] === '練習|出欠 0/5未5warn,帯同 未定warn,配車は参加の回答待ち', JSON.stringify(wk));
  await page.screenshot({ path: 'fd-kantoku.png', fullPage: true });
  const ov = await page.evaluate(overflow, '#hub-home');
  chk('390px でやること・今週の予定がはみ出さない', ov.length === 0, JSON.stringify(ov));
  // 押すと予定の詳細
  await page.tap('#hub-home .hh-week-row');
  await page.waitForFunction(() => document.getElementById('event-details-modal').style.display === 'flex', null, { timeout: 8000 });
  chk('今週の予定を押すとその予定の詳細が開き、ボタンは「出欠・配車」', await page.evaluate(() => /笠懸カップ/.test(document.getElementById('event-details-content').textContent) && document.getElementById('manage-event').textContent.trim() === '🚗 出欠・配車'), '');
  await page.evaluate(() => FCOjima.UI.closeModal('event-details-modal'));
  // 承認待ち → 管理タブ
  await page.locator('#hub-home .hh-link', { hasText: '承認待ち' }).tap();
  await page.waitForSelector('#pending-users-list .approve-btn', { timeout: 8000 });
  const card = await page.evaluate(() => {
    const c = document.querySelector('#pending-users-list .pending-card');
    const sel = s => { const e = c.querySelector(s); return e.options[e.selectedIndex].textContent; };
    return { text: c.textContent.replace(/\s+/g, ''), role: sel('.pending-role-select'), member: sel('.pending-member-select'), note: c.querySelector('.pending-member-note').textContent, admin: getComputedStyle(document.getElementById('admin')).display };
  });
  chk('「確認する」で管理タブが開き、承認カードに申請の立場・役割（名簿の役割が初期値）・名簿の人（フリガナで見つける）', card.admin === 'block' && /申請の立場:監督・コーチ/.test(card.text) && card.role === 'コーチ' && card.member === '高橋 コーチ（コーチ）' && /名簿の「高橋 コーチ」に合わせます/.test(card.note), JSON.stringify(card));
  await page.screenshot({ path: 'fd-approve.png', fullPage: false });
  await page.tap('#pending-users-list .approve-btn');
  await page.waitForFunction(() => /承認待ちユーザーはいません/.test(document.getElementById('pending-users-list').textContent), null, { timeout: 8000 });
  const users = await (await fetch('http://127.0.0.1:8080/v1/projects/fc-ojimajr-hub/databases/(default)/documents/teams/fc-ojima/users', { headers: { Authorization: 'Bearer owner' } })).json();
  const tk = (users.documents || []).map(d => d.fields).find(f => f.email && f.email.stringValue === 'takahashi@example.com');
  chk('承認すると役割がコーチになり、名前が名簿に合う（申請の立場も残る）', tk && tk.status.stringValue === 'approved' && tk.role.stringValue === 'assist' && tk.name.stringValue === '高橋 コーチ' && tk.requestedRole.stringValue === 'coach', JSON.stringify(tk && { s: tk.status, r: tk.role, n: tk.name }));
  chk('承認すると管理タブの件数が消える', await page.evaluate(() => document.getElementById('admin-badge').textContent === '' && !document.getElementById('admin-badge').classList.contains('on')), '');
  await page.waitForSelector('#approved-notice-modal .close', { timeout: 5000 });
  await page.tap('#approved-notice-modal .close');
  // 指導の都合 → 参加予定タブ
  await page.tap('#defaultTab');
  await page.waitForTimeout(800);
  await page.locator('#hub-home .hh-link', { hasText: '指導の都合' }).tap();
  await page.waitForSelector('#my-coaching .co-cal-day', { timeout: 8000 });
  chk('「指導の都合」の「答える」で参加予定タブ（指導の予定のカレンダー）が開く', await page.evaluate(() => getComputedStyle(document.getElementById('my-events')).display === 'block'), '');
  // 招待のリンク・共有のリンク
  const links = await page.evaluate(() => ({ signup: (document.getElementById('signup-qr-url') || {}).value || '', coach: (() => { let t = ''; const orig = FCOjima.Utils.copyToClipboard; FCOjima.Utils.copyToClipboard = x => { t = x; return true; }; FCOjima.Hub.Coaching.copyRequest(); FCOjima.Utils.copyToClipboard = orig; return t; })() }));
  await page.evaluate(() => document.getElementById('btn-signup-qr').click());
  const signup = await page.evaluate(() => document.getElementById('signup-qr-url').value);
  chk('入会用のリンク・指導者へのお願いのリンクは LINE で押しても Safari・Chrome で開く', /\/hub\/register\.html\?openExternalBrowser=1$/.test(signup) && /\/hub\/index\.html\?openExternalBrowser=1/.test(links.coach), JSON.stringify({ signup, coach: links.coach.slice(-60) }));
  const bad = errs.filter(e => !ignorable(e));
  chk('ページエラーなし（監督）', bad.length === 0, JSON.stringify(bad.slice(0, 3)));
  await ctx.close();
}

// ④ 承認されたコーチはそのまま指導の予定が使える
{
  const ctx = await context({ email: 'takahashi@example.com', name: '高橋 祐樹', device: mob(360) });
  const page = await ctx.newPage();
  await hubReady(page);
  const v = await page.evaluate(() => ({ url: location.pathname, name: document.getElementById('header-user-name').textContent, coach: !!FCOjima.Hub.Coaching.myCoach(FCOjima.Auth.currentUserProfile), todo: (document.querySelector('#hub-home .hh-link') || {}).textContent || '' }));
  chk('承認されたコーチは名簿の名前で入り、指導の予定（都合）がやることに出る', v.url === '/hub/index.html' && v.name === '高橋 コーチ' && v.coach && /指導の都合/.test(v.todo), JSON.stringify(v));
  await ctx.close();
}

// ②③⑧ 保護者（小川）: やることからその場で出欠、参加予定・予定の詳細でも答えられる、乗る車
{
  const ctx = await context({ email: 'ogawa@example.com', name: '小川 恵', device: mob(360) });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  await hubReady(page);
  await page.waitForSelector('#hub-home .hh-att .hh-row', { timeout: 10000 });
  const h = await page.evaluate(() => ({
    head: document.querySelector('#hub-home .hh-att .hh-head').textContent.replace(/\s+/g, ''),
    rows: [...document.querySelectorAll('#hub-home .hh-att .hh-row')].map(r => { const ev = r.closest('.hh-ev'); return ev.querySelector('.hh-row-title').textContent.replace(/\s*›$/, '') + '|' + r.querySelector('.hh-row-sub').textContent + '|' + (ev.querySelector('.hh-dl') || {}).textContent + '|' + [...r.querySelectorAll('.me-ans-btn')].map(b => b.textContent).join('/'); }),
    badge: document.getElementById('my-events-badge').textContent,
    admin: getComputedStyle(document.getElementById('admin-tab')).display
  }));
  chk('保護者が開くと、やることに未回答の出欠が子どもの名前・締切と「参加／不参加」付きで出る（参加予定タブに件数）', h.head === '📝出欠の回答未回答3件' && h.rows.length === 3 && /^笠懸カップ\|小川 悠真\|締切 \d+\/\d+\|参加\/不参加$/.test(h.rows[0]) && h.badge === '3' && h.admin === 'none', JSON.stringify(h));
  await page.screenshot({ path: 'fd-parent-top.png' });
  const ov = await page.evaluate(overflow, '#hub-home');
  chk('360px でやることがはみ出さない', ov.length === 0, JSON.stringify(ov));
  // その場で「参加」
  await page.locator('#hub-home .hh-att .hh-ev', { hasText: '笠懸カップ' }).locator('.me-ans-present').tap();
  await page.waitForFunction(() => !/笠懸カップ/.test((document.querySelector('#hub-home') || {}).textContent || ''), null, { timeout: 10000 });
  let a = await att(E1);
  const h2 = await page.evaluate(() => ({ head: ((document.querySelector('#hub-home .hh-att .hh-head') || {}).textContent || '').replace(/\s+/g, ''), badge: document.getElementById('my-events-badge').textContent }));
  chk('「参加」を押すとすぐ保存され（ほかの人の回答は消えない）、やることから消えて件数が減る', a['小川 悠真'] === 'present' && a['工藤 颯'] === 'present' && a['加藤 樹'] === 'absent' && /未回答2件/.test(h2.head) && h2.badge === '2', JSON.stringify({ a, h2 }));
  // 参加予定タブ
  await page.tap('#my-events-tab');
  await page.waitForSelector('#my-events-list .me-kid-row', { timeout: 8000 });
  const cards = await page.evaluate(() => [...document.querySelectorAll('#my-events-list .me-card')].map(c => c.querySelector('.me-title').textContent + '|' + [...c.querySelectorAll('.me-kid-row')].map(r => r.querySelector('.me-kid').textContent + '|' + [...r.querySelectorAll('.me-ans-btn.is-on')].map(b => b.textContent).join('')).join(';')));
  chk('参加予定のカードでも子どもごとに「参加／不参加」（答えた方が塗られる）', cards[0] === '笠懸カップ|小川 悠真|参加' && cards[1] === '練習|小川 悠真未回答|', JSON.stringify(cards));
  await page.locator('#my-events-list .me-card', { hasText: '練習' }).locator('.me-ans-absent').tap();
  await page.waitForFunction(() => { const c = [...document.querySelectorAll('#my-events-list .me-card')].find(x => /練習/.test(x.textContent)); return c && c.classList.contains('me-all-absent') && c.querySelector('.me-ans-absent.is-on'); }, null, { timeout: 10000 });
  a = await att(E2);
  chk('「不参加」にしても予定は消えず（薄く出る）、答え直せる', a['小川 悠真'] === 'absent', JSON.stringify(a));
  await page.locator('#my-events-list .me-card', { hasText: '練習' }).locator('.me-ans-present').tap();
  await page.waitForFunction(() => { const c = [...document.querySelectorAll('#my-events-list .me-card')].find(x => /練習/.test(x.textContent)); return c && !c.classList.contains('me-all-absent') && c.querySelector('.me-ans-present.is-on'); }, null, { timeout: 10000 });
  chk('答え直すと保存される', (await att(E2))['小川 悠真'] === 'present', '');
  const changes = await page.evaluate(() => document.getElementById('my-events-changes').textContent);
  chk('自分で答えた分は「前回から変わった点」に出ない', !/参加がなくなりました/.test(changes), changes);
  // 乗る車
  await put(`${T}/eventData/${E1}`, Object.assign(await get(`${T}/eventData/${E1}`), {
    assignments: [{ carIndex: 0, driver: '小川 恵', seats: { '助手席': { 0: '工藤 颯' }, '中列': { 0: '小川 悠真' }, '後列': {} } }]
  }));
  await page.evaluate(() => FCOjima.Hub.MyEvents.refresh().then(() => FCOjima.Hub.MyEvents.renderList(false)));
  await page.waitForFunction(() => /🚗 小川 恵さんの車/.test(document.getElementById('my-events-list').textContent), null, { timeout: 8000 });
  chk('座席が決まると、参加予定のカードに乗る車（「🚗 〇〇さんの車」）が出る', true, '');
  await page.screenshot({ path: 'fd-parent-myevents.png', fullPage: true });
  // 予定の詳細
  await page.evaluate(id => FCOjima.Hub.Calendar.showEventDetails(id), E1);
  await page.waitForSelector('#event-details-content .ed-mine .me-ans-btn', { timeout: 8000 });
  const det = await page.evaluate(() => ({ mine: document.querySelector('.ed-mine').textContent.replace(/\s+/g, ''), on: [...document.querySelectorAll('.ed-mine .me-ans-btn.is-on')].map(b => b.textContent) }));
  chk('予定の詳細の出欠確認の上に「お子さんの出欠」（答え・乗る車）', /お子さんの出欠/.test(det.mine) && /小川悠真/.test(det.mine) && /🚗小川恵さんの車/.test(det.mine) && JSON.stringify(det.on) === '["参加"]', JSON.stringify(det));
  await page.tap('.ed-mine .me-ans-absent');
  await page.waitForFunction(() => document.querySelector('.ed-mine .me-ans-absent.is-on'), null, { timeout: 10000 });
  chk('予定の詳細から答えても保存され、詳細が出し直される', (await att(E1))['小川 悠真'] === 'absent', '');
  await page.evaluate(() => FCOjima.UI.closeModal('event-details-modal'));
  const bad = errs.filter(e => !ignorable(e) && !/permission/i.test(e));
  chk('ページエラーなし（保護者）', bad.length === 0, JSON.stringify(bad.slice(0, 3)));
  await ctx.close();
}

// ② 2人の保護者が同時に答えても消し合わない
{
  const c1 = await context({ email: 'ogawa@example.com', name: '小川 恵', device: mob(390) });
  const c2 = await context({ email: 'kimura@example.com', name: '木村 由美', device: mob(390) });
  const p1 = await c1.newPage(), p2 = await c2.newPage();
  await hubReady(p1); await hubReady(p2);
  await p2.evaluate(id => FCOjima.Hub.MyEvents.answer(id, '木村 大和', 'present'), E3);
  await p1.evaluate(id => FCOjima.Hub.MyEvents.answer(id, '小川 悠真', 'absent'), E3);
  const a = await att(E3);
  chk('2人の保護者が同じ予定に続けて答えても、両方の回答が残る（出欠表を開く前でも）', a['木村 大和'] === 'present' && a['小川 悠真'] === 'absent', JSON.stringify(a));
  await c1.close(); await c2.close();
}

// ⑤⑥⑦ 配車の画面（保護者）
{
  const ctx = await context({ email: 'kimura@example.com', name: '木村 由美', device: mob(390) });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  await page.goto(BASE + '/carpool/index.html?event=' + E2);
  await page.waitForFunction(() => /出欠/.test((document.getElementById('status-summary') || {}).textContent || ''), null, { timeout: 20000 });
  await page.waitForTimeout(500);
  const ovc = await page.evaluate(() => document.querySelector('#status-summary .ov-card').textContent.replace(/\s+/g, ''));
  chk('配車の概要: 出欠表をまだ誰も開いていなくても、対象（対象学年の選手）を数える（以前は 0/0）', /出欠1\/5/.test(ovc), ovc);
  await page.goto(BASE + '/carpool/attendance.html?event=' + E2);
  await page.waitForSelector('#attendance-table tbody tr td', { timeout: 20000 });
  await page.waitForTimeout(800);
  const at = await page.evaluate(() => ({ first: document.querySelector('#attendance-table tbody tr').textContent, mine: [...document.querySelectorAll('#attendance-table tr.att-mine')].length, save: !!document.getElementById('save-attendance'), note: (document.querySelector('.att-autosave-note') || {}).textContent || '' }));
  chk('出欠ページ: 自分の子が一番上に「お子さん」付きで出る。保存ボタンはなく「選ぶとその場で保存」と出る', /^木村 大和お子さん/.test(at.first) && at.mine === 1 && !at.save && /その場で保存/.test(at.note), JSON.stringify(at));
  await page.screenshot({ path: 'fd-attendance.png' });
  await page.goto(BASE + '/carpool/cars.html?event=' + E2);
  await page.waitForFunction(() => FCOjima.Carpool._base && document.getElementById('car-stats'), null, { timeout: 20000 });
  await page.waitForTimeout(600);
  const pn = await page.inputValue('#parentName');
  chk('車提供: 運転者に自分の名前が最初から入る', pn === '木村 由美', pn);
  await page.tap('#register-car');
  await page.waitForTimeout(800);
  const d = await get(`${T}/eventData/${E2}`);
  await page.reload();
  await page.waitForFunction(() => FCOjima.Carpool._base && document.getElementById('car-stats'), null, { timeout: 20000 });
  await page.waitForTimeout(600);
  chk('登録すると保存され、次に開いたときは（もう出しているので）空になる', d && d.carRegistrations.some(c => c.parent === '木村 由美') && await page.inputValue('#parentName') === '', JSON.stringify(d && d.carRegistrations));
  const share = await page.evaluate(() => FCOjima.Carpool.pageUrl('attendance.html'));
  chk('共有の文のリンクは LINE で押しても Safari・Chrome で開く', share.endsWith('/carpool/attendance.html?event=' + '1900000400002' + '&openExternalBrowser=1'), share);
  const bad = errs.filter(e => !ignorable(e) && !/permission/i.test(e));
  chk('ページエラーなし（配車の画面）', bad.length === 0, JSON.stringify(bad.slice(0, 3)));
  await ctx.close();
}
await closeBrowser();
process.exit(summary() ? 1 : 0);
