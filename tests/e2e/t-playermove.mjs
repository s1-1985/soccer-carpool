// 同じ日の別の予定への選手の移動（選手を入れる画面）＋カレンダーの日付タップで開くその日の予定一覧
import { put, get, list, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors } from './lib.mjs';
await wipe();
const D = '2026-11-21';
const EA = '1900000040001', EB = '1900000040002', EN = '1900000040003', EX = '1900000040004';
await put(`${T}/members/p6a`, { name: '六年 一郎', role: 'player', grade: '6' });
await put(`${T}/members/p5a`, { name: '五年 次郎', role: 'player', grade: '5' });
await put(`${T}/members/p4a`, { name: '四年 三郎', role: 'player', grade: '4' });
await put(`${T}/members/p4b`, { name: '四年 四郎', role: 'player', grade: '4' });
await put(`${T}/members/p3a`, { name: '三年 花子', role: 'player', grade: '3' });
await put(`${T}/members/p2a`, { name: '二年 太郎', role: 'player', grade: '2' });
await put(`${T}/members/m4a`, { name: '四年 母', role: 'mother', childrenIds: ['p4a', 'p2a'] });
await put(`${T}/events/${EA}`, { title: '5・6年 試合', date: D, type: 'game', target: ['5', '6'], startTime: '09:00' });
await put(`${T}/events/${EB}`, { title: '3・4年 練習試合', date: D, type: 'game', target: ['3', '4'], startTime: '10:00', venue: '尾島小' });
await put(`${T}/events/${EN}`, { title: 'ナイター練習', date: D, type: 'nighter', target: ['1', '2', '3', '4', '5', '6'], startTime: '18:30' });
await put(`${T}/events/${EX}`, { title: '別の日の試合', date: '2026-11-22', type: 'game', target: ['2'] });
await put(`${T}/eventData/${EA}`, { attendance: [{ name: '六年 一郎', status: 'unknown', notes: '' }, { name: '五年 次郎', status: 'absent', notes: '発熱' }] });
await put(`${T}/eventData/${EB}`, {
  attendance: [{ name: '四年 三郎', status: 'present', notes: '' }, { name: '四年 四郎', status: 'unknown', notes: '' }, { name: '三年 花子', status: 'absent', notes: '' }],
  carRegistrations: [{ parent: '四年 母', canDrive: 'both', frontSeat: 1, middleSeat: 2, backSeat: 0, notes: '' }]
});
await makeUser('pmadmin@example.com', '移動管理者', 'admin');
await makeUser('pmcoach@example.com', '移動コーチ', 'coach');
await makeUser('pmmom@example.com', '四年 母', 'parent', { childrenIds: ['p4a', 'p2a'] });

const SE = { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' };
const overflow = (sel) => (s => {
  const root = document.querySelector(s);
  if (!root) return 'no-root';
  const vw = document.documentElement.clientWidth;
  const bad = [...root.querySelectorAll('*')].filter(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && (r.right > vw + 0.5 || r.left < -0.5);
  }).map(el => (el.className || el.tagName) + ':' + Math.round(el.getBoundingClientRect().right));
  const c = root.querySelector('.modal-content');
  if (c && c.scrollWidth > c.clientWidth + 1) bad.push('content-scroll ' + c.scrollWidth + '>' + c.clientWidth);
  return bad;
});

