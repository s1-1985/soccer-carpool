// 役割と権限（画面）: 権限の設定の画面（自分より下の欄だけ・管理者の欄は固定）、承認・役割の選択肢、
// 監督の指定と引き継ぎ、管理者だけのログの削除、権限に合わせたボタンの出し分け
import { put, get, list, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors } from './lib.mjs';
await wipe();
const jst = new Date(Date.now() + 9 * 3600e3);
const iso = d => d.toISOString().slice(0, 10);
const plus = n => { const x = new Date(jst); x.setUTCDate(x.getUTCDate() + n); return iso(x); };
await put(`${T}/members/c1`, { name: '佐藤 監督', role: 'coach' });
await put(`${T}/members/c2`, { name: '鈴木 コーチ', role: 'assist' });
await put(`${T}/members/o1`, { name: '役員 一郎', role: 'officer' });
await put(`${T}/members/f1`, { name: '保護者 一', role: 'father', childrenIds: ['p1'] });
await put(`${T}/members/p1`, { name: '三年 太郎', role: 'player', grade: '3' });
const E1 = '1900000120001';
await put(`${T}/events/${E1}`, { title: '練習試合', date: plus(2), type: 'game', target: ['3'], startTime: '09:00' });
const A = await makeUser('pu-admin@example.com', '管理 太郎', 'admin');
const K = await makeUser('pu-kantoku@example.com', '佐藤 監督', 'coach');
const C = await makeUser('pu-coach@example.com', '鈴木 コーチ', 'assist');
const O = await makeUser('pu-officer@example.com', '役員 一郎', 'officer');
const P = await makeUser('pu-parent@example.com', '保護者 一', 'parent', { childrenIds: ['p1'] });
const S = await makeUser('pu-stray@example.com', '古い 監督', 'coach');
await makeUser('pu-new@example.com', '新人 コーチ', 'parent', { status: 'pending', requestedRole: 'coach', kana: 'シンジン コーチ', childrenIds: [], childrenNames: [] });
await put(`${T}/settings/roles`, { kantoku: K });
await put(`${T}/notifications/n-admin`, { date: plus(0).replace(/-/g, '/') + ' 08:00', text: '管理者からの連絡', user: '管理 太郎', uid: A, byAdmin: true });
await put(`${T}/notifications/n-parent`, { date: plus(0).replace(/-/g, '/') + ' 09:00', text: '保護者からの連絡', user: '保護者 一', uid: P });
const now = new Date().toISOString();
await put(`${T}/logs/lg1`, { datetime: now, type: 'calendar', action: 'イベント追加', details: '「練習試合」', user: '佐藤 監督' });
await put(`${T}/logs/lg2`, { datetime: now, type: 'calendar', action: 'イベント更新', details: '「練習試合」', user: '佐藤 監督' });
await put(`${T}/logs/lg3`, { datetime: now, type: 'members', action: 'メンバー追加', details: '「x」', user: '佐藤 監督' });

