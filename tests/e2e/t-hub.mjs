// HUB側の不具合修正の確認
import { put, get, list, del, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors, FS } from './lib.mjs';

await wipe();
const E1 = '1900000000701';
await put(`${T}/events/${E1}`, { title: '岩松練習', date: '2026-10-20', type: 'practice', target: ['3'], venue: 'Let\'sフットサル', startTime: '09:00' });
// 300件超のイベント（旧実装は1バッチ500操作の上限超過で保存が黙って失敗していた）
const many = [];
for (let i = 0; i < 300; i++) {
  many.push(put(`${T}/events/bulk${String(i).padStart(3, '0')}`, { title: '過去イベント' + i, date: '2025-' + String(1 + (i % 12)).padStart(2, '0') + '-' + String(1 + (i % 28)).padStart(2, '0'), type: 'practice', target: [] }));
}
await Promise.all(many);
await put(`${T}/members/g1`, { name: '卒団済太郎', role: 'player', birth: '2012-05-01', grade: '6' });   // 中学生
await put(`${T}/members/y1`, { name: '未就学ちゃん', role: 'player', birth: '2024-06-01', grade: '' });  // 年少未満
await put(`${T}/members/k1`, { name: '三年生', role: 'player', birth: '2017-06-01', grade: '3' });
await put(`${T}/venues/v1`, { name: "Let'sフットサル", address: "群馬県太田市Let's町1-1", notes: '' });
await put(`${T}/logs/l1`, { datetime: new Date(Date.now() - 3 * 86400000).toISOString(), user: 'x', type: 'calendar', action: '古いログ', details: '「岩松練習」（2026-10-20）', eventId: E1 });
await put(`${T}/logs/l2`, { datetime: '2026-10-15T23:30:00.000Z', user: 'x', type: 'calendar', action: '新しいログ', details: '「岩松練習」（2026-10-20）', eventId: E1 });

await makeUser('hubadmin@example.com', '管理者', 'admin');
await makeUser('hubparent@example.com', '一般保護者', 'parent');

async function openHub(ctx) {
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub && document.querySelector('#calendar-grid .calendar-day'), null, { timeout: 30000 });
  await page.waitForTimeout(500);
  return { page, errs };
}

// ---- 保護者 ----
const ctxP = await context({ email: 'hubparent@example.com', name: '一般保護者', device: null });
const { page: pp, errs: errsP } = await openHub(ctxP);
const vis = await pp.evaluate(() => {
  const shown = id => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; };
  document.querySelector('.tablinks[onclick*="members"]').click();
  const fab = getComputedStyle(document.getElementById('floating-add-button')).display;
  return { add: shown('add-member'), edit: shown('edit-member'), del: shown('delete-member'), addVenue: shown('add-venue'),
    venueEdit: !!document.querySelector('#venues-list button[onclick*="editVenue"]'), fab };
});
chk('保護者にはメンバー追加・編集・削除ボタンが出ない', !vis.add && !vis.edit && !vis.del, JSON.stringify(vis));
chk('保護者には会場の追加・編集ボタンが出ない', !vis.addVenue && !vis.venueEdit);
chk('保護者にはメンバータブの＋ボタンが出ない', vis.fab === 'none', vis.fab);
await pp.waitForTimeout(800);
let g1 = await get(`${T}/members/g1`);
let y1 = await get(`${T}/members/y1`);
const logsAfterParent = (await list(`${T}/logs`)).filter(l => l.action === 'メンバー自動卒団');
chk('保護者の端末では自動卒団処理をしない（ログも残さない）', g1 && y1 && logsAfterParent.length === 0, JSON.stringify({ g1: !!g1, y1: !!y1, logs: logsAfterParent.length }));

// ---- 管理者 ----
const ctxA = await context({ email: 'hubadmin@example.com', name: '管理者', device: null });
const { page: pa, errs: errsA } = await openHub(ctxA);
await pa.waitForTimeout(1500);
g1 = await get(`${T}/members/g1`);
y1 = await get(`${T}/members/y1`);
chk('中学生になった選手は自動卒団で削除される', !g1);
chk('生年月日が年少未満の選手は「卒団」扱いで削除されない', !!y1);

// 編集をキャンセル → 日付タップで新規追加 → 元のイベントが上書きされない
await pa.evaluate((id) => FCOjima.Hub.Calendar.showEventDetails(id), E1);
await pa.waitForSelector('#event-details-modal', { state: 'visible' });
await pa.click('#edit-event');
await pa.waitForSelector('#event-modal', { state: 'visible' });
await pa.click('#cancel-event');
await pa.evaluate(() => FCOjima.Hub.Calendar.openAddEventModal(new Date(2026, 9, 22)));
await pa.fill('#event-title', '新規テスト');
await pa.click('#event-form button[type="submit"]');
await pa.waitForTimeout(2000);
const e1 = await get(`${T}/events/${E1}`);
const evs = await list(`${T}/events`);
const added = evs.filter(e => e.title === '新規テスト');
chk('編集キャンセル後の新規追加で、前に開いたイベントが上書きされない', e1 && e1.title === '岩松練習' && e1.date === '2026-10-20', JSON.stringify(e1 && { t: e1.title, d: e1.date }));
chk('新規イベントとして追加される', added.length === 1 && added[0].date === '2026-10-22', JSON.stringify(added.map(e => e.date)));
chk('300件超あっても他のイベントが消えない', evs.filter(e => e.id.startsWith('bulk')).length === 300, String(evs.filter(e => e.id.startsWith('bulk')).length));

