// はじめて使う人の導線（続き）: 連絡の新着・予定ごとの連絡、リスト表示・わが子の切り替え、ホーム画面に追加、承認の知らせ
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors } from './lib.mjs';
await wipe();
const jst = new Date(Date.now() + 9 * 3600e3);
const iso = d => d.toISOString().slice(0, 10);
const plus = n => { const x = new Date(jst); x.setUTCDate(x.getUTCDate() + n); return iso(x); };
const TODAY = plus(0), D1 = plus(1), DM1 = plus(-1);
const nextMonth = (() => { const x = new Date(jst); x.setUTCDate(1); x.setUTCMonth(x.getUTCMonth() + 1); x.setUTCDate(10); return iso(x); })();
const pastInMonth = DM1.slice(0, 7) === TODAY.slice(0, 7);
const ymd = s => s.replace(/-/g, '/');
await put(`${T}/members/p31`, { name: '小川 悠真', role: 'player', grade: '3' });
await put(`${T}/members/p51`, { name: '佐々木 陸', role: 'player', grade: '5' });
await put(`${T}/members/f31`, { name: '小川 恵', role: 'mother', childrenIds: ['p31'] });
await put(`${T}/members/c1`, { name: '佐藤 監督', role: 'coach', abbr: '佐藤' });
const E1 = '1900000500001', E2 = '1900000500002', E3 = '1900000500003', E4 = '1900000500004';
await put(`${T}/events/${E1}`, { title: '3年の試合', date: D1, type: 'game', target: ['3'], startTime: '09:00' });
await put(`${T}/events/${E2}`, { title: '5年の練習', date: D1, type: 'practice', target: ['5'], startTime: '13:00' });
await put(`${T}/events/${E3}`, { title: '来月の大会', date: nextMonth, type: 'game', target: ['3'] });
if (pastInMonth) await put(`${T}/events/${E4}`, { title: '昨日の練習', date: DM1, type: 'practice', target: ['3'] });
// 連絡: チームの連絡事項（10日前・今日）、予定ごとの連絡（3年の試合）
const tenDaysAgo = new Date(Date.now() - 10 * 86400e3);
await put(`${T}/notifications/n1`, { date: tenDaysAgo.toISOString().slice(0, 10).replace(/-/g, '/') + ' 10:00', text: '前の連絡', user: '佐藤 監督' });
await put(`${T}/notifications/n2`, { date: ymd(TODAY) + ' 08:00', text: '今週の予定を確認してください', user: '佐藤 監督' });
await put(`${T}/eventData/${E1}`, { notifications: [{ date: TODAY, text: '集合は7時半に変更です', type: 'info', user: '佐藤 監督' }] });
await makeUser('kantoku@example.com', '佐藤 監督', 'coach');
await makeUser('ogawa@example.com', '小川 恵', 'parent', { childrenIds: ['p31'] });
const mob = (w) => ({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const ignorable = e => /favicon|ERR_|Failed to load resource|open-meteo|gsi|storage/i.test(e);
const hubReady = async (page) => {
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(1800);
};
const badge = (page, id) => page.evaluate(i => document.getElementById(i).textContent, id);

// ⑩ 連絡の新着（保護者）
{
  const ctx = await context({ email: 'ogawa@example.com', name: '小川 恵', device: mob(360) });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  await hubReady(page);
  const v = await page.evaluate(() => ({ badge: document.getElementById('notif-badge').textContent, todo: [...document.querySelectorAll('#hub-home .hh-link')].map(b => b.textContent.replace(/\s+/g, '')) }));
  chk('はじめて開くと、7日以内のチームの連絡事項と予定ごとの連絡が新着（連絡事項タブに件数・やることに「新しい連絡」）', v.badge === '2' && v.todo.some(t => /📣新しい連絡2件見る›/.test(t)), JSON.stringify(v));
  await page.tap('#my-events-tab');
  await page.waitForSelector('#my-events-list .me-notes', { timeout: 8000 });
  const ml = await page.evaluate(() => ({ text: document.querySelector('#my-events-list .me-notes').textContent, href: document.querySelector('#my-events-list .me-notes').getAttribute('href'), cls: document.querySelector('#my-events-list .me-notes').className }));
  chk('参加予定のカードに「この予定の連絡 N件（新着）」（押すとその予定の連絡のページ）', /📣 この予定の連絡 1件（新着 1）/.test(ml.text) && /has-new/.test(ml.cls) && ml.href === '../carpool/notifications.html?event=1900000500001', JSON.stringify(ml));
  // 連絡事項タブ
  await page.locator('#hub-home').evaluate(() => {}); // noop
  await page.tap('#notifications-tab');
  await page.waitForSelector('#hub-event-notes .event-note-card', { timeout: 8000 });
  const n = await page.evaluate(() => ({
    ev: document.querySelector('#hub-event-notes .event-note-card').textContent.replace(/\s+/g, ''),
    team: [...document.querySelectorAll('#notificationsList .notification-card')].map(c => c.querySelector('.notification-content').textContent + (c.classList.contains('is-new') ? '*' : '')),
    badge: document.getElementById('notif-badge').textContent
  }));
  chk('連絡事項タブに「予定ごとの連絡」（予定・新着・本文・その予定の連絡へのリンク）と、チームの連絡事項の新着の印', /3年の試合新着1/.test(n.ev) && /集合は7時半に変更です/.test(n.ev) && /この予定の連絡を見る・書く›/.test(n.ev) && JSON.stringify(n.team) === JSON.stringify(['今週の予定を確認してください*', '前の連絡']), JSON.stringify(n));
  chk('連絡事項タブを開くと既読になり、件数が消える', n.badge === '' && await page.evaluate(() => !/新しい連絡/.test(document.getElementById('hub-home').textContent)), n.badge);
  await page.screenshot({ path: 'fd2-notes.png', fullPage: true });
  // 自分が書いた連絡は新着にしない
  await page.fill('#notificationText', '明日は雨具を持ってきてください');
  await page.tap('#send-notification');
  await page.waitForTimeout(800);
  await hubReady(page);
  chk('読んだ連絡・自分が書いた連絡は、開き直しても新着にならない', await badge(page, 'notif-badge') === '', await badge(page, 'notif-badge'));
  // 新しい予定ごとの連絡 → 予定の詳細で読む
  const ed = await get(`${T}/eventData/${E1}`);
  ed.notifications.unshift({ date: TODAY, text: 'ビブスを持ってきてください', type: 'info', user: '佐藤 監督' });
  await put(`${T}/eventData/${E1}`, ed);
  await hubReady(page);
  chk('ほかの人が予定ごとの連絡を書くと、また新着になる', await badge(page, 'notif-badge') === '1', await badge(page, 'notif-badge'));
  await page.evaluate(id => FCOjima.Hub.Calendar.showEventDetails(id), E1);
  await page.waitForSelector('#event-details-content .ed-notes', { timeout: 8000 });
  const d = await page.evaluate(() => ({ text: document.querySelector('.ed-notes').textContent.replace(/\s+/g, ''), newCount: document.querySelectorAll('.ed-notes .ed-note.is-new').length }));
  chk('予定の詳細に「この予定の連絡」（新しい順・新着の印・見る・書くリンク）。見たら件数が消える', /📣この予定の連絡2件/.test(d.text) && d.text.indexOf('ビブス') < d.text.indexOf('集合は7時半') && d.newCount === 1 && /連絡を見る・書く›/.test(d.text) && await badge(page, 'notif-badge') === '', JSON.stringify(d));
  await page.evaluate(() => FCOjima.UI.closeModal('event-details-modal'));
  // 配車のページの上の「連絡」
  ed.notifications.unshift({ date: TODAY, text: '駐車場は第2です', type: 'info', user: '佐藤 監督' });
  await put(`${T}/eventData/${E1}`, ed);
  await page.goto(BASE + '/carpool/index.html?event=' + E1);
  await page.waitForFunction(() => document.querySelector('.carpool-nav a[href="notifications.html"] .nav-badge'), null, { timeout: 20000 });
  const nb = await page.evaluate(() => document.querySelector('.carpool-nav a[href="notifications.html"] .nav-badge').textContent);
  await page.goto(BASE + '/carpool/notifications.html?event=' + E1);
  await page.waitForFunction(() => /駐車場は第2です/.test(document.getElementById('notificationsList').textContent), null, { timeout: 20000 });
  await page.waitForTimeout(400);
  const nb2 = await page.evaluate(() => !!document.querySelector('.carpool-nav a[href="notifications.html"] .nav-badge'));
  chk('配車のページの上の「連絡」に新着の件数。連絡のページを開くと消える', nb === '1' && !nb2, JSON.stringify({ nb, nb2 }));
  await hubReady(page);
  chk('配車の連絡のページで読んだ分は、HUB でも新着にならない', await badge(page, 'notif-badge') === '', await badge(page, 'notif-badge'));

  // ⑪ リスト表示・わが子の切り替え
  await page.tap('#list-view');
  await page.waitForTimeout(400);
  const l = await page.evaluate(() => ({
    heads: [...document.querySelectorAll('#events-list .date-heading')].map(h => h.dataset.date),
    empties: document.querySelectorAll('#events-list .event-item.empty').length,
    toggle: (document.querySelector('#events-list .list-past-toggle') || {}).textContent || '',
    items: [...document.querySelectorAll('#events-list .event-item:not(.empty) .event-title')].map(e => e.textContent)
  }));
  const today = await page.evaluate(() => FCOjima.Utils.formatDate(new Date()));
  chk('リスト表示は予定のある日だけで、今月は今日から（「予定なし」の日は出ない）', l.empties === 0 && l.heads.every(d => d >= today) && l.heads.includes(await page.evaluate(() => FCOjima.Utils.formatDate(new Date(Date.now() + 86400000)))) && (!pastInMonth || /今日より前の予定も見る（1件）/.test(l.toggle)), JSON.stringify(l));
  if (pastInMonth) {
    await page.tap('#events-list .list-past-toggle');
    await page.waitForTimeout(300);
    const items2 = await page.evaluate(() => [...document.querySelectorAll('#events-list .event-item:not(.empty) .event-title')].map(e => e.textContent));
    chk('「今日より前の予定も見る」で前の予定も出る', items2.some(t => /昨日の練習/.test(t)), JSON.stringify(items2));
  }
  const f0 = await page.evaluate(() => ({ text: document.getElementById('my-child-filter').textContent, shown: getComputedStyle(document.getElementById('my-child-filter')).display !== 'none' }));
  await page.tap('#my-child-filter');
  await page.waitForTimeout(400);
  const f1 = await page.evaluate(() => ({ text: document.getElementById('my-child-filter').textContent, pressed: document.getElementById('my-child-filter').getAttribute('aria-pressed'), items: [...document.querySelectorAll('#events-list .event-item:not(.empty) .event-title')].map(e => e.textContent) }));
  chk('「☐ わが子だけ」を押すと「☑」になり、子どもが対象の予定だけになる', f0.shown && f0.text === '☐ わが子だけ' && f1.text === '☑ わが子だけ' && f1.pressed === 'true' && f1.items.some(t => /3年の試合/.test(t)) && !f1.items.some(t => /5年の練習/.test(t)), JSON.stringify({ f0, f1 }));
  await page.screenshot({ path: 'fd2-list.png' });
  const bad = errs.filter(e => !ignorable(e) && !/permission/i.test(e));
  chk('ページエラーなし（保護者）', bad.length === 0, JSON.stringify(bad.slice(0, 3)));
  await ctx.close();
}

// ⑪ 子どものいない人には「わが子だけ」を出さない／⑫ スマホのブラウザ以外では「ホーム画面に追加」は出ない
{
  const ctx = await context({ email: 'kantoku@example.com', name: '佐藤 監督', device: mob(390) });
  const page = await ctx.newPage();
  await hubReady(page);
  const v = await page.evaluate(() => ({ filter: getComputedStyle(document.getElementById('my-child-filter')).display, a2hs: !!document.querySelector('#hub-home .hh-a2hs') }));
  chk('子どものいない監督には「わが子だけ」は出ない。スマホのブラウザでなければ「ホーム画面に追加」も出ない', v.filter === 'none' && !v.a2hs, JSON.stringify(v));
  await ctx.close();
}

// ⑫ iPhone の Safari ではじめて開くと「ホーム画面に追加」の案内（閉じたら出さない）
{
  const ctx = await context({ email: 'ogawa@example.com', name: '小川 恵', device: 'iPhone 13' });
  const page = await ctx.newPage();
  await hubReady(page);
  const a = await page.evaluate(() => (document.querySelector('#hub-home .hh-a2hs') || {}).textContent || '');
  chk('iPhone のブラウザで開くと、一番上に「ホーム画面に追加」の案内（共有ボタン →「ホーム画面に追加」）', /ホーム画面に追加しておくと便利です/.test(a) && /共有ボタン/.test(a), a.replace(/\s+/g, '').slice(0, 80));
  await page.screenshot({ path: 'fd2-a2hs.png' });
  await page.tap('#hub-home .hh-a2hs-close');
  await page.waitForTimeout(300);
  const gone = await page.evaluate(() => !document.querySelector('#hub-home .hh-a2hs'));
  await hubReady(page);
  chk('「閉じる（次から出さない）」で消え、開き直しても出ない', gone && await page.evaluate(() => !document.querySelector('#hub-home .hh-a2hs')), '');
  await ctx.close();
}

// ⑬ 承認したら本人に知らせる
{
  const pctx = await context({ email: 'newmom@example.com', name: '新しい 保護者', device: mob(360) });
  const pp = await pctx.newPage();
  await pp.goto(BASE + '/hub/index.html');
  await pp.waitForURL(/register/, { timeout: 15000 });
  await pp.fill('#reg-name', '新井 さくら');
  await pp.fill('#reg-kana', 'アライ サクラ');
  await pp.tap('button[type="submit"]');
  await pp.waitForURL(/pending/, { timeout: 15000 });
  const pm = await pp.textContent('.pending-msg');
  chk('承認待ちの画面: 承認されると監督・役員から LINE などで知らせが届くと書いてある', /LINE などで/.test(pm) && /お知らせが届きます/.test(pm), pm.replace(/\s+/g, ''));
  await pctx.close();
  const ctx = await context({ email: 'kantoku@example.com', name: '佐藤 監督', device: mob(390) });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  await hubReady(page);
  await page.evaluate(() => document.getElementById('admin-tab').click());
  await page.waitForSelector('#pending-users-list .approve-btn', { timeout: 10000 });
  await page.tap('#pending-users-list .approve-btn');
  await page.waitForSelector('#approved-notice-modal .approved-notice-text', { state: 'visible', timeout: 8000 });
  const msg = await page.inputValue('#approved-notice-modal .approved-notice-text');
  chk('承認すると「LINEで知らせる・文をコピー」が出て、文には名前・承認したこと・LINE で押しても開けるリンク', /^新井 さくらさん\n/.test(msg) && /承認しました/.test(msg) && /\/hub\/index\.html\?openExternalBrowser=1$/.test(msg), msg);
  await page.screenshot({ path: 'fd2-approved.png' });
  await page.tap('#approved-notice-modal .approved-notice-copy');
  await page.waitForTimeout(400);
  chk('「文をコピー」でその文がコピーされる', await page.evaluate(() => navigator.clipboard.readText()) === msg, '');
  await ctx.close();
}
await closeBrowser();
process.exit(summary() ? 1 : 0);
