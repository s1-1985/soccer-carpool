// 9巡目: 予定の編集中に他の人が変えた項目を上書きしない など
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T } from './lib.mjs';
await wipe();
await put(`${T}/members/p1`, { name: '三年いち', role: 'player', grade: '3' });
await put(`${T}/members/p2`, { name: '四年に', role: 'player', grade: '4' });
await put(`${T}/events/ed1`, { title: '練習試合', date: '2026-12-05', type: 'game', target: ['3'], extraPlayers: [], startTime: '09:00', venue: '旧グラウンド', notes: '' });
await makeUser('r9@example.com', '管理者', 'admin');

// 1) 予定の編集フォームを開いている間に、他の人が開始時刻を変え・学年外の選手を追加した。
//    こちらはタイトルだけ直して保存 → 他の人の変更が残る
{
  const ctx = await context({ email: 'r9@example.com', name: '管理者', device: null });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => FCOjima.Hub.Calendar.editEvent('ed1'));
  await page.waitForTimeout(500);
  // 他の人の変更（リアルタイム同期で手元の一覧にも届く）
  await put(`${T}/events/ed1`, { title: '練習試合', date: '2026-12-05', type: 'game', target: ['3'], extraPlayers: ['四年に'], startTime: '10:30', venue: '旧グラウンド', notes: '' });
  await page.waitForFunction(() => { const e = FCOjima.Hub.events.find(x => String(x.id) === 'ed1'); return e && e.startTime === '10:30'; }, null, { timeout: 15000 });
  await page.fill('#event-title', '練習試合（雨天時は中止）');
  await page.evaluate(() => FCOjima.Hub.Calendar.saveEvent());
  await page.waitForTimeout(2500);
  const ev = await get(`${T}/events/ed1`);
  chk('編集中に他の人が変えた開始時刻を、開いた時点の古い時刻で上書きしない', ev.startTime === '10:30', JSON.stringify({ t: ev.title, s: ev.startTime }));
  chk('編集中に他の人が追加した学年外の選手を消さない', JSON.stringify(ev.extraPlayers) === JSON.stringify(['四年に']), JSON.stringify(ev.extraPlayers));
  chk('自分が直したタイトルは保存される', ev.title === '練習試合（雨天時は中止）', ev.title);

  // 2) 自分が変えた項目は（他の人が別の値にしていても）自分の値になる
  await page.evaluate(() => FCOjima.Hub.Calendar.editEvent('ed1'));
  await page.waitForTimeout(500);
  await put(`${T}/events/ed1`, { ...ev, venue: '別の人が決めた会場' });
  await page.waitForFunction(() => { const e = FCOjima.Hub.events.find(x => String(x.id) === 'ed1'); return e && e.venue === '別の人が決めた会場'; }, null, { timeout: 15000 });
  await page.fill('#event-venue', '自分が決めた会場');
  await page.evaluate(() => FCOjima.Hub.Calendar.saveEvent());
  await page.waitForTimeout(2500);
  const ev2 = await get(`${T}/events/ed1`);
  chk('自分が編集した項目は自分の入力で保存される', ev2.venue === '自分が決めた会場' && ev2.startTime === '10:30', JSON.stringify({ v: ev2.venue, s: ev2.startTime }));
  await ctx.close();
}

// 3) 出欠ページで参加者から外した人が座席に残っていたら、不参加と同じく印と注意書き
await put(`${T}/events/rm9`, { title: '外した人の座席', date: '2026-12-06', type: 'game', target: ['3'] });
await put(`${T}/eventData/rm9`, {
  attendance: [{ name: '三年いち', status: 'present', notes: '' }],
  attendanceRemoved: ['四年に'],
  carRegistrations: [{ parent: '運転手', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 0, notes: '' }],
  assignments: [{ carIndex: 0, driver: '運転手', seats: { '助手席': { '0': '三年いち' }, '中列': { '0': '四年に' }, '後列': {} } }]
});
{
  const ctx = await context({ email: 'r9@example.com', name: '管理者', device: null });
  const page = await ctx.newPage();
  await page.goto(BASE + '/carpool/assignments.html?event=rm9');
  await page.waitForFunction(() => document.querySelectorAll('.car-layout').length > 0, null, { timeout: 25000 });
  await page.waitForTimeout(800);
  const st = await page.evaluate(() => {
    const seat = [...document.querySelectorAll('.seat[data-person]')].find(s => s.dataset.person === '四年に');
    const ok = [...document.querySelectorAll('.seat[data-person]')].find(s => s.dataset.person === '三年いち');
    const w = document.getElementById('seat-absent-warning');
    return { marked: !!(seat && seat.classList.contains('seat-absent')), okMarked: !!(ok && ok.classList.contains('seat-absent')), warn: w && w.offsetParent ? w.textContent : '' };
  });
  chk('出欠ページで参加者から外した人が座席に残っていれば印と注意書きが出る（参加の人には出ない）', st.marked && !st.okMarked && /四年に/.test(st.warn), JSON.stringify(st));
  await ctx.close();
}

await closeBrowser();
process.exit(summary() ? 1 : 0);
