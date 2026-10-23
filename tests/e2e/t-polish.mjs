// ブラッシュアップ（2026-10-23）: やることを予定ごとにまとめる・リストの「イベント」・連絡事項のカード・管理のボタン・承認待ちの画面
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors } from './lib.mjs';
await wipe();
const jst = new Date(Date.now() + 9 * 3600e3);
const iso = d => d.toISOString().slice(0, 10);
const plus = n => { const x = new Date(jst); x.setUTCDate(x.getUTCDate() + n); return iso(x); };
const D1 = plus(1), D2 = plus(2);
await put(`${T}/members/p31`, { name: '小川 悠真', role: 'player', grade: '3' });
await put(`${T}/members/p12`, { name: '小川 結衣', role: 'player', grade: '1' });
await put(`${T}/members/f31`, { name: '小川 恵', role: 'mother', childrenIds: ['p31', 'p12'] });
await put(`${T}/members/c1`, { name: '佐藤 監督', role: 'coach', abbr: '佐藤' });
await put(`${T}/members/c3`, { name: '高橋 コーチ', role: 'assist', abbr: '高橋' });
const E1 = '1900000700001', E2 = '1900000700002', E3 = '1900000700003';
await put(`${T}/events/${E1}`, { title: '合同練習', date: D1, type: 'practice', target: ['1', '3'], startTime: '09:00', venue: '尾島小学校', attendanceDeadline: D1 + 'T07:00' });
await put(`${T}/events/${E2}`, { title: '低学年交流会のとても長い名前の行事（保護者も参加）', date: D2, type: 'event', target: ['1'], startTime: '10:00' });
await put(`${T}/events/${E3}`, { title: '3年の練習', date: D2, type: 'practice', target: ['3'] });
await put(`${T}/notifications/n1`, { date: plus(0).replace(/-/g, '/') + ' 08:00', text: '今月の会費の集金は第4土曜日です。', user: '佐藤 監督' });
await makeUser('kantoku@example.com', '佐藤 監督', 'coach');
await makeUser('ogawa@example.com', '小川 恵', 'parent', { childrenIds: ['p31', 'p12'] });
await makeUser('tk@example.com', '高橋 祐樹', 'parent', { status: 'pending', requestedRole: 'coach', kana: 'タカハシ ユウキ', childrenIds: [], childrenNames: [] });
const mob = (w) => ({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const ignorable = e => /favicon|ERR_|Failed to load resource|open-meteo|gsi|storage/i.test(e);
const hubReady = async (page) => {
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(1800);
};
const overflow = (sel) => { const root = document.querySelector(sel); const w = document.documentElement.clientWidth; return [...root.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > w + 1 || r.left < -1); }).map(e => e.className || e.tagName); };