// 300件超のイベントがあっても編集が保存される
await pa.evaluate(() => FCOjima.Hub.Calendar.editEvent('bulk010'));
await pa.fill('#event-title', '編集後タイトル');
await pa.click('#event-form button[type="submit"]');
await pa.waitForTimeout(2000);
const b10 = await get(`${T}/events/bulk010`);
chk('イベントが300件超でも編集が保存される', b10 && b10.title === '編集後タイトル', b10 && b10.title);

// 月末日に「次の月」
const months = await pa.evaluate(() => {
  FCOjima.Hub.currentDate = new Date(2026, 9, 31);
  document.getElementById('next-month').click();
  const a = document.getElementById('current-month').textContent;
  FCOjima.Hub.currentDate = new Date(2026, 2, 31);
  document.getElementById('prev-month').click();
  const b = document.getElementById('current-month').textContent;
  return [a, b];
});
chk('10/31に「次の月」で11月になる（12月に飛ばない）', months[0] === '2026年11月', months[0]);
chk('3/31に「前の月」で2月になる（3月のままにならない）', months[1] === '2026年2月', months[1]);

// ログ表示: 新しい順・日本時間
const logView = await pa.evaluate(async (id) => {
  FCOjima.Hub.openLogsModal('calendar');
  const first = document.querySelector('#logs-content .log-item .log-action');
  const res = { firstAction: first && first.textContent };
  FCOjima.UI.closeModal('logs-modal');
  await FCOjima.Hub.Calendar.showEventDetails(id);
  res.detail = document.getElementById('event-details-content').textContent;
  return res;
}, E1);
chk('ログ画面の先頭が最新のログ', logView.firstAction !== '古いログ', logView.firstAction);
chk('イベント詳細のログ時刻が日本時間', logView.detail.includes('2026-10-16 08:30'), (logView.detail.match(/20\d\d-\d\d-\d\d \d\d:\d\d/g) || []).join(','));

// 地図ボタン（会場名・住所に ' を含む）が壊れない
const mapOk = await pa.evaluate(() => {
  const btns = [...document.querySelectorAll('#event-details-content button.map-button')];
  let opened = null;
  const orig = window.open; window.open = (u) => { opened = u; };
  try { btns.forEach(b => b.click()); } finally { window.open = orig; }
  return opened;
});
chk("会場名に ' を含んでも「地図を開く」が動く", !!mapOk && mapOk.includes('%27'), String(mapOk));

// 管理タブのイベント概要モーダル: 曜日が二重にならない
const adminDate = await pa.evaluate((id) => {
  const ev = FCOjima.Hub.events.find(e => String(e.id) === String(id));
  FCOjima.Hub.Admin.openEventDetailModal(ev, null, false);
  return document.getElementById('event-detail-modal-body').textContent;
}, E1);
chk('管理タブのイベント概要で曜日が二重表示されない', adminDate.includes('2026年10月20日(火)') && !adminDate.includes('(火)（火）'), (adminDate.match(/2026年[^ ]{0,12}/) || [''])[0]);

// 連絡事項: 2人がほぼ同時に投稿 → 両方残る
const ctxP2 = await context({ email: 'hubparent@example.com', name: '一般保護者', device: null });
const { page: pp2 } = await openHub(ctxP2);
const openNoticeTab = p => p.evaluate(() => {
  document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
  document.querySelector('.tablinks[onclick*="notifications"]').click();
});
await openNoticeTab(pa); await openNoticeTab(pp2);
await pa.fill('#notificationText', '管理者からの連絡');
await pa.click('#send-notification');
await pa.waitForTimeout(1500);
await pp2.fill('#notificationText', '保護者からの連絡');
await pp2.click('#send-notification');
await pp2.waitForTimeout(1500);
const notes = (await list(`${T}/notifications`)).map(n => n.text);
chk('先に投稿された連絡事項が、後から投稿した人の古い一覧で消されない', notes.includes('管理者からの連絡') && notes.includes('保護者からの連絡'), JSON.stringify(notes));

// 配車管理への遷移URLにイベントIDが付く
await pa.evaluate((id) => FCOjima.Hub.Calendar.showEventDetails(id), E1);
await pa.click('#manage-event');
await pa.waitForURL(/carpool\/index\.html/);
chk('配車管理へ移動するURLにイベントIDが付く', pa.url().includes('event=' + E1), pa.url());

const allErrs = [...errsP, ...errsA].filter(e => !/favicon|ERR_|Failed to load resource|open-meteo|gsi/.test(e));
console.log('errors:', JSON.stringify(allErrs.slice(0, 8)));
chk('ページエラーなし', allErrs.length === 0);
await closeBrowser();
process.exit(summary() ? 1 : 0);
