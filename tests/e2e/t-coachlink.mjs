// 監督が決めた帯同指導者（coachAssignments）を、予定の詳細・配車（概要・車提供・座席の割り当て）に出す
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors } from './lib.mjs';
await wipe();
const E1 = '1900000100001';  // 帯同指導者: 鈴木
const E2 = '1900000100002';  // 帯同指導者が未定
await put(`${T}/members/c1`, { name: '佐藤 監督', role: 'coach', abbr: '佐藤' });
await put(`${T}/members/c2`, { name: '鈴木 コーチ', role: 'assist', abbr: '鈴木' });
// 保護者を兼ねるコーチ（子供 p2 が参加）
await put(`${T}/members/c3`, { name: '田中 コーチ', role: 'assist', abbr: '田中', childrenIds: ['p2'] });
await put(`${T}/members/p1`, { name: '一年 太郎', role: 'player', grade: '1' });
await put(`${T}/members/p2`, { name: '田中 次郎', role: 'player', grade: '1' });
await put(`${T}/members/f1`, { name: '一年 母', role: 'mother', abbr: '一年母', childrenIds: ['p1'] });
const att = ['一年 太郎', '田中 次郎'].map(n => ({ name: n, status: 'present', notes: '' }));
const car = { parent: '一年 母', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 0, notes: '', extraPassengers: [] };
for (const [id, title] of [[E1, '笠懸'], [E2, '岩松']]) {
  await put(`${T}/events/${id}`, { title, date: '2026-11-28', type: 'game', target: ['1'], startTime: '09:00' });
  await put(`${T}/eventData/${id}`, { attendance: att, carRegistrations: [car] });
}
await put(`${T}/coachAssignments/${E1}`, { memberIds: ['c2'] });
await makeUser('kantoku@example.com', '佐藤 監督', 'coach');
await makeUser('mom@example.com', '一年 母', 'parent', { childrenIds: ['p1'] });
const mob = { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const ignorable = e => /favicon|ERR_|Failed to load resource|open-meteo|gsi|storage/i.test(e);
const dock = (page) => page.evaluate(() => {
  const out = {};
  let cur = null;
  [...document.querySelectorAll('#members-container > *')].forEach(el => {
    if (el.classList.contains('member-group-header')) { cur = el.textContent; out[cur] = []; }
    else if (cur) out[cur] = [...el.querySelectorAll('.member-item')].map(m => (m.querySelector('.coach-icon') ? '🧢' : '') + m.querySelector('.member-name').textContent);
  });
  return out;
});
const openAssign = async (page, ev) => {
  await page.goto(BASE + '/carpool/assignments.html?event=' + ev);
  await page.waitForFunction(() => document.querySelectorAll('.car-layout').length === 1 && document.querySelector('#members-container .member-item'), null, { timeout: 25000 });
  await page.waitForTimeout(600);
};

// 1) 監督: 座席の割り当て
{
  const ctx = await context({ email: 'kantoku@example.com', name: '佐藤 監督', device: mob });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  page.on('dialog', d => d.accept());
  await openAssign(page, E1);
  const d1 = await dock(page);
  chk('帯同指導者が決まっている予定: メンバー帯の「🧢 帯同指導者」に担当の人だけが🧢付きで出る', JSON.stringify(d1['🧢 帯同指導者']) === JSON.stringify(['🧢鈴木']) && !JSON.stringify(d1).includes('佐藤'), JSON.stringify(d1));
  chk('担当でない保護者兼任のコーチは、子供が参加なら保護者として（🧢なしで）出る', (d1['保護者'] || []).includes('田中') && !(d1['保護者'] || []).includes('🧢田中'), JSON.stringify(d1['保護者']));
  const top = await page.evaluate(() => document.getElementById('assignment-event-info').textContent.replace(/\s+/g, ''));
  chk('ページ上部の予定の欄に「🧢 帯同指導者 鈴木 コーチ」', /🧢帯同指導者鈴木コーチ/.test(top), top);
  const bar = await page.evaluate(() => (document.getElementById('assignment-stats-bar-nav') || document.getElementById('assignment-stats-bar-fs')).textContent.replace(/\s+/g, ''));
  chk('参加人数は 選手2＋帯同指導者1＋保護者兼任のコーチ1（運転する母は除く）', /参加人数4\//.test(bar), bar);
  // 鈴木を座席へ
  await page.evaluate(() => {
    const A = FCOjima.Carpool.Assignment;
    A.setSeatOccupant(document.querySelector('.seat[data-seat-type="助手席"][data-seat-index="0"]'), '鈴木 コーチ');
    A.saveAssignments(); A.updateMembersList();
  });
  await page.waitForTimeout(300);
  const seat = await page.evaluate(() => {
    const s = document.querySelector('.seat[data-seat-type="助手席"][data-seat-index="0"]');
    return { coach: s.classList.contains('seat-coach'), mark: getComputedStyle(s, '::before').content, name: s.querySelector('.seat-name-tag').textContent };
  });
  chk('座席に置いた帯同指導者には🧢の印が付く', seat.coach && /🧢/.test(seat.mark) && seat.name === '鈴木', JSON.stringify(seat));
  // 座席をタップした一覧
  await page.evaluate(() => FCOjima.Carpool.Assignment.openSeatEditModal(document.querySelector('.seat[data-seat-type="中列"][data-seat-index="0"]')));
  await page.waitForTimeout(200);
  const list = await page.evaluate(() => [...document.querySelectorAll('#seat-member-list > div')].map(d => d.textContent));
  chk('座席をタップしたときの一覧でも、帯同指導者でない監督は出ない', !list.some(t => /佐藤/.test(t)), JSON.stringify(list));
  await page.evaluate(() => FCOjima.UI.closeModal('seat-edit-modal'));
  await page.screenshot({ path: 'cl-assign.png' });
  // 外すと🧢も消える
  await page.evaluate(() => {
    const A = FCOjima.Carpool.Assignment;
    A.clearSeat(document.querySelector('.seat[data-seat-type="助手席"][data-seat-index="0"]'));
    A.saveAssignments(); A.updateMembersList();
  });
  await page.evaluate(() => FCOjima.Carpool.whenSaved());
  chk('座席から外すと🧢の印も消え、メンバー帯に戻る', await page.evaluate(() => !document.querySelector('.seat.seat-coach') && !!document.querySelector('#members-container .member-item.event-coach')), '');

  // 帯同指導者が未定の予定: 従来どおり監督・コーチ全員
  await openAssign(page, E2);
  const d2 = await dock(page);
  const key2 = Object.keys(d2).find(k => /監督・コーチ/.test(k)) || '';
  chk('帯同指導者が未定の予定は、これまでどおり監督・コーチ全員（見出しで未定と分かる）', /未定/.test(key2) && ['🧢佐藤', '🧢鈴木', '🧢田中'].every(n => d2[key2].includes(n)), JSON.stringify(d2));
  const top2 = await page.evaluate(() => document.getElementById('assignment-event-info').textContent);
  chk('未定のときは予定の欄に帯同指導者は出ない', !/帯同指導者/.test(top2), top2.replace(/\s+/g, ''));

  // 車提供: 運転者を選ぶ一覧のいちばん上に帯同指導者
  await page.goto(BASE + '/carpool/cars.html?event=' + E1);
  await page.waitForFunction(() => FCOjima.Carpool._base && document.querySelector('#cp-car'), null, { timeout: 25000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => FCOjima.Carpool.CarProvision.openDriverSelectModal());
  await page.waitForTimeout(200);
  const drivers = await page.evaluate(() => [...document.querySelectorAll('#driver-select-list .list-item')].map(i => i.textContent));
  chk('車提供の運転者の一覧で、帯同指導者がいちばん上に🧢付きで出る', drivers[0] === '🧢 鈴木 コーチ' && drivers.filter(t => /鈴木/.test(t)).length === 1, JSON.stringify(drivers));
  const carTop = await page.evaluate(() => document.getElementById('carEventInfo').textContent.replace(/\s+/g, ''));
  chk('車提供のページ上部にも帯同指導者', /帯同指導者鈴木コーチ/.test(carTop), carTop);
  await page.evaluate(() => FCOjima.UI.closeModal('driver-select-modal'));

  // HUB: 予定の詳細
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(600);
  await page.evaluate(id => FCOjima.Hub.Calendar.showEventDetails(id), E1);
  await page.waitForSelector('#event-coach-btn', { timeout: 8000 });
  const det = await page.evaluate(() => [...document.querySelectorAll('#event-details-content .ed-fact')].map(f => f.textContent.replace(/\s+/g, '')).filter(t => /帯同/.test(t)));
  chk('HUBの予定の詳細に「🧢 帯同指導者 鈴木 コーチ」', det.length === 1 && /🧢帯同指導者鈴木コーチ担当/.test(det[0]), JSON.stringify(det));
  const bad = errs.filter(e => !ignorable(e));
  chk('ページエラーなし（監督）', bad.length === 0, JSON.stringify(bad.slice(0, 3)));
  await ctx.close();
}

// 2) 保護者: 配車の概要・座席の割り当て
{
  const ctx = await context({ email: 'mom@example.com', name: '一年 母', device: mob });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  page.on('dialog', d => d.accept());
  await page.goto(BASE + '/carpool/index.html?event=' + E1);
  await page.waitForFunction(() => document.querySelector('#status-summary .ov-grid'), null, { timeout: 25000 });
  await page.waitForTimeout(500);
  const ov = await page.evaluate(() => (document.getElementById('overview-coaches') || {}).textContent || '');
  chk('配車の概要に帯同指導者が出る（保護者にも）', /🧢 帯同指導者/.test(ov) && /鈴木 コーチ/.test(ov), ov);
  const card = await page.evaluate(() => [...document.querySelectorAll('#status-summary .ov-card')].map(c => c.textContent.replace(/\s+/g, '')).find(t => /割り当て/.test(t)));
  chk('概要の「割り当て」の人数に帯同指導者も入る（選手2＋帯同指導者1）', /0\/3/.test(card || ''), card);
  await page.screenshot({ path: 'cl-overview.png', fullPage: true });
  await openAssign(page, E1);
  const d = await dock(page);
  chk('保護者が開いても座席の割り当てに帯同指導者が🧢付きで出る', JSON.stringify(d['🧢 帯同指導者']) === JSON.stringify(['🧢鈴木']), JSON.stringify(d));
  // 未定の予定の概要には出ない
  await page.goto(BASE + '/carpool/index.html?event=' + E2);
  await page.waitForFunction(() => document.querySelector('#status-summary .ov-grid'), null, { timeout: 25000 });
  await page.waitForTimeout(500);
  chk('帯同指導者が未定の予定の概要には出ない', await page.evaluate(() => (document.getElementById('overview-coaches') || {}).textContent === ''), '');
  const bad = errs.filter(e => !ignorable(e));
  chk('ページエラーなし（保護者）', bad.length === 0, JSON.stringify(bad.slice(0, 3)));
  await ctx.close();
}
await closeBrowser();
process.exit(summary() ? 1 : 0);
