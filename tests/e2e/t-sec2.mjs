// セキュリティの検証（画面）: ログアウト・別の人のログインで端末のデータを消す、承認するときの「同じ名前の人」の警告、
// 登録画面からの申請と連絡事項の投稿が新しいルールでも通ること、画面の HTML に埋め込み禁止のヘッダーが付くこと
import { put, get, list, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T } from './lib.mjs';
await wipe();

await put(`${T}/members/p1`, { name: '山田 太郎', role: 'player', grade: '3' });
await put(`${T}/members/m1`, { name: '山田 花子', role: 'mother', childrenIds: ['p1'] });
await makeUser('s2admin@example.com', '管理 太郎', 'admin');
const parentUid = await makeUser('s2parent@example.com', '山田 花子', 'parent', { childrenIds: ['p1'] });
await put(`${T}/logs/l1`, { datetime: new Date().toISOString(), type: 'members', action: 'メンバー追加', details: '管理者だけが見るログ', user: '管理 太郎' });

async function openHub(email, name, init = '') {
  const ctx = await context({ email, name, device: null });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(1000);
  return { ctx, page };
}
const cacheKeys = (page) => page.evaluate(() => Object.keys(localStorage).filter(k => /^fcojima_(members|events|venues|logs|notifications|event_)/.test(k)).sort());

// ---------- 1) ログアウトすると、端末に残したチームのデータが消える ----------
{
  const { ctx, page } = await openHub('s2admin@example.com', '管理 太郎');
  await page.evaluate(() => { const S = FCOjima.Storage, H = FCOjima.Hub; S.saveLogs(H.logs); S.saveMembers(H.members); S.saveEvents(H.events); S.saveNotifications(H.notifications); localStorage.setItem('fcojima_event_123', '{"x":1}'); });
  const before = await cacheKeys(page);
  await page.evaluate(() => document.getElementById('logout-btn').click());
  await page.waitForURL(/login\.html/, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => Object.keys(localStorage).filter(k => /^fcojima_(members|events|venues|logs|notifications|event_)/.test(k)).sort()).catch(e => ['evaluate failed: ' + e.message]);
  chk('ログアウトすると、端末に残した名簿・予定・連絡・操作ログ・配車のデータが消える',
    before.includes('fcojima_logs') && before.includes('fcojima_members') && after.length === 0, JSON.stringify({ before, after }));
  await ctx.close();
}

// ---------- 2) 前と違う人がこの端末でログインしたら、前の人のデータを消す ----------
{
  // 前の人（管理者）がログアウトせずに残したデータ（操作ログ）がある端末で、保護者がログインする
  const init = `if (!sessionStorage.getItem('s2_seeded')) { sessionStorage.setItem('s2_seeded', '1');
    localStorage.setItem('fcojima_cache_uid', 'someone-else');
    localStorage.setItem('fcojima_logs', JSON.stringify([{ id: 'old', datetime: '2026-10-01T00:00:00Z', type: 'members', action: '前の人のログ', details: '前の人のログ', user: '管理 太郎' }]));
    localStorage.setItem('fcojima_event_999', '{"secret":1}'); }`;
  const { ctx, page } = await openHub('s2parent@example.com', '山田 花子', init);
  const v = await page.evaluate(() => ({
    logs: localStorage.getItem('fcojima_logs') || '', ev: localStorage.getItem('fcojima_event_999'), owner: localStorage.getItem('fcojima_cache_uid'),
    hubLogs: (FCOjima.Hub.logs || []).length
  }));
  chk('前と違う人がログインすると、前の人が端末に残したデータ（操作ログ・配車のデータ）は消える',
    !/前の人のログ/.test(v.logs) && v.ev === null && v.hubLogs === 0, JSON.stringify(v));
  chk('端末のデータがだれのものかを覚える（いまログインしている人）', v.owner === parentUid, v.owner);

  // ---------- 3) 連絡事項の投稿（新しいルール: 自分の名前と uid）----------
  await page.evaluate(() => document.querySelector('.tablinks[onclick*="notifications"]').click());
  await page.waitForTimeout(500);
  await page.evaluate(() => { document.getElementById('notificationText').value = '保護者からの連絡です'; });
  await page.evaluate(() => FCOjima.Hub.Notifications.sendNotification());
  await page.waitForTimeout(1500);
  const notes = await list(`${T}/notifications`);
  const mine = notes.find(n => n.text === '保護者からの連絡です');
  chk('保護者は連絡事項を投稿できる（書いた人の名前・uid が付く）', mine && mine.user === '山田 花子' && mine.uid === parentUid, JSON.stringify(mine || notes));
  const logs = await list(`${T}/logs`);
  chk('保護者の操作ログも記録できる（自分の名前で）', logs.some(l => l.user === '山田 花子'), JSON.stringify(logs.map(l => l.user)));
  await ctx.close();
}