// 1) 管理者が HUB の予定の詳細から「選手を入れる」（320px のスマホ）
{
  const ctx = await context({ email: 'pmadmin@example.com', name: '移動管理者', device: SE });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  const dialogs = [];
  page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub && FCOjima.PlayerMove, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  chk('（前提）320px の画面で確認している', await page.evaluate(() => document.documentElement.clientWidth) === 320, String(await page.evaluate(() => document.documentElement.clientWidth)));
  await page.evaluate(id => FCOjima.Hub.Calendar.showEventDetails(id), EA);
  await page.waitForSelector('#event-player-move-btn', { timeout: 8000 });
  await page.tap('#event-player-move-btn');
  await page.waitForSelector('#player-move-modal .pm-row', { timeout: 10000 });
  const view = await page.evaluate(() => {
    const m = document.getElementById('player-move-modal');
    return {
      head: m.querySelector('.pm-head').textContent,
      sections: [...m.querySelectorAll('.pm-section')].map(s => ({ t: s.firstChild.textContent, rows: [...s.querySelectorAll('.pm-row')].map(r => r.textContent.replace('入れる', '')) }))
    };
  });
  console.log(JSON.stringify(view));
  chk('見出しに移動先の予定と参加・未回答・不参加の人数が出る', /5・6年 試合/.test(view.head) && /参加 0/.test(view.head) && /未回答 1/.test(view.head) && /不参加 1/.test(view.head), view.head);
  chk('同じ日の他の予定ごとに候補が出る（不参加の選手・ナイター・別の日の予定は出ない）',
    view.sections.length === 2 && /3・4年 練習試合（尾島小）/.test(view.sections[0].t) &&
    JSON.stringify(view.sections[0].rows) === JSON.stringify(['4年四年 三郎参加', '4年四年 四郎未回答']), JSON.stringify(view.sections));
  chk('その日に予定のない選手も候補に出る', /この日に予定のない選手/.test(view.sections[1].t) && JSON.stringify(view.sections[1].rows) === JSON.stringify(['2年二年 太郎']), JSON.stringify(view.sections[1]));
  const ov = await page.evaluate(overflow(), '#player-move-modal');
  chk('320px でも「選手を入れる」画面がはみ出さない', Array.isArray(ov) && ov.length === 0, JSON.stringify(ov));

  // 他の予定の選手を入れる
  await page.locator('#player-move-modal .pm-row', { hasText: '四年 三郎' }).locator('.pm-add').tap();
  await page.waitForFunction(() => FCOjima.PlayerMove._state.moved.length === 1 && document.querySelector('#player-move-modal .pm-moved-row'), null, { timeout: 10000 });
  await page.waitForTimeout(500);
  const conf = dialogs[dialogs.length - 1] || '';
  chk('確認に移動元が不参加になること・保護者の車が移動元に登録されていることが出る', /3・4年 練習試合」は不参加/.test(conf) && /四年 母.*車が「3・4年 練習試合」に登録/.test(conf), conf);
  const da = await get(`${T}/eventData/${EA}`), db = await get(`${T}/eventData/${EB}`), ea = await get(`${T}/events/${EA}`);
  chk('移動先で参加・移動元で不参加（備考に移動先）になる', da.attendance.some(a => a.name === '四年 三郎' && a.status === 'present') &&
    db.attendance.some(a => a.name === '四年 三郎' && a.status === 'absent' && a.notes === '「5・6年 試合」へ移動'), JSON.stringify({ a: da.attendance, b: db.attendance }));
  chk('対象学年外なので移動先の学年外追加に入る（他の項目は変わらない）', JSON.stringify(ea.extraPlayers) === JSON.stringify(['四年 三郎']) && ea.title === '5・6年 試合' && JSON.stringify(ea.target) === JSON.stringify(['5', '6']), JSON.stringify(ea));
  chk('移動元の車の登録は消えない', db.carRegistrations.length === 1, '');
  let notes = await list(`${T}/notifications`);
  chk('変更のお知らせが連絡事項に入る', notes.some(n => n.type === 'move' && n.memberId === 'p4a' && String(n.fromEventId) === EB && String(n.toEventId) === EA && n.eventDate === D), JSON.stringify(notes));
  const after1 = await page.evaluate(() => ({ head: document.querySelector('#player-move-modal .pm-head').textContent, rows: [...document.querySelectorAll('#player-move-modal .pm-row')].map(r => r.dataset.name) }));
  chk('入れた後は人数が更新され、その選手は候補から消える', /参加 1/.test(after1.head) && !after1.rows.includes('四年 三郎'), JSON.stringify(after1));

  // その日に予定のない選手を入れる
  await page.locator('#player-move-modal .pm-row', { hasText: '二年 太郎' }).locator('.pm-add').tap();
  await page.waitForFunction(() => FCOjima.PlayerMove._state.moved.length === 2, null, { timeout: 10000 });
  await page.waitForTimeout(500);
  const conf2 = dialogs[dialogs.length - 1] || '';
  chk('予定のない選手の確認には「不参加になります」が出ない', !/不参加になります/.test(conf2) && /二年 太郎（2年） を「5・6年 試合」に入れますか/.test(conf2), conf2);
  const lines = await page.evaluate(() => FCOjima.PlayerMove._state.moved.map(FCOjima.PlayerMove.lineText));
  chk('LINE用の文面（移動元あり／なし）', lines[0] === '【参加変更】11/21(土) 四年 三郎（4年）：「3・4年 練習試合」→「5・6年 試合」' && lines[1] === '【参加変更】11/21(土) 二年 太郎（2年）：「5・6年 試合」に参加', JSON.stringify(lines));
  await page.tap('#player-move-modal .pm-copy-line');
  await page.waitForTimeout(500);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  chk('LINE用の文面をコピーできる', clip === lines.join('\n'), JSON.stringify(clip));
  notes = await list(`${T}/notifications`);
  const n2 = notes.find(n => n.memberId === 'p2a');
  chk('予定のない選手のお知らせは移動元なしで入る', n2 && n2.fromEventId === null && n2.fromEventTitle === '' && /「5・6年 試合」に参加/.test(n2.text), JSON.stringify(n2));
  const ov2 = await page.evaluate(overflow(), '#player-move-modal');
  chk('入れた選手の一覧が出ても 320px ではみ出さない', Array.isArray(ov2) && ov2.length === 0, JSON.stringify(ov2));
  await page.locator('#player-move-modal').screenshot({ path: 'pm-modal.png' });

  // 元に戻す（二年 太郎）
  await page.locator('#player-move-modal .pm-moved-row', { hasText: '二年 太郎' }).locator('.pm-undo').tap();
  await page.waitForFunction(() => FCOjima.PlayerMove._state.moved.length === 1, null, { timeout: 10000 });
  await page.waitForTimeout(800);
  const da2 = await get(`${T}/eventData/${EA}`), ea2 = await get(`${T}/events/${EA}`);
  notes = await list(`${T}/notifications`);
  chk('元に戻すと出欠の行・学年外追加・お知らせが元に戻る', !da2.attendance.some(a => a.name === '二年 太郎') && JSON.stringify(ea2.extraPlayers) === JSON.stringify(['四年 三郎']) && !notes.some(n => n.memberId === 'p2a'), JSON.stringify({ att: da2.attendance, ex: ea2.extraPlayers }));
  const back = await page.evaluate(() => [...document.querySelectorAll('#player-move-modal .pm-row')].map(r => r.dataset.name));
  chk('元に戻した選手は候補に戻る', back.includes('二年 太郎'), JSON.stringify(back));

  // 閉じると予定の詳細が最新の内容で開き直される
  await page.tap('#player-move-modal .close');
  await page.waitForTimeout(1200);
  const det = await page.evaluate(() => ({ open: document.getElementById('event-details-modal').style.display, pm: document.getElementById('player-move-modal').style.display, txt: document.getElementById('event-details-content').textContent }));
  chk('閉じると予定の詳細に戻る', det.open === 'flex' && det.pm === 'none' && /5・6年 試合/.test(det.txt), JSON.stringify({ open: det.open, pm: det.pm }));
  await page.evaluate(() => FCOjima.UI.closeModal('event-details-modal'));
  // ナイター練習の詳細には出さない
  await page.evaluate(id => FCOjima.Hub.Calendar.showEventDetails(id), EN);
  await page.waitForTimeout(500);
  chk('ナイター練習の詳細には「選手を入れる」が出ない', await page.evaluate(() => !document.getElementById('event-player-move-btn')), '');
  await page.evaluate(() => FCOjima.UI.closeModal('event-details-modal'));

  // 2) カレンダーの日付の数字をタップ → その日の予定一覧
  await page.evaluate(() => { FCOjima.Hub.currentDate = new Date(2026, 10, 1); FCOjima.Hub.Calendar.renderCalendar(); });
  await page.waitForTimeout(300);
  const hit = await page.evaluate(d => {
    const cell = document.querySelector(`#calendar-grid .calendar-day[data-date="${d}"]`);
    const dt = cell.querySelector('.date');
    cell.scrollIntoView({ block: 'center' });
    const r = dt.getBoundingClientRect(), rc = cell.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + 4, r.top + r.height / 2);
    return { h: r.height, w: r.width, cw: rc.width, top: top === dt, at: top && (top.className || top.tagName) };
  }, D);
  chk('日付の数字の行はマスの幅いっぱい・指で押せる高さ', hit.h >= 21.5 && hit.w >= hit.cw - 4 && hit.top, JSON.stringify(hit));
  await page.tap(`#calendar-grid .calendar-day[data-date="${D}"] .date`);
  await page.waitForTimeout(400);
  const dm = await page.evaluate(() => ({
    open: document.getElementById('day-events-modal').style.display,
    add: document.getElementById('event-modal').style.display,
    title: document.getElementById('day-events-title').textContent,
    items: [...document.querySelectorAll('#day-events-list .event-item')].map(e => e.querySelector('.event-title').textContent)
  }));
  chk('日付の数字をタップするとその日の予定一覧が開く（予定追加は開かない）', dm.open === 'flex' && dm.add !== 'flex' && /11月21日/.test(dm.title), JSON.stringify(dm));
  chk('その日の予定が時刻順に全部並ぶ', dm.items.length === 3 && /5・6年 試合/.test(dm.items[0]) && /3・4年 練習試合/.test(dm.items[1]) && /ナイター練習/.test(dm.items[2]), JSON.stringify(dm.items));
  const ov3 = await page.evaluate(overflow(), '#day-events-modal');
  chk('320px でその日の予定一覧がはみ出さない', Array.isArray(ov3) && ov3.length === 0, JSON.stringify(ov3));
  await page.locator('#day-events-modal .modal-content').screenshot({ path: 'pm-day.png' });
  await page.locator('#day-events-list .event-item', { hasText: '3・4年 練習試合' }).tap();
  await page.waitForTimeout(800);
  const d2 = await page.evaluate(() => {
    const det = document.getElementById('event-details-modal');
    const r = det.querySelector('.modal-content').getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + 20);
    return { det: det.style.display, onTop: det.contains(top), txt: document.getElementById('event-details-content').textContent };
  });
  chk('一覧の予定をタップするとその予定の詳細が一覧の上に開く', d2.det === 'flex' && d2.onTop && /3・4年 練習試合/.test(d2.txt), JSON.stringify({ det: d2.det, onTop: d2.onTop }));
  await page.tap('#event-details-modal .close');
  await page.waitForTimeout(300);
  chk('詳細を閉じるとその日の予定一覧に戻る', await page.evaluate(() => document.getElementById('day-events-modal').style.display === 'flex'), '');
  // 一覧を開いたまま予定が増えると一覧も更新される
  await put(`${T}/events/1900000040005`, { title: '追加された会議', date: D, type: 'event', startTime: '20:00' });
  await page.waitForFunction(() => document.querySelectorAll('#day-events-list .event-item').length === 4, null, { timeout: 8000 }).catch(() => {});
  chk('一覧を開いたまま予定が追加されると一覧に出る', await page.evaluate(() => document.querySelectorAll('#day-events-list .event-item').length === 4), '');
  // 行事（総会など）は試合と両方に出られるので、選手を入れる対象・移動元にしない
  await page.locator('#day-events-list .event-item', { hasText: '追加された会議' }).tap();
  await page.waitForTimeout(500);
  chk('行事の詳細には「選手を入れる」が出ない', await page.evaluate(() => /追加された会議/.test(document.getElementById('event-details-content').textContent) && !document.getElementById('event-player-move-btn')), '');
  await page.tap('#event-details-modal .close');
  await page.waitForTimeout(300);
  await page.tap('#day-events-add');
  await page.waitForTimeout(400);
  const add = await page.evaluate(() => ({ day: document.getElementById('day-events-modal').style.display, add: document.getElementById('event-modal').style.display, date: document.getElementById('event-date').value }));
  chk('「この日に予定を追加」でその日付の予定追加が開く', add.day === 'none' && add.add === 'flex' && add.date === '2026-11-21', JSON.stringify(add));
  await page.evaluate(() => FCOjima.UI.closeModal('event-modal'));
  // 予定のない日
  await page.tap('#calendar-grid .calendar-day[data-date="2026-11-24"] .date');
  await page.waitForTimeout(300);
  chk('予定のない日は「この日の予定はありません」', await page.evaluate(() => /この日の予定はありません/.test(document.getElementById('day-events-list').textContent)), '');
  await page.evaluate(() => FCOjima.UI.closeModal('day-events-modal'));
  // マスの日付以外の部分は従来どおり予定追加
  await page.evaluate(d => {
    const cell = document.querySelector(`#calendar-grid .calendar-day[data-date="${d}"]`);
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, '2026-11-24');
  await page.waitForTimeout(300);
  const add2 = await page.evaluate(() => ({ add: document.getElementById('event-modal').style.display, day: document.getElementById('day-events-modal').style.display, date: document.getElementById('event-date').value }));
  chk('マスの日付以外の部分のタップは従来どおり予定追加', add2.add === 'flex' && add2.day === 'none' && add2.date === '2026-11-24', JSON.stringify(add2));
  await page.evaluate(() => FCOjima.UI.closeModal('event-modal'));
  // カレンダーの予定を直接タップしたときは一覧を開かず詳細
  await page.tap(`#calendar-grid .calendar-day[data-date="${D}"] .event[data-event-id="${EA}"]`);
  await page.waitForTimeout(500);
  const direct = await page.evaluate(() => ({ det: document.getElementById('event-details-modal').style.display, day: document.getElementById('day-events-modal').style.display }));
  chk('カレンダーの予定を直接タップすると詳細（一覧は開かない）', direct.det === 'flex' && direct.day === 'none', JSON.stringify(direct));
  await page.evaluate(() => FCOjima.UI.closeModal('event-details-modal'));
  await page.screenshot({ path: 'pm-cal.png' });

  // 出欠状況の表: 移動（⇄）できるのは同じ日の試合・練習のセルだけ（行事のセルは移動しない）
  await page.evaluate(() => FCOjima.Hub.Admin.loadAttendanceMatrix());
  await page.waitForSelector('#attendance-matrix-container .attendance-matrix', { state: 'attached', timeout: 10000 });
  const mx = await page.evaluate(() => {
    const titles = [...document.querySelectorAll('#attendance-matrix-container thead th .e-title')].map(e => e.textContent);
    const movable = {};
    document.querySelectorAll('#attendance-matrix-container tbody tr').forEach(tr => {
      [...tr.querySelectorAll('td.mx-cell')].forEach((td, i) => { if (td.classList.contains('mx-cell-movable')) movable[titles[i]] = (movable[titles[i]] || 0) + 1; });
    });
    return { titles, movable };
  });
  chk('出欠状況の表で ⇄ が付くのは同じ日の試合・練習のセルだけ（行事・別の日は付かない）',
    mx.movable['5・6年 試合'] > 0 && mx.movable['3・4年 練習試合'] > 0 && !mx.movable['追加された会議'] && !mx.movable['別の日の試合'], JSON.stringify(mx));
  const bad = errs.filter(e => !/favicon|ERR_|Failed to load resource|open-meteo|gsi|storage/i.test(e));
  chk('ページエラーなし（管理者）', bad.length === 0, JSON.stringify(bad.slice(0, 5)));
  await ctx.close();
}

