// 割り当て・車提供・帯同指導者のデバッグで直した点
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors } from './lib.mjs';
await wipe();
const EV = '1900000120001';
await put(`${T}/members/c1`, { name: '佐藤 監督', role: 'coach', abbr: '佐藤' });
await put(`${T}/members/c2`, { name: '鈴木 コーチ', role: 'assist', abbr: '鈴木' });
await put(`${T}/members/p1`, { name: '一年 太郎', role: 'player', grade: '1' });
await put(`${T}/members/p2`, { name: '二年 次郎', role: 'player', grade: '1' });
await put(`${T}/members/f1`, { name: '一年 母', role: 'mother', childrenIds: ['p1'] });
await put(`${T}/members/f2`, { name: '二年 父', role: 'father', childrenIds: ['p2'] });
await put(`${T}/members/o1`, { name: '役員 花子', role: 'officer' });
await put(`${T}/events/${EV}`, { title: '練習試合', date: '2026-11-28', type: 'game', target: ['1'] });
// 以前の運転手の変更で、二年 父 が車1の運転手なのに車0の座席にも残っているデータ
await put(`${T}/eventData/${EV}`, {
  attendance: ['一年 太郎', '二年 次郎'].map(n => ({ name: n, status: 'present', notes: '' })),
  carRegistrations: [
    { parent: '一年 母', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 0, notes: '', extraPassengers: [] },
    { parent: '二年 父', canDrive: 'both', frontSeat: 0, middleSeat: 0, backSeat: 0, notes: '', extraPassengers: [] }
  ],
  assignments: [
    { carIndex: 0, driver: '一年 母', seats: { '助手席': {}, '中列': { 0: '二年 父', 1: '一年 太郎' }, '後列': {} } },
    { carIndex: 1, driver: '二年 父', seats: { '助手席': {}, '中列': {}, '後列': {} } }
  ]
});
await put(`${T}/coachAssignments/${EV}`, { memberIds: ['c2'] });
await makeUser('dbg@example.com', '佐藤 監督', 'coach');
await makeUser('suzu@example.com', '鈴木 コーチ', 'parent');
const mob = { viewport: { width: 390, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const ignorable = e => /favicon|ERR_|Failed to load resource|open-meteo|gsi|storage/i.test(e);
const dialogs = [];

const ctx = await context({ email: 'dbg@example.com', name: '佐藤 監督', device: mob });
const page = await ctx.newPage();
const errs = watchErrors(page);
page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
const open = async () => {
  await page.goto(BASE + '/carpool/assignments.html?event=' + EV);
  await page.waitForFunction(() => document.querySelectorAll('.car-layout').length === 2 && document.querySelector('#members-container .member-item'), null, { timeout: 25000 });
  await page.waitForTimeout(600);
};
const seats = () => page.evaluate(() => [...document.querySelectorAll('.car-layout')].map(l => [l.querySelector('.seat.driver-seat').dataset.person || ''].concat([...l.querySelectorAll('.seat:not(.driver-seat)')].map(s => s.dataset.person || ''))));
const dock = () => page.evaluate(() => [...document.querySelectorAll('#members-container .member-item')].map(m => m.dataset.name));
const saved = async () => { await page.evaluate(() => FCOjima.Carpool.whenSaved()); return get(`${T}/eventData/${EV}`); };
await open();

// A) 運転手が座席にも残っている古いデータ
let s = await seats();
chk('運転手が座席にも残っていた古いデータでも、運転席だけに出る（座席は空く）', s[0][2] === '' && s[0][3] === '一年 太郎' && s[1][0] === '二年 父', JSON.stringify(s));

// B) 座席数を減らす → なくなった席の人は配置待ちへ（保存にも反映）
await page.evaluate(() => {
  const A = FCOjima.Carpool.Assignment;
  A.openSeatCountModal(0);
  const span = document.querySelector('#seat-count-form-rows [data-key="middleSeat"]');
  span.dataset.value = '1';
  document.getElementById('apply-seat-count').click();
});
let d = await saved();
const dk = await dock();
const mid = (d.assignments.find(a => a.driver === '一年 母') || {}).seats || {};
chk('座席数を減らすと、なくなった席の選手は配置待ちに戻り、保存からも消える', dk.includes('一年 太郎') && !Object.values(mid['中列'] || {}).includes('一年 太郎') && d.carRegistrations[0].middleSeat === 1, JSON.stringify({ dk, mid, car: d.carRegistrations[0] }));

// C) ランダム割り当て: 埋まっていれば確かめる・乗れなかった大人も数えて知らせる
await page.evaluate(() => {
  const A = FCOjima.Carpool.Assignment;
  A.setSeatOccupant(document.querySelector('.car-layout[data-car-index="0"] .seat[data-seat-type="中列"][data-seat-index="0"]'), '一年 太郎');
  A.saveAssignments(); A.updateMembersList();
});
dialogs.length = 0;
await page.evaluate(() => document.getElementById('generate-random').click());
await page.waitForTimeout(400);
const toast = await page.evaluate(() => [...document.querySelectorAll('.toast-notification')].map(t => t.textContent).pop() || '');
// 席は 助手席1＋中列1（車0）＝2。座る人: 鈴木（帯同）・選手2 → 1人乗れない
chk('ランダム割り当ては、いまの割り当てを消す前に確かめる', dialogs.some(m => /ランダムに割り当て直しますか/.test(m)), JSON.stringify(dialogs));
chk('席が足りないとき、乗れなかった人数（大人も含む）を知らせる', /1名のメンバーに乗車スペースがありません/.test(toast), toast);

// D) 車提供の「必要 N席」に帯同指導者も入る（概要と同じ数え方）
await page.goto(BASE + '/carpool/cars.html?event=' + EV);
await page.waitForFunction(() => FCOjima.Carpool._base && document.getElementById('car-stats') && /必要/.test(document.getElementById('car-stats').textContent), null, { timeout: 25000 });
const stats = await page.evaluate(() => document.getElementById('car-stats').textContent.replace(/\s+/g, ''));
chk('車提供の「必要 N席」に帯同指導者も入る（選手2＋鈴木）', /必要3席/.test(stats), stats);

// F) 運転手にしたことだけで加わった人は、配置待ちから外せる
await open();
await page.evaluate(() => FCOjima.Carpool.Assignment._applyDriverChange(1, '役員 花子'));
await page.evaluate(() => FCOjima.Carpool.Assignment._applyDriverChange(1, '二年 父'));
await page.waitForTimeout(200);
const rmBtn = await page.evaluate(() => {
  const el = document.querySelector('#members-container .member-item[data-name="役員 花子"]');
  return el ? !!el.querySelector('.member-remove-btn') : null;
});
const noRm = await page.evaluate(() => [...document.querySelectorAll('#members-container .member-item')].filter(m => m.dataset.name !== '役員 花子' && m.querySelector('.member-remove-btn')).map(m => m.dataset.name));
chk('運転手にしたことだけで加わった役員は配置待ちに出て、×で外せる（ほかの人には×がない）', rmBtn === true && noRm.length === 0, JSON.stringify({ rmBtn, noRm }));
await page.tap('#members-container .member-item[data-name="役員 花子"] .member-remove-btn');
await page.waitForTimeout(300);
d = await saved();
chk('×で外すと配置待ちから消え、保存からも消える', !(await dock()).includes('役員 花子') && !(d.driverPeople || []).includes('役員 花子'), JSON.stringify(d.driverPeople));

// H) 帯同指導者を替えた後: 前の担当が座席に残っていれば「対象外」と知らせて外せる
await put(`${T}/coachAssignments/${EV}`, { memberIds: ['c1'] });
await open();
const h = await page.evaluate(() => ({
  outside: [...document.querySelectorAll('.seat.seat-outside')].map(s => s.dataset.person + ':' + (s.querySelector('.seat-outside-label') || {}).textContent),
  warn: (document.getElementById('seat-outside-warning') || {}).textContent || '',
  coachGroup: [...document.querySelectorAll('#members-container .member-item.event-coach')].map(m => m.dataset.name)
}));
chk('帯同指導者を替えると、座席に残った前の担当に「対象外」と出て、上部で知らせる（新しい担当は🧢で配置待ちに）', JSON.stringify(h.outside) === JSON.stringify(['鈴木 コーチ:対象外']) && /対象でなくなった人/.test(h.warn) && JSON.stringify(h.coachGroup) === JSON.stringify(['佐藤 監督']), JSON.stringify(h));
await page.tap('#seat-outside-warning .seat-absent-clear-btn');
await page.waitForTimeout(300);
d = await saved();
const inSeats = JSON.stringify(d.assignments).includes('鈴木 コーチ');
chk('「座席から外す」で前の担当を外せる（配置待ちにも出ない）', !inSeats && !(await dock()).includes('鈴木 コーチ') && await page.evaluate(() => document.getElementById('seat-outside-warning').style.display === 'none'), JSON.stringify(d.assignments));
await put(`${T}/coachAssignments/${EV}`, { memberIds: ['c2'] });  // 後の確認（E）のため鈴木を担当に戻す

// G) メンバーの名前を変えると、車の持ち主・運転手だった人の記録も変わる
await page.goto(BASE + '/hub/index.html');
await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub.Members && FCOjima.Hub.Members._renameInEventData, null, { timeout: 30000 });
const patch = await page.evaluate(() => FCOjima.Hub.Members._renameInEventData({
  carRegistrations: [{ parent: '鈴木 コーチ', owner: '一年 母' }, { parent: '一年 母' }],
  driverPeople: ['一年 母', '役員 花子'],
  assignments: []
}, '一年 母', '一年 ママ'));
chk('名前を変えると、車の持ち主（owner）・運転手・運転手だった人の記録も変わる', patch.carRegistrations[0].owner === '一年 ママ' && patch.carRegistrations[0].parent === '鈴木 コーチ' && patch.carRegistrations[1].parent === '一年 ママ' && JSON.stringify(patch.driverPeople) === JSON.stringify(['一年 ママ', '役員 花子']), JSON.stringify(patch));
const bad = errs.filter(e => !ignorable(e));
chk('ページエラーなし（監督）', bad.length === 0, JSON.stringify(bad.slice(0, 3)));
await ctx.close();

// E) ログインの役割が保護者のままの指導者: 回答のボタンは出さず案内（担当は見える）
{
  const c2 = await context({ email: 'suzu@example.com', name: '鈴木 コーチ', device: mob });
  const p2 = await c2.newPage();
  const errs2 = watchErrors(p2);
  await p2.goto(BASE + '/hub/index.html');
  await p2.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await p2.waitForTimeout(800);
  await p2.evaluate(() => FCOjima.UI.closeModal('move-notice-modal'));
  await p2.tap('#my-events-tab');
  await p2.waitForSelector('#my-coaching .co-my', { timeout: 10000 });
  await p2.waitForTimeout(500);
  const v = await p2.evaluate(() => ({
    hint: (document.querySelector('#my-coaching .co-role-hint') || {}).textContent || '',
    buttons: document.querySelectorAll('#my-coaching .co-ans').length,
    duty: [...document.querySelectorAll('#my-coaching .co-duty-item')].map(b => b.textContent)
  }));
  chk('役割が保護者の指導者には、保存できない回答ボタンを出さずに案内し、担当は見せる', /役割が「監督」か「コーチ」/.test(v.hint) && v.buttons === 0 && v.duty.length === 1 && /練習試合/.test(v.duty[0]), JSON.stringify(v));
  const bad2 = errs2.filter(e => !ignorable(e) && !/permission/i.test(e));
  chk('ページエラーなし（保護者の役割の指導者）', bad2.length === 0, JSON.stringify(bad2.slice(0, 3)));
  await c2.close();
}
await closeBrowser();
process.exit(summary() ? 1 : 0);
