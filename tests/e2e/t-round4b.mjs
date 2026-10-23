// 4巡目の細かい修正の確認
import { put, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T } from './lib.mjs';
await wipe();
await put(`${T}/members/p1`, { name: '選手いち', role: 'player', grade: '3' });
await put(`${T}/events/old1`, { title: '旧データ', date: '2026-12-01', type: 'game', target: [], description: '旧形式の備考' });
await makeUser('r4b@example.com', '管理者', 'admin');
await makeUser('r4b-p@example.com', '保護者', 'parent');
const ctx = await context({ email: 'r4b@example.com', name: '管理者', device: null });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());
await page.goto(BASE + '/hub/index.html');
await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
await page.waitForTimeout(800);

// 自分の行の「変更」ボタンは押せない
await page.evaluate(() => document.querySelector('.tablinks[onclick*="admin"]').click());
await page.waitForFunction(() => document.querySelectorAll('#all-users-list button').length >= 2, null, { timeout: 15000 });
const rows = await page.evaluate(() => [...document.querySelectorAll('#all-users-list > div')].map(r => ({ t: r.textContent.slice(0, 20), sel: r.querySelector('select') && r.querySelector('select').disabled, btn: r.querySelector('button') && r.querySelector('button').disabled })));
const mine = rows.find(r => /管理者r4b@/.test(r.t.replace(/\s/g, '')) || r.t.startsWith('管理者'));
const other = rows.find(r => r.t.startsWith('保護者'));
chk('自分の行は役割の「変更」ボタンも押せない（他人の行は押せる）', mine && mine.sel && mine.btn && other && !other.btn, JSON.stringify(rows));

// メンバー選択に流用したモーダルの見出し
await page.evaluate(() => { document.querySelector('.tablinks[onclick*="members"]').click(); FCOjima.Hub.Members.openMemberSelectForEdit(); });
const t1 = await page.evaluate(() => document.querySelector('#logs-modal h2').textContent);
await page.evaluate(() => { FCOjima.UI.closeModal('logs-modal'); FCOjima.Hub.openLogsModal('members'); });
const t2 = await page.evaluate(() => document.querySelector('#logs-modal h2').textContent);
chk('メンバー選択では見出しが「操作ログ」にならず、ログ表示では「操作ログ」に戻る', t1 === 'メンバーを選択' && t2 === '操作ログ', JSON.stringify([t1, t2]));
await page.evaluate(() => FCOjima.UI.closeModal('logs-modal'));

// 旧形式の備考（description）が表示され、編集フォームにも出る
await page.evaluate(() => document.querySelector('.tablinks[onclick*="calendar"]').click());
await page.evaluate(() => FCOjima.Hub.Calendar.showEventDetails('old1'));
await page.waitForTimeout(800);
const shown = await page.evaluate(() => document.getElementById('event-details-content').textContent.includes('旧形式の備考'));
await page.evaluate(() => FCOjima.Hub.Calendar.editEvent('old1'));
const formNotes = await page.evaluate(() => document.getElementById('event-notes').value);
chk('旧形式の備考（description）が予定詳細に表示され、編集しても消えない', shown && formNotes === '旧形式の備考', JSON.stringify({ shown, formNotes }));
await page.evaluate(() => FCOjima.UI.closeModal('event-modal'));

// 詳細を素早く2つ開いても、最後に開いた予定が表示される
await put(`${T}/events/q1`, { title: '先に開く予定', date: '2026-12-02', type: 'game', target: [] });
await put(`${T}/events/q2`, { title: '後に開く予定', date: '2026-12-03', type: 'game', target: [] });
await page.waitForTimeout(1500);
const last = await page.evaluate(async () => {
  const orig = FCOjima.DB.loadEventData;
  FCOjima.DB.loadEventData = (id) => new Promise(r => setTimeout(() => r(null), id === 'q1' ? 800 : 50));
  const a = FCOjima.Hub.Calendar.showEventDetails('q1');
  const b = FCOjima.Hub.Calendar.showEventDetails('q2');
  await Promise.all([a, b]);
  FCOjima.DB.loadEventData = orig;
  return document.querySelector('#event-details-content h3').textContent;
});
chk('予定を続けてタップしても、最後にタップした予定の詳細が表示される', last === '後に開く予定', last);

// クリップボードへのコピーに失敗したら失敗を表示する
const clip = await page.evaluate(async () => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true });
  const origExec = document.execCommand.bind(document);
  document.execCommand = () => false;
  FCOjima.Utils.copyToClipboard('テスト');
  FCOjima.UI.showAlert('コピーしました');
  await new Promise(r => setTimeout(r, 200));
  document.execCommand = origExec;
  const t = document.querySelector('.toast-notification');
  return t ? t.textContent : '';
});
chk('クリップボードへのコピーに失敗したとき「コピーしました」のままにしない', /失敗/.test(clip), clip);
await ctx.close();
await closeBrowser();
process.exit(summary() ? 1 : 0);