const mob = (w) => ({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const ignorable = e => /favicon|ERR_|Failed to load resource|open-meteo|gsi|storage|QRCode/i.test(e);
const hubReady = async (page) => {
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
};
const pageOverflow = () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;

// 1) 役員
{
  const ctx = await context({ email: 'pu-officer@example.com', name: '役員 一郎', device: mob(360) });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  page.on('dialog', d => d.accept());
  await hubReady(page);
  await page.tap('#admin-tab');
  await page.waitForSelector('#pending-users-list .pending-card', { timeout: 10000 });
  const tiles = await page.evaluate(() => [...document.querySelectorAll('#admin .admin-tile')].filter(b => b.style.display !== 'none').map(b => b.id));
  chk('役員の管理タブに「権限の設定」が出る（初期値ではほかのボタンも全部）', tiles.length === 9 && tiles.includes('btn-permissions'), JSON.stringify(tiles));
  const ap = await page.evaluate(() => [...document.querySelector('#pending-users-list .pending-card .pending-role-select').options].map(o => o.textContent + (o.selected ? '*' : '')));
  chk('承認カードの役割は、役員が付けられるものだけ（保護者・役員）。コーチの申請でも初期値は保護者', JSON.stringify(ap) === JSON.stringify(['保護者*', '役員']), JSON.stringify(ap));
  await page.tap('#btn-all-users');
  await page.waitForSelector('#all-users-list .kantoku-box', { timeout: 10000 });
  const ul = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#all-users-list > div')].filter(r => r.querySelector('select') && !r.classList.contains('kantoku-box'));
    const by = {};
    rows.forEach(r => { const n = r.firstElementChild.firstElementChild.textContent; const s = r.querySelector('select'); by[n] = { opts: [...s.options].map(o => o.textContent), disabled: s.disabled }; });
    return { box: document.querySelector('.kantoku-box').textContent, by };
  });
  chk('登録済みユーザー: 監督の欄にいまの監督。役員には指定・指名のボタンがない', /佐藤 監督/.test(ul.box) && !/監督に指定する|次の監督に指名する/.test(ul.box), ul.box);
  chk('役員は保護者を「保護者・役員」にだけ変えられ、コーチ・監督・管理者の行は変えられない',
    JSON.stringify(ul.by['保護者 一'].opts) === JSON.stringify(['役員', '保護者']) && !ul.by['保護者 一'].disabled
    && ul.by['鈴木 コーチ'].disabled && ul.by['佐藤 監督'].disabled && ul.by['管理 太郎'].disabled, JSON.stringify(ul.by));
  await page.evaluate(() => { document.getElementById('all-users-modal').style.display = 'none'; });

  // 権限の設定
  await page.tap('#btn-permissions');
  await page.waitForSelector('#perm-settings-modal .ps-toggle', { timeout: 10000 });
  const ps = await page.evaluate(() => {
    const cell = (role, key) => document.querySelector(`#perm-settings-modal .ps-toggle[data-role="${role}"][data-key="${key}"]`);
    const enabled = [...document.querySelectorAll('#perm-settings-modal .ps-toggle:not([disabled])')].map(b => b.dataset.role);
    const adminCells = [...document.querySelectorAll('#perm-settings-modal .ps-toggle[data-role="admin"]')];
    return {
      enabledRoles: [...new Set(enabled)], adminAll: adminCells.length === 13 && adminCells.every(b => b.disabled && b.classList.contains('is-on')),
      parentApprove: !cell('parent', 'approve'), parentEvents: cell('parent', 'events') && cell('parent', 'events').classList.contains('is-on'),
      rules: document.querySelector('#perm-settings-modal .ps-rules').textContent
    };
  });
  chk('権限の設定: 役員が変えられるのは保護者の欄だけ。管理者の欄は全部 ✓ で変えられない。保護者には承認を付けられない',
    JSON.stringify(ps.enabledRoles) === '["parent"]' && ps.adminAll && ps.parentApprove && ps.parentEvents && /監督は1人だけ/.test(ps.rules), JSON.stringify(ps));
  await page.tap('#perm-settings-modal .ps-toggle[data-role="parent"][data-key="events"]');
  await page.waitForFunction(() => !document.querySelector('#perm-settings-modal .ps-toggle[data-role="parent"][data-key="events"]').classList.contains('is-on'), null, { timeout: 8000 });
  const saved = await get(`${T}/settings/permissions`);
  chk('押すとすぐ保存される（保護者の「予定」を外す）', saved && saved.parent && saved.parent.events === false, JSON.stringify(saved));
  chk('360px でページが横にはみ出さない（権限の表）', !(await page.evaluate(pageOverflow)), '');
  await page.evaluate(() => { document.getElementById('perm-settings-modal').style.display = 'none'; });

  // 連絡事項: 管理者が書いたものは消せない・保護者のものは消せる
  await page.tap('#notifications-tab');
  await page.waitForTimeout(1200);
  const del = await page.evaluate(() => [...document.querySelectorAll('#notificationsList .notification-card')].map(c => c.querySelector('.notification-content').textContent + ':' + !!c.querySelector('[data-action="delete"]')));
  chk('役員の画面: 管理者が書いた連絡には削除ボタンがなく、保護者の連絡にはある', del.includes('管理者からの連絡:false') && del.includes('保護者からの連絡:true'), JSON.stringify(del));
  // ログ: 見られるが消せない
  await page.tap('#defaultTab');
  await page.evaluate(() => FCOjima.Hub.openLogsModal('calendar'));
  await page.waitForTimeout(400);
  const lg = await page.evaluate(() => ({ n: document.querySelectorAll('#logs-content .log-item').length, del: document.querySelectorAll('#logs-content .log-delete').length, all: !!document.querySelector('.log-delete-all') }));
  chk('役員はログを見られるが、削除ボタンはない', lg.n === 2 && lg.del === 0 && !lg.all, JSON.stringify(lg));
  const real = errs.filter(e => !ignorable(e));
  chk('役員の画面でページエラーなし', real.length === 0, real.join(' | '));
  await ctx.close();
}