// ---------- 4) 登録画面からの申請（新しいルール: 決まった項目だけ・ログインのメール）----------
{
  const ctx = await context({ email: 's2new@example.com', name: '新しい人', device: null });
  const page = await ctx.newPage();
  await page.goto(BASE + '/hub/register.html');
  await page.waitForFunction(() => document.querySelector('#child-inputs input'), null, { timeout: 20000 });
  const max = await page.evaluate(() => [document.getElementById('reg-name').maxLength, document.getElementById('reg-kana').maxLength]);
  await page.fill('#reg-name', '山田 花子');
  await page.fill('#reg-kana', 'ヤマダ ハナコ');
  await page.fill('#child-inputs input', '山田 太郎');
  await page.click('button[type="submit"]');
  const ok = await page.waitForURL(/pending\.html/, { timeout: 15000 }).then(() => true).catch(() => false);
  const users = await list(`${T}/users`);
  const app = users.find(u => u.email === 's2new@example.com');
  chk('登録画面から申請できる（名前・フリガナは40文字まで）', ok && app && app.status === 'pending' && JSON.stringify(max) === '[40,40]', JSON.stringify({ ok, max, s: app && app.status }));
  await ctx.close();
}

// ---------- 5) 承認するとき、同じ名前で登録済みの人がいれば警告する ----------
{
  const { ctx, page } = await openHub('s2admin@example.com', '管理 太郎');
  await page.evaluate(() => document.querySelector('.tablinks[onclick*="admin"]').click());
  await page.waitForSelector('#pending-users-list .pending-card', { timeout: 10000 });
  await page.waitForFunction(() => { const w = document.querySelector('.pending-card .pending-dup-warn'); return w && w.style.display !== 'none'; }, null, { timeout: 8000 }).catch(() => {});
  const w = await page.evaluate(() => { const el = document.querySelector('.pending-card .pending-dup-warn'); return el ? { shown: el.style.display !== 'none', text: el.textContent } : null; });
  chk('同じ名前（山田 花子）で登録済みの人がいる申請には、なりすましでないか確かめるよう警告が出る',
    w && w.shown && /同じ名前で登録済み/.test(w.text) && /s2parent@example\.com/.test(w.text), JSON.stringify(w));
  // 名前の違う申請には出ない
  await put(`${T}/users/${(await list(`${T}/users`)).find(u => u.email === 's2new@example.com').id}`, { name: '別の 名前', kana: 'ベツノ ナマエ', role: 'parent', status: 'pending', email: 's2new@example.com', childrenIds: [], childrenNames: [] });
  await page.evaluate(() => FCOjima.Hub.Admin.loadPendingUsers());
  await page.waitForTimeout(1500);
  const w2 = await page.evaluate(() => { const el = document.querySelector('.pending-card .pending-dup-warn'); return el ? el.style.display : 'none'; });
  chk('名前の違う申請には警告を出さない', w2 === 'none', w2);
  await ctx.close();
}

// ---------- 6) 画面の HTML に、よそのサイトへの埋め込みを断るヘッダー ----------
{
  const r = await fetch(BASE + '/hub/index.html');
  const h = { xfo: r.headers.get('x-frame-options'), csp: r.headers.get('content-security-policy'), nosniff: r.headers.get('x-content-type-options') };
  chk('画面の HTML に、よそのサイトへの埋め込みを断るヘッダー（X-Frame-Options・frame-ancestors）と nosniff が付く',
    h.xfo === 'SAMEORIGIN' && /frame-ancestors 'self'/.test(h.csp || '') && h.nosniff === 'nosniff', JSON.stringify(h));
}

await closeBrowser();
process.exitCode = summary() ? 1 : 0;
