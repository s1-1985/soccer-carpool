// 11巡目b: はじめての端末の「新着」（データを読む前の描き直し）・自分で答えた出欠が「前回から変わった点」に出る
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors } from './lib.mjs';
await wipe();
const jst = new Date(Date.now() + 9 * 3600e3);
const iso = d => d.toISOString().slice(0, 10);
const plus = n => { const x = new Date(jst); x.setUTCDate(x.getUTCDate() + n); return iso(x); };
const slash = d => d.replace(/-/g, '/');
await put(`${T}/members/p1`, { name: '三年 太郎', role: 'player', grade: '3' });
await put(`${T}/members/f1`, { name: '三年 母', role: 'mother', childrenIds: ['p1'] });
await put(`${T}/members/c1`, { name: '佐藤 監督', role: 'coach' });
const E1 = '1900000111001', E2 = '1900000111002', E3 = '1900000111003';
await put(`${T}/events/${E1}`, { title: '練習試合', date: plus(3), type: 'game', target: ['3'], startTime: '09:00' });
await put(`${T}/events/${E2}`, { title: '練習', date: plus(4), type: 'practice', target: ['3'], startTime: '13:00' });
await put(`${T}/events/${E3}`, { title: 'カップ戦', date: plus(5), type: 'game', target: ['3'], startTime: '08:00' });
await put(`${T}/eventData/${E3}`, { attendance: [{ name: '三年 太郎', status: 'absent', notes: '' }] });
// チームの連絡事項: 20日前（はじめての端末では読んだことにする）と昨日（新着）
await put(`${T}/notifications/n-old`, { date: slash(plus(-20)) + ' 08:00', text: '前の連絡', user: '佐藤 監督' });
await put(`${T}/notifications/n-new`, { date: slash(plus(-1)) + ' 08:00', text: '新しい連絡', user: '佐藤 監督' });
await makeUser('r11bmom@example.com', '三年 母', 'parent', { childrenIds: ['p1'] });
await makeUser('r11bkantoku@example.com', '佐藤 監督', 'coach');
const ignorable = e => /favicon|ERR_|Failed to load resource|open-meteo|gsi|storage/i.test(e);
const hubReady = async (page) => {
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
};

// 1) Android の Chrome は「ホーム画面に追加」の合図（beforeinstallprompt）をページを開いてすぐに送ってくることがある。
//    データを読み込む前にやることを描き直すと、はじめての端末の「7日より前の連絡は読んだことにする」が空の一覧で決まり、
//    3か月分の連絡事項が全部「新着」になっていた
{
  const ctx = await context({ email: 'r11bmom@example.com', name: '三年 母', device: 'Pixel 5' });
  await ctx.addInitScript(() => {
    // はじめての端末にする（context() のログインの途中で HUB が一度開き、既読の記録ができているため消す）
    if (!sessionStorage.getItem('__r11b')) {
      sessionStorage.setItem('__r11b', '1');
      Object.keys(localStorage).filter(k => /^fcojima_seen_/.test(k)).forEach(k => localStorage.removeItem(k));
    }
    const t = setInterval(() => {
      const F = window.FCOjima;
      if (F && F.Auth && F.Auth.currentUser && F.Hub && !F.Hub._loadedFromFirestore) {
        clearInterval(t);
        window.__bipFired = true;
        window.dispatchEvent(new Event('beforeinstallprompt'));
      }
      if (F && F.Hub && F.Hub._loadedFromFirestore) clearInterval(t);
    }, 5);
  });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  await hubReady(page);
  await page.waitForSelector('#hub-home .hh-card', { timeout: 10000 });
  const v = await page.evaluate(() => ({
    fired: !!window.__bipFired,
    unread: FCOjima.Hub.Notifications.unreadCount(),
    todo: [...document.querySelectorAll('#hub-home .hh-link')].map(b => b.textContent.replace(/\s+/g, '')).join('|'),
    badge: document.getElementById('notif-badge').textContent,
    a2hs: !!document.querySelector('#hub-home .hh-a2hs-install')
  }));
  chk('（前提）データを読み込む前に「ホーム画面に追加」の合図が届いた', v.fired, JSON.stringify(v));
  chk('はじめての端末でも、7日より前の連絡事項は新着にしない（データを読む前に合図が来ても）', v.unread === 1 && /新しい連絡1件/.test(v.todo) && v.badge === '1', JSON.stringify(v));
  chk('合図を受けていれば「ホーム画面に追加」ボタンが出る', v.a2hs, JSON.stringify(v));
  const real = errs.filter(e => !ignorable(e));
  chk('ページエラーなし', real.length === 0, real.join(' | '));
  await ctx.close();
}