// 3) コーチが配車管理の出欠ページから入れる
{
  const ctx = await context({ email: 'pmcoach@example.com', name: '移動コーチ', device: 'iPhone 13' });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  page.on('dialog', d => d.accept());
  await page.goto(BASE + '/carpool/attendance.html?event=' + EB);
  await page.waitForFunction(() => document.querySelector('#attendance-table tbody tr') && FCOjima.Carpool._base, null, { timeout: 25000 });
  await page.waitForTimeout(800);
  const btns = await page.evaluate(() => ({ old: !!document.getElementById('player-move-attendance'), add: [...document.querySelectorAll('.action-buttons button')].filter(b => /参加者を追加|選手を入れる/.test(b.textContent)).length }));
  chk('出欠ページの「参加者を追加」と「他の予定・お休みの選手を入れる」が1つのボタンにまとまっている', !btns.old && btns.add === 1, JSON.stringify(btns));
  await page.tap('#add-attendee');
  await page.waitForSelector('#player-move-modal .pm-row', { timeout: 10000 });
  const pmTitle = await page.evaluate(() => ({ h: document.querySelector('#player-move-modal h2').textContent, old: document.getElementById('member-select-modal').style.display }));
  chk('コーチが試合の出欠ページで「参加者を追加」を押すと、同じ日の他の予定・予定のない選手から選ぶ画面が開く', pmTitle.h === '参加者を追加' && pmTitle.old !== 'flex', JSON.stringify(pmTitle));
  const rows = await page.evaluate(() => [...document.querySelectorAll('#player-move-modal .pm-section')].map(s => ({ t: s.firstChild.textContent, rows: [...s.querySelectorAll('.pm-row')].map(r => r.dataset.name) })));
  chk('出欠ページでも同じ日の他の試合の選手（不参加を除く）・予定のない選手が出る（行事は移動元にせず、行事だけの選手は予定なし扱い）', rows.length === 2 && JSON.stringify(rows[0].rows) === JSON.stringify(['六年 一郎']) && JSON.stringify(rows[1].rows) === JSON.stringify(['二年 太郎']), JSON.stringify(rows));
  await page.locator('#player-move-modal .pm-row', { hasText: '六年 一郎' }).locator('.pm-add').tap();
  await page.waitForFunction(() => FCOjima.PlayerMove._state.moved.length === 1, null, { timeout: 10000 });
  await page.locator('#player-move-modal .pm-row', { hasText: '二年 太郎' }).locator('.pm-add').tap();
  await page.waitForFunction(() => FCOjima.PlayerMove._state.moved.length === 2, null, { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.tap('#player-move-modal .close');
  await page.waitForFunction(() => [...document.querySelectorAll('#attendance-table tbody tr')].some(r => /六年 一郎/.test(r.textContent)), null, { timeout: 8000 }).catch(() => {});
  const table = await page.evaluate(() => [...document.querySelectorAll('#attendance-table tbody tr')].map(r => r.cells[0].textContent + ':' + (r.querySelector('select') || {}).value));
  chk('閉じると出欠表に入れた選手が「参加」で出る', table.includes('六年 一郎:present') && table.includes('二年 太郎:present') && table.includes('四年 三郎:absent'), JSON.stringify(table));
  const db = await get(`${T}/eventData/${EB}`), da = await get(`${T}/eventData/${EA}`), eb = await get(`${T}/events/${EB}`);
  chk('出欠ページから入れても移動元・移動先・学年外追加が正しく保存される', da.attendance.some(a => a.name === '六年 一郎' && a.status === 'absent') &&
    db.attendance.filter(a => a.name === '六年 一郎').length === 1 && db.carRegistrations.length === 1 &&
    JSON.stringify((eb.extraPlayers || []).slice().sort()) === JSON.stringify(['二年 太郎', '六年 一郎'].sort()), JSON.stringify({ db: db.attendance, ex: eb.extraPlayers }));
  // 統計も更新される
  const stats = await page.evaluate(() => (document.getElementById('attendance-stats') || document.querySelector('.attendance-stats') || {}).textContent || '');
  console.log('stats:', stats.replace(/\s+/g, ' ').slice(0, 120));
  // その後に手元で出欠を変えても、入れた選手の出欠は上書きされない
  await page.locator('#attendance-table tbody tr', { hasText: '四年 四郎' }).locator('select').selectOption('present');
  await page.evaluate(() => FCOjima.Carpool.whenSaved());
  await page.waitForTimeout(500);
  const db2 = await get(`${T}/eventData/${EB}`);
  chk('閉じた後に出欠を変えても入れた選手の出欠は残る', db2.attendance.some(a => a.name === '六年 一郎' && a.status === 'present') && db2.attendance.some(a => a.name === '四年 四郎' && a.status === 'present'), JSON.stringify(db2.attendance));
  const bad = errs.filter(e => !/favicon|ERR_|Failed to load resource|open-meteo|gsi|storage/i.test(e));
  chk('ページエラーなし（コーチ）', bad.length === 0, JSON.stringify(bad.slice(0, 5)));
  await ctx.close();
}

// 4) 保護者: ボタンは出ず、変更のお知らせが届く
{
  const ctx = await context({ email: 'pmmom@example.com', name: '四年 母', device: SE });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  page.on('dialog', d => d.accept());
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const notice = await page.evaluate(() => ({ open: document.getElementById('move-notice-modal').style.display, txt: document.getElementById('move-notice-body').textContent }));
  console.log(JSON.stringify(notice));
  chk('保護者に参加イベント変更のお知らせが出る（移動元あり）', notice.open === 'flex' && /四年 三郎/.test(notice.txt) && /「3・4年 練習試合」→「5・6年 試合」へ変更/.test(notice.txt), notice.txt.slice(0, 200));
  chk('予定のなかった子のお知らせは「〇〇に参加することになりました」', /二年 太郎/.test(notice.txt) && /「3・4年 練習試合」に参加することになりました/.test(notice.txt), notice.txt.slice(0, 300));
  const ov = await page.evaluate(overflow(), '#move-notice-modal');
  chk('320px でお知らせがはみ出さない', Array.isArray(ov) && ov.length === 0, JSON.stringify(ov));
  await page.evaluate(() => FCOjima.UI.closeModal('move-notice-modal'));
  await page.evaluate(id => FCOjima.Hub.Calendar.showEventDetails(id), EA);
  await page.waitForTimeout(500);
  chk('保護者の予定の詳細には「選手を入れる」が出ない', await page.evaluate(() => !!document.getElementById('event-details-content').textContent && !document.getElementById('event-player-move-btn')), '');
  const r = await page.evaluate(async (ev) => { try { await FCOjima.PlayerMove.open(ev, { members: FCOjima.Hub.members }); } catch (e) { return 'err ' + e.message; } return document.getElementById('player-move-modal') ? document.getElementById('player-move-modal').style.display : 'none'; }, { id: EA, date: '2026-11-21', title: 'x' });
  chk('保護者は画面を直接呼んでも開けない', r === 'none', r);
  await page.evaluate(() => FCOjima.UI.closeModal('event-details-modal'));
  // 保護者も日付タップで一覧は使える
  await page.evaluate(() => { FCOjima.Hub.currentDate = new Date(2026, 10, 1); FCOjima.Hub.Calendar.renderCalendar(); });
  await page.tap(`#calendar-grid .calendar-day[data-date="${D}"] .date`);
  await page.waitForTimeout(300);
  chk('保護者も日付タップでその日の予定一覧を開ける', await page.evaluate(() => document.getElementById('day-events-modal').style.display === 'flex' && document.querySelectorAll('#day-events-list .event-item').length === 4), '');
  await page.evaluate(() => FCOjima.UI.closeModal('day-events-modal'));
  await page.goto(BASE + '/carpool/attendance.html?event=' + EB);
  await page.waitForFunction(() => document.querySelector('#attendance-table tbody tr') && FCOjima.Carpool._base, null, { timeout: 25000 });
  await page.waitForTimeout(500);
  await page.tap('#add-attendee');
  await page.waitForTimeout(500);
  const par = await page.evaluate(() => ({ pm: (document.getElementById('player-move-modal') || {style:{}}).style.display || 'none', old: document.getElementById('member-select-modal').style.display }));
  chk('保護者が「参加者を追加」を押すと、これまでどおりメンバーの一覧から追加する画面', par.pm !== 'flex' && par.old === 'flex', JSON.stringify(par));
  const bad = errs.filter(e => !/favicon|ERR_|Failed to load resource|open-meteo|gsi|storage/i.test(e));
  chk('ページエラーなし（保護者）', bad.length === 0, JSON.stringify(bad.slice(0, 5)));
  await ctx.close();
}
await closeBrowser();
process.exit(summary() ? 1 : 0);