// 2) 保護者（予定の権限を外された）
{
  const ctx = await context({ email: 'pu-parent@example.com', name: '保護者 一', device: mob(390) });
  const page = await ctx.newPage();
  await hubReady(page);
  const v = await page.evaluate(() => ({ add: getComputedStyle(document.getElementById('add-event')).display, can: FCOjima.Auth.can('events') }));
  await page.evaluate(() => document.querySelector('#calendar-grid .calendar-day.today').click());
  await page.waitForTimeout(500);
  const opened = await page.evaluate(() => ({ add: document.getElementById('event-modal').style.display, day: document.getElementById('day-events-modal').style.display }));
  await page.evaluate(() => FCOjima.UI.closeModal('day-events-modal'));
  await page.evaluate(id => FCOjima.Hub.Calendar.showEventDetails(id), E1);
  await page.waitForTimeout(1200);
  const ed = await page.evaluate(() => ({ edit: getComputedStyle(document.getElementById('edit-event')).display, del: getComputedStyle(document.getElementById('delete-event')).display }));
  chk('予定の権限を外された保護者には「予定を追加」が出ず、日付を押すとその日の予定の一覧が開く', v.add === 'none' && !v.can && !['block', 'flex'].includes(opened.add) && opened.day === 'flex', JSON.stringify({ v, opened }));
  chk('予定の詳細に編集・削除が出ない', ed.edit === 'none' && ed.del === 'none', JSON.stringify(ed));
  await ctx.close();
}

// 3) 管理者: 監督の指定（「監督」の役割の人が2人いる）、ログの削除、監督の欄の権限
{
  const ctx = await context({ email: 'pu-admin@example.com', name: '管理 太郎', device: null });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  page.on('dialog', d => d.accept());
  await hubReady(page);
  await page.click('#admin-tab');
  await page.click('#btn-all-users');
  await page.waitForSelector('#all-users-list .kantoku-box .kantoku-select', { timeout: 10000 });
  const box = await page.evaluate(() => document.querySelector('.kantoku-box').textContent);
  chk('管理者の画面: 「監督」の役割の人がほかにもいれば知らせる', /古い 監督/.test(box) && /1人指定/.test(box), box);
  await page.selectOption('#all-users-list .kantoku-select', C);
  await page.click('#all-users-list .kantoku-btn');
  await page.waitForTimeout(2500);
  const roles = { k: (await get(`${T}/users/${K}`)).role, c: (await get(`${T}/users/${C}`)).role, s: (await get(`${T}/users/${S}`)).role, rec: (await get(`${T}/settings/roles`)).kantoku };
  chk('管理者が監督を指定すると、前の監督・ほかの「監督」の人はコーチになる', roles.c === 'coach' && roles.k === 'assist' && roles.s === 'assist' && roles.rec === C, JSON.stringify(roles));
  await page.evaluate(() => { document.getElementById('all-users-modal').style.display = 'none'; });

  await page.evaluate(() => FCOjima.Hub.openLogsModal('calendar'));
  await page.waitForSelector('#logs-content .log-delete', { timeout: 5000 });
  await page.click('#logs-content .log-delete');
  await page.waitForTimeout(1500);
  const left1 = (await list(`${T}/logs`)).map(l => l.id).sort();
  chk('管理者はログを1件ずつ消せる', left1.length === 2 && left1.includes('lg3'), JSON.stringify(left1));
  await page.click('#logs-content .log-delete-all');
  await page.waitForTimeout(1500);
  const left2 = (await list(`${T}/logs`)).map(l => l.id);
  chk('「この種類のログをすべて削除」で、その種類のログだけ消える', JSON.stringify(left2) === '["lg3"]', JSON.stringify(left2));
  await page.evaluate(() => FCOjima.UI.closeModal('logs-modal'));

  await page.click('#btn-permissions');
  await page.waitForSelector('#perm-settings-modal .ps-toggle', { timeout: 10000 });
  const en = await page.evaluate(() => [...new Set([...document.querySelectorAll('#perm-settings-modal .ps-toggle:not([disabled])')].map(b => b.dataset.role))]);
  chk('管理者は監督・コーチ・役員・保護者の欄を変えられる（管理者の欄は変えられない）', JSON.stringify(en) === '["coach","assist","officer","parent"]', JSON.stringify(en));
  await page.click('#perm-settings-modal .ps-toggle[data-role="assist"][data-key="attendance_view"]');
  await page.waitForTimeout(1200);
  chk('コーチの「出欠状況」を外せる', (await get(`${T}/settings/permissions`)).assist.attendance_view === false, '');
  const real = errs.filter(e => !ignorable(e));
  chk('管理者の画面でページエラーなし', real.length === 0, real.join(' | '));
  await ctx.close();
}

