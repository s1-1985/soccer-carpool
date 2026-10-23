// 8巡目(b): 出欠ページで参加者から外した選手の扱い・添付一覧の混在
import { put, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T } from './lib.mjs';
await wipe();
await put(`${T}/members/k1`, { name: '外された子', role: 'player', grade: '4' });
await put(`${T}/members/k2`, { name: '残る子', role: 'player', grade: '4' });
await put(`${T}/members/f1`, { name: '保護者エフ', role: 'father', childrenIds: ['k1'] });
await put(`${T}/members/nr`, { name: '役割なしの人', kana: 'ヤクワリナシ' }); // role の無いメンバー（Consoleでの手入力など）
await put(`${T}/events/rm1`, { title: '選抜の試合', date: '2026-12-12', type: 'game', target: ['4'] });
// 出欠ページで「外された子」を出欠リストから削除した状態
await put(`${T}/eventData/rm1`, { attendance: [{ name: '残る子', status: 'present', notes: '' }], attendanceRemoved: ['外された子'] });
await makeUser('r8b@example.com', '保護者エフ', 'admin', { childrenIds: ['k1'] });

const ctx = await context({ email: 'r8b@example.com', name: '保護者エフ', device: null });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());
await page.goto(BASE + '/hub/index.html');
await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
await page.waitForTimeout(1500);

// 0) role の無いメンバーも名簿に出る
const hasNoRole = await page.evaluate(() => (FCOjima.Hub.members || []).some(m => m.name === '役割なしの人'));
chk('役割（role）の無いメンバーも読み込まれ、名簿から消えない', hasNoRole, '');

// 1) 参加予定タブに出ない
await page.evaluate(() => FCOjima.Hub.MyEvents.renderList(false));
await page.waitForTimeout(800);
const me = await page.evaluate(() => document.getElementById('my-events-list').textContent);
chk('出欠ページで参加者から外された子の予定は、保護者の「参加予定」に出ない', !/選抜の試合/.test(me), me.slice(0, 120));

// 2) 予定の詳細の出欠確認に出ない
await page.evaluate(() => FCOjima.Hub.Calendar.showEventDetails('rm1'));
await page.waitForFunction(() => /出欠確認/.test((document.getElementById('event-details-content') || document.body).textContent), null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(800);
const det = await page.evaluate(() => { const c = document.getElementById('event-details-content') || document.body; return c.textContent; });
chk('予定の詳細の出欠確認に、参加者から外した子が「未回答」で出ない', /残る子/.test(det) && !/外された子/.test(det) && /未回答\s*0/.test(det), (det.match(/出欠確認.{0,80}/) || [''])[0]);
await page.evaluate(() => FCOjima.UI.closeModal('event-details-modal'));

// 3) 出欠状況の表で「－」（対象外）、未回答の人数に入らない
await page.evaluate(() => { document.querySelector('.tablinks[onclick*="admin"]').click(); document.getElementById('btn-attendance-matrix').click(); });
await page.waitForFunction(() => document.querySelector('.attendance-matrix'), null, { timeout: 15000 });
const mx = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.attendance-matrix tbody tr')].map(tr => [...tr.children].map(td => td.textContent));
  const brk = document.querySelector('.attendance-matrix th.mx-evt .e-brk').textContent;
  return { rows, brk };
});
const rmRow = mx.rows.find(r => r[1] === '外された子');
chk('出欠状況の表で、参加者から外した子は対象外（－）になり、未回答に数えない', rmRow && rmRow[2] === '－' && mx.brk === '100', JSON.stringify(mx));
await page.evaluate(() => FCOjima.UI.closeModal('attendance-matrix-modal'));

// 4) 管理タブのイベント概要で、別の予定を続けて開いたとき前の予定の添付が混ざらない
const ids = await page.evaluate(async () => {
  const a = 'filesA' + Date.now(), b = 'filesB' + Date.now();
  const mk = (n) => new File(['x'], n, { type: 'text/plain' });
  await FCOjima.EventFiles.upload(a, [mk('A1.txt'), mk('A2.txt'), mk('A3.txt')], null);
  await FCOjima.EventFiles.upload(b, [mk('B1.txt')], null);
  return { a, b };
});
// A のファイル情報の取得だけ遅くする（電波の悪いところで開いた状態）
await page.route(url => /\/v0\/b\/[^?]+\/o\/[^?]*filesA/.test(url.href), async r => { await new Promise(x => setTimeout(x, 2500)); r.continue(); });
await page.evaluate(({ a, b }) => {
  FCOjima.Hub.Admin.loadEventFiles(a);
  setTimeout(() => FCOjima.Hub.Admin.loadEventFiles(b), 300);
}, ids);
await page.waitForTimeout(5000);
const shown = await page.evaluate(() => [...document.querySelectorAll('#event-files-list .event-file-link')].map(a => a.textContent));
chk('別の予定のイベント概要を続けて開いても、前の予定の添付が一覧に混ざらない', JSON.stringify(shown) === JSON.stringify(['B1.txt']), JSON.stringify(shown));

await ctx.close();
// 5) 配車管理の概要: 端末に会場一覧が無くても（共有リンクから直接開いた等）、会場の住所で地図を開く
await put(`${T}/venues/vv1`, { name: '新しいグラウンド', address: '群馬県太田市尾島町123', notes: '' });
await put(`${T}/events/vn1`, { title: '会場確認', date: '2026-12-13', type: 'game', target: ['4'], venue: '新しいグラウンド' });
{
  const c2 = await context({ email: 'r8b@example.com', name: '保護者エフ', device: null });
  const p2 = await c2.newPage();
  await p2.addInitScript(() => { try { localStorage.removeItem('fcojima_venues'); } catch (e) {} });
  await p2.goto(BASE + '/carpool/index.html?event=vn1');
  await p2.waitForFunction(() => document.querySelector('.location-item .map-button'), null, { timeout: 25000 });
  await p2.waitForTimeout(2000);
  const onclick = await p2.evaluate(() => [...document.querySelectorAll('.location-item .map-button')].map(b => b.getAttribute('onclick')).join(' '));
  chk('配車管理の概要の「地図を開く」は、端末に会場一覧が無くても登録された住所で検索する', onclick.includes(encodeURIComponent('群馬県太田市尾島町123')), decodeURIComponent(onclick).slice(0, 120));
  await c2.close();
}
await closeBrowser();
process.exit(summary() ? 1 : 0);