// 保護者（子ども2人）
{
  const ctx = await context({ email: 'ogawa@example.com', name: '小川 恵', device: mob(360) });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  await hubReady(page);
  await page.waitForSelector('#hub-home .hh-att .hh-ev', { timeout: 10000 });
  const evs = () => page.evaluate(() => [...document.querySelectorAll('#hub-home .hh-att .hh-ev')].map(ev => ({
    title: ev.querySelector('.hh-row-title').textContent.replace(/\s*›$/, ''),
    date: ev.querySelector('.hh-row-date').textContent,
    kids: [...ev.querySelectorAll('.hh-row .hh-row-sub')].map(s => s.textContent).sort(),
    btns: ev.querySelectorAll('.me-ans-btn').length
  })));
  const g = await evs();
  chk('やることの出欠は予定ごとにまとまり、同じ予定の子どもは見出しの下に並ぶ（締切は日付の行）', g.length === 3 && g[0].title === '合同練習' && JSON.stringify(g[0].kids) === JSON.stringify(['小川 悠真', '小川 結衣']) && g[0].btns === 4 && /締切 \d+\/\d+/.test(g[0].date) && g[1].kids.length === 1, JSON.stringify(g));
  const ov = await page.evaluate(overflow, '#hub-home');
  chk('360px でやることがはみ出さない', ov.length === 0, JSON.stringify(ov));
  await page.locator('#hub-home .hh-att .hh-ev', { hasText: '合同練習' }).locator('.hh-row', { hasText: '小川 結衣' }).locator('.me-ans-present').tap();
  await page.waitForFunction(() => { const ev = [...document.querySelectorAll('#hub-home .hh-att .hh-ev')].find(x => /合同練習/.test(x.textContent)); return ev && ev.querySelectorAll('.hh-row').length === 1; }, null, { timeout: 10000 });
  const g2 = await evs();
  chk('ひとりだけ答えると、その子の行だけ消えて予定の見出しは残る', g2[0].title === '合同練習' && JSON.stringify(g2[0].kids) === JSON.stringify(['小川 悠真']), JSON.stringify(g2));
  const a = (await get(`${T}/eventData/${E1}`)).attendance || [];
  chk('答えた分は保存される', a.some(x => x.name === '小川 結衣' && x.status === 'present') && !a.some(x => x.name === '小川 悠真'), JSON.stringify(a));

  // 参加予定: 未回答の印・持ち物は1行
  await page.tap('#my-events-tab');
  await page.waitForSelector('#my-events-list .me-kid-row', { timeout: 8000 });
  const me = await page.evaluate(() => ({
    tags: [...document.querySelectorAll('#my-events-list .me-kid-tag')].map(t => t.textContent),
    paren: /（未回答）/.test(document.getElementById('my-events-list').textContent),
    bring: [...document.querySelectorAll('#my-events-list .me-bring')].map(b => b.textContent.slice(0, 2))
  }));
  chk('参加予定は名前の横に「未回答」の印（以前の「（未回答）」は出ない）', me.tags.length >= 2 && me.tags.every(t => t === '未回答') && !me.paren, JSON.stringify(me));

  // リスト表示: 種類「イベント」の項目がほかと同じ見た目（カレンダーのマス用の小さい文字・2行で切る・紫の塗りが当たらない）
  await page.tap('#defaultTab');
  await page.waitForTimeout(500);
  await page.tap('#list-view');
  await page.waitForTimeout(500);
  const l = await page.evaluate(() => {
    const item = document.querySelector('#events-list .event-item.event');
    const other = document.querySelector('#events-list .event-item.practice');
    const cs = getComputedStyle(item);
    const title = item.querySelector('.event-title');
    return {
      display: cs.display, clamp: cs.webkitLineClamp, bg: cs.backgroundColor, pad: cs.paddingLeft, otherPad: getComputedStyle(other).paddingLeft,
      titleSize: getComputedStyle(title).fontSize, titleFull: title.scrollHeight <= title.clientHeight + 1 && item.scrollHeight <= item.clientHeight + 1,
      details: [...document.querySelectorAll('#events-list .event-item .event-details')].map(d => d.textContent),
      seg: [...document.querySelectorAll('.view-seg button')].map(b => b.textContent.trim() + (b.classList.contains('active') ? '*' : '')),
      filter: document.getElementById('my-child-filter').textContent
    };
  });
  chk('リストの「イベント」はほかの種類と同じ余白・白地・文字の大きさで、長い名前も切れない', l.display === 'block' && (l.clamp === 'none' || l.clamp === '' || l.clamp === 'unset') && l.bg === 'rgb(255, 255, 255)' && l.pad === l.otherPad && l.titleSize === '14px' && l.titleFull, JSON.stringify(l));
  chk('リストの時間・会場はある分だけ（「@ 未設定」は出ない。どちらもなければ「時間・会場は未定」）', l.details.includes('09:00 ・ 尾島小学校') && l.details.includes('10:00') && l.details.includes('時間・会場は未定') && !l.details.some(d => /@|未設定/.test(d)), JSON.stringify(l.details));
  chk('表示の切り替えは［カレンダー｜リスト］と「わが子だけ」', JSON.stringify(l.seg) === JSON.stringify(['カレンダー', 'リスト*']) && l.filter === '☐ わが子だけ', JSON.stringify(l));

  // 連絡事項: チームの連絡のカードは 日時・書いた人・新着 が1行、LINEで共有は小さいボタン
  await page.tap('#notifications-tab');
  await page.waitForSelector('#notificationsList .notification-card .notif-new', { timeout: 8000 });
  const n = await page.evaluate(() => {
    const c = document.querySelector('#notificationsList .notification-card');
    const top = s => Math.round(c.querySelector(s).getBoundingClientRect().top);
    const mid = s => { const r = c.querySelector(s).getBoundingClientRect(); return (r.top + r.bottom) / 2; };
    return {
      date: c.querySelector('.notification-date').textContent, author: c.querySelector('.notification-author').textContent,
      sameLine: Math.abs(mid('.notification-date') - mid('.notification-author')) < 6 && Math.abs(mid('.notification-date') - mid('.notif-new')) < 8,
      newLast: c.querySelector('.notification-header').lastElementChild.classList.contains('notif-new'),
      share: c.querySelector('[data-action="share"]').getBoundingClientRect().width, card: c.getBoundingClientRect().width
    };
  });
  chk('チームの連絡は「10/23(金) 08:00 ・佐藤 監督 新着」が1行、LINEで共有は横いっぱいにならない', /^\d+\/\d+\(.\) 08:00$/.test(n.date) && n.author === '佐藤 監督' && n.sameLine && n.newLast && n.share < n.card / 2, JSON.stringify(n));
  const bad = errs.filter(e => !ignorable(e) && !/permission/i.test(e));
  chk('ページエラーなし（保護者）', bad.length === 0, JSON.stringify(bad.slice(0, 3)));
  await ctx.close();
}