// 2) 自分で答えた出欠は「前回から変わった点」に出さない（配車の出欠ページ＝LINE の共有リンクから答えても）
{
  const ctx = await context({ email: 'r11bmom@example.com', name: '三年 母', device: { viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true } });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  const errs = watchErrors(page);
  // 以前の形の「前回見たときの参加予定」（不参加の予定は入っていない）が端末に残っている
  await hubReady(page);
  const uid = await page.evaluate(() => FCOjimaFirebase.auth.currentUser.uid);
  await page.evaluate(({ uid, E1, E2, d1, d2 }) => {
    const snap = {};
    snap['三年 太郎|' + E1] = { d: d1, t: '練習試合', s: '09:00' };
    snap['三年 太郎|' + E2] = { d: d2, t: '練習', s: '13:00' };
    localStorage.setItem('fcojima_myevents_snap_' + uid, JSON.stringify(snap));
    Object.keys(localStorage).filter(k => /^fcojima_myevents_snap2_/.test(k)).forEach(k => localStorage.removeItem(k));
  }, { uid, E1, E2, d1: plus(3), d2: plus(4) });
  await hubReady(page);
  await page.tap('#my-events-tab');
  await page.waitForSelector('#my-events-list .me-card', { timeout: 10000 });
  const first = await page.evaluate(() => document.getElementById('my-events-changes').textContent);
  chk('以前の形の記録が残っていても、不参加と答えてある予定を「追加されました」と出さない', !/追加されました/.test(first) && !/参加がなくなりました/.test(first), first);

  // 配車の出欠ページで、自分の子を「不参加」にする
  await page.goto(BASE + '/carpool/attendance.html?event=' + E1);
  await page.waitForSelector('#attendance-table tr.att-mine .attendance-select', { timeout: 20000 });
  await page.selectOption('#attendance-table tr.att-mine .attendance-select', 'absent');
  await page.waitForTimeout(1500);
  await page.evaluate(() => FCOjima.Carpool.whenSaved());
  const a = ((await get(`${T}/eventData/${E1}`)) || {}).attendance || [];
  chk('（前提）出欠ページで答えた「不参加」が保存される', a.some(x => x.name === '三年 太郎' && x.status === 'absent'), JSON.stringify(a));
  await hubReady(page);
  const badge = await page.evaluate(() => ({ cls: document.getElementById('my-events-badge').className, n: document.getElementById('my-events-badge').textContent }));
  await page.tap('#my-events-tab');
  await page.waitForSelector('#my-events-list .me-card', { timeout: 10000 });
  const ch = await page.evaluate(() => document.getElementById('my-events-changes').textContent);
  chk('出欠ページで自分で「不参加」にした予定を「参加がなくなりました」と出さない（タブの赤丸も付かない）', !/参加がなくなりました/.test(ch) && !(badge.cls.includes('on') && !badge.n), JSON.stringify({ ch, badge }));

  // ほかの人が予定の時間を変えたら、これまでどおり知らせる
  const ev = await get(`${T}/events/${E2}`);
  await put(`${T}/events/${E2}`, Object.assign(ev, { startTime: '14:00' }));
  await hubReady(page);
  await page.tap('#my-events-tab');
  await page.waitForSelector('#my-events-list .me-card', { timeout: 10000 });
  const ch2 = await page.evaluate(() => document.getElementById('my-events-changes').textContent);
  chk('ほかの人が時間を変えた予定は「日時が変わりました」と知らせる', /「練習」（三年 太郎）の日時が変わりました/.test(ch2) && !/参加がなくなりました/.test(ch2), ch2);
  const real = errs.filter(e => !ignorable(e));
  chk('ページエラーなし', real.length === 0, real.join(' | '));
  await ctx.close();
}

await closeBrowser();
process.exit(summary() ? 1 : 0);