// 4) コーチになった前の監督: 出欠状況を外されたので、そのボタン・今週の予定が出ない
{
  const ctx = await context({ email: 'pu-kantoku@example.com', name: '佐藤 監督', device: null });
  const page = await ctx.newPage();
  await hubReady(page);
  const v = await page.evaluate(() => ({
    tiles: [...document.querySelectorAll('#admin .admin-tile')].filter(b => b.style.display !== 'none').map(b => b.id),
    week: !!document.querySelector('#hub-home .hh-week'), role: FCOjima.Auth.currentUserProfile.role
  }));
  chk('出欠状況の権限を外されたコーチには、出欠状況・送迎回数・参加率と今週の予定の状況が出ない',
    v.role === 'assist' && !v.tiles.includes('btn-attendance-matrix') && !v.tiles.includes('btn-driver-stats') && !v.tiles.includes('btn-attendance-rate') && v.tiles.includes('btn-permissions') && !v.week, JSON.stringify(v));
  await ctx.close();
}

// 5) 監督（指定された鈴木）が次の監督を指名する
{
  const ctx = await context({ email: 'pu-coach@example.com', name: '鈴木 コーチ', device: mob(360) });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  page.on('dialog', d => d.accept());
  await hubReady(page);
  await page.tap('#admin-tab');
  await page.tap('#btn-all-users');
  await page.waitForSelector('#all-users-list .kantoku-box .kantoku-btn', { timeout: 10000 });
  const opts = await page.evaluate(() => [...document.querySelectorAll('#all-users-list .kantoku-select option')].map(o => o.textContent));
  chk('監督の画面: 「次の監督に指名する」と、候補（自分と管理者は出ない）', !opts.some(o => /鈴木 コーチ|管理 太郎/.test(o)) && opts.some(o => /役員 一郎/.test(o)), JSON.stringify(opts));
  await page.selectOption('#all-users-list .kantoku-select', O);
  await Promise.all([page.waitForEvent('load', { timeout: 15000 }).catch(() => null), page.tap('#all-users-list .kantoku-btn')]);
  await page.waitForTimeout(2500);
  const r = { me: (await get(`${T}/users/${C}`)).role, next: (await get(`${T}/users/${O}`)).role, rec: (await get(`${T}/settings/roles`)).kantoku };
  chk('監督が次の監督を指名すると、指名された人が監督になり、自分はコーチになる', r.me === 'assist' && r.next === 'coach' && r.rec === O, JSON.stringify(r));
  await page.waitForFunction(() => window.FCOjima && FCOjima.Auth && FCOjima.Auth.currentUserProfile, null, { timeout: 30000 }).catch(() => {});
  chk('画面を読み込み直すと自分の役割はコーチ', await page.evaluate(() => FCOjima.Auth.currentUserProfile && FCOjima.Auth.currentUserProfile.role) === 'assist', '');
  const real = errs.filter(e => !ignorable(e));
  chk('監督の画面でページエラーなし', real.length === 0, real.join(' | '));
  await ctx.close();
}

await closeBrowser();
process.exit(summary() ? 1 : 0);