// 監督: 管理タブのボタンと承認待ちのカード
{
  const ctx = await context({ email: 'kantoku@example.com', name: '佐藤 監督', device: mob(360) });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  await hubReady(page);
  await page.evaluate(() => document.getElementById('admin-tab').click());
  await page.waitForSelector('#pending-users-list .approve-btn', { timeout: 10000 });
  const ad = await page.evaluate(() => ({
    groups: [...document.querySelectorAll('#admin .admin-group, .admin-group')].map(g => g.querySelector('.admin-sub').textContent + ':' + [...g.querySelectorAll('button.admin-tile')].map(b => b.id).join(',')),
    titles: [...document.querySelectorAll('button.admin-tile .admin-tile-body b')].map(b => b.textContent),
    descs: [...document.querySelectorAll('button.admin-tile .admin-tile-body small')].filter(s => s.textContent.trim()).length,
    approve: document.querySelector('#pending-users-list .approve-btn').textContent, reject: document.querySelector('#pending-users-list .reject-btn').textContent,
    wide: document.querySelector('#pending-users-list .approve-btn').getBoundingClientRect().width > document.querySelector('#pending-users-list .reject-btn').getBoundingClientRect().width,
    inline: document.querySelector('#pending-users-list .approve-btn').getAttribute('style')
  }));
  const uniq = [...new Set(ad.groups)];
  chk('管理のボタンは「よく使う」「記録・設定」に分かれ、それぞれに説明がある（記録・設定の最後に「権限の設定」）', uniq.length === 2 && /^よく使う:btn-coach-planner,btn-attendance-matrix,btn-signup-qr,btn-all-users$/.test(uniq[0]) && /^記録・設定:btn-driver-stats,btn-attendance-rate,btn-duty-groups,btn-luggage-settings,btn-permissions$/.test(uniq[1]) && ad.descs === 9, JSON.stringify(ad));
  chk('承認待ちのカードは「承認する」（大きい緑）と「却下」（小さい）', ad.approve === '承認する' && ad.reject === '却下' && ad.wide && !ad.inline, JSON.stringify(ad));
  const ov = await page.evaluate(overflow, '#admin');
  chk('360px で管理タブがはみ出さない', ov.length === 0, JSON.stringify(ov));
  // ボタンの中身（アイコン・説明）を押しても開く
  await page.tap('#btn-all-users .admin-tile-body small');
  await page.waitForTimeout(800);
  const opened = await page.evaluate(() => [...document.querySelectorAll('.modal')].some(m => getComputedStyle(m).display !== 'none'));
  chk('ボタンの説明の部分を押しても開く（登録済みユーザー）', opened, String(opened));
  const bad = errs.filter(e => !ignorable(e) && !/permission/i.test(e));
  chk('ページエラーなし（監督）', bad.length === 0, JSON.stringify(bad.slice(0, 3)));
  await ctx.close();
}

// 承認待ちの画面（スマホ幅）
{
  const ctx = await context({ email: 'tk@example.com', name: '高橋 祐樹', device: mob(360) });
  const page = await ctx.newPage();
  await page.goto(BASE + '/hub/pending.html');
  await page.waitForSelector('.pending-steps li', { timeout: 15000 });
  await page.waitForTimeout(800);
  const p = await page.evaluate(() => {
    const r = document.querySelector('.pending-container').getBoundingClientRect();
    return { left: r.left, right: document.documentElement.clientWidth - r.right, steps: document.querySelectorAll('.pending-steps li').length, signoutShadow: getComputedStyle(document.getElementById('signout-btn')).boxShadow };
  });
  chk('承認待ちの画面: 3つの流れ、カードの左右に余白、「サインアウト」は文字だけ（影なし）', p.steps === 3 && p.left >= 12 && p.right >= 12 && p.signoutShadow === 'none', JSON.stringify(p));
  await ctx.close();
}

await closeBrowser();
process.exit(summary() ? 1 : 0);
