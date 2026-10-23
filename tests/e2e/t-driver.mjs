// 配車の割り当て: 運転手をほかの席・別の車・配置待ちへ移す（メンバーも、車提供で名前を直接入力した人も）
// 車の名前は運転手に合わせる。選手・兄弟児は運転席に座れない。監督・コーチ・保護者は座れる
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors } from './lib.mjs';
await wipe();
const EV = '1900000110001';
await put(`${T}/members/c1`, { name: '佐藤 監督', role: 'coach', abbr: '佐藤' });
await put(`${T}/members/c2`, { name: '鈴木 コーチ', role: 'assist', abbr: '鈴木' });
await put(`${T}/members/p1`, { name: '一年 太郎', role: 'player', grade: '1' });
await put(`${T}/members/p2`, { name: '二年 次郎', role: 'player', grade: '1' });
await put(`${T}/members/f1`, { name: '一年 母', role: 'mother', abbr: '一年母', childrenIds: ['p1'], siblings: [{ name: '妹', note: '' }] });
await put(`${T}/members/f2`, { name: '二年 父', role: 'father', abbr: '二年父', childrenIds: ['p2'] });
await put(`${T}/members/o1`, { name: '役員 花子', role: 'officer', abbr: '役員' });
await put(`${T}/events/${EV}`, { title: '練習試合', date: '2026-11-28', type: 'game', target: ['1'] });
await put(`${T}/eventData/${EV}`, {
  attendance: ['一年 太郎', '二年 次郎'].map(n => ({ name: n, status: 'present', notes: '' })),
  carRegistrations: [
    { parent: '一年 母', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 0, notes: '', extraPassengers: [{ name: '妹', seatType: '中列', seatIndex: 2 }] },
    { parent: '祖父 太郎', canDrive: 'both', frontSeat: 1, middleSeat: 2, backSeat: 0, notes: '', extraPassengers: [] }
  ]
});
await makeUser('drv@example.com', '佐藤 監督', 'coach');
const mob = { viewport: { width: 390, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const ignorable = e => /favicon|ERR_|Failed to load resource|open-meteo|gsi|storage/i.test(e);

const ctx = await context({ email: 'drv@example.com', name: '佐藤 監督', device: mob });
const page = await ctx.newPage();
const errs = watchErrors(page);
page.on('dialog', d => d.accept());
const open = async () => {
  await page.goto(BASE + '/carpool/assignments.html?event=' + EV);
  await page.waitForFunction(() => document.querySelectorAll('.car-layout').length === 2 && document.querySelector('#members-container .member-item'), null, { timeout: 25000 });
  await page.waitForTimeout(600);
};
await open();

const S = (ci, t, i) => t === 'driver' ? `.car-layout[data-car-index="${ci}"] .seat.driver-seat` : `.car-layout[data-car-index="${ci}"] .seat[data-seat-type="${t}"][data-seat-index="${i}"]`;
const state = () => page.evaluate(() => ({
  cars: [...document.querySelectorAll('.car-layout')].map(l => ({
    title: l.querySelector('.car-header-name').textContent,
    driver: l.querySelector('.seat.driver-seat').dataset.person || '',
    empty: l.querySelector('.seat.driver-seat').classList.contains('driver-empty'),
    seats: [...l.querySelectorAll('.seat:not(.driver-seat)')].map(s => s.dataset.person || '')
  })),
  dock: [...document.querySelectorAll('#members-container .member-item')].map(m => m.dataset.name),
  warn: (document.getElementById('driver-empty-warning') || {}).style ? (document.getElementById('driver-empty-warning').style.display !== 'none' ? document.getElementById('driver-empty-warning').textContent : '') : '',
  toast: [...document.querySelectorAll('.toast-notification')].map(t => t.textContent).pop() || ''
}));
// PCのドラッグ（handleDragStart と同じデータで drop を起こす）
const drop = (target, data) => page.evaluate(([sel, d]) => {
  const el = sel === '#members-container' ? document.getElementById('members-container') : document.querySelector(sel);
  const dt = new DataTransfer();
  dt.setData('text/plain', d.name);
  dt.setData('application/json', JSON.stringify(d));
  el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
}, [target, data]);
const fromDriver = (ci, name) => ({ type: 'seat', name, fromCarIndex: String(ci), fromSeatType: 'driver', fromSeatIndex: '0' });
const fromSeat = (ci, t, i, name) => ({ type: 'seat', name, fromCarIndex: String(ci), fromSeatType: t, fromSeatIndex: String(i) });
const member = name => ({ type: 'member', name });
const saved = async () => { await page.evaluate(() => FCOjima.Carpool.whenSaved()); return get(`${T}/eventData/${EV}`); };

let st = await state();
chk('最初: 車の名前は運転手（メンバーは略称・直接入力の人は名前）', st.cars[0].title === '一年母' && st.cars[1].title === '祖父 太郎', JSON.stringify(st.cars.map(c => c.title)));
chk('最初: 運転手はメンバー帯に出ない', !st.dock.includes('一年 母') && !st.dock.includes('祖父 太郎'), JSON.stringify(st.dock));

// 1) 直接入力の運転手を配置待ちへ
await drop('#members-container', fromDriver(1, '祖父 太郎'));
st = await state();
let d = await saved();
chk('直接入力の運転手も配置待ちへ移せる（車は「運転手未定」・警告が出る）', st.cars[1].title === '運転手未定' && st.cars[1].empty && st.dock.includes('祖父 太郎') && /運転手が決まっていない車が1台/.test(st.warn), JSON.stringify({ c: st.cars[1], dock: st.dock, w: st.warn }));
chk('保存: 運転手は空・持ち主（owner）は残る・割り当ての運転手も空', d.carRegistrations[1].parent === '' && d.carRegistrations[1].owner === '祖父 太郎' && d.assignments[1].driver === '', JSON.stringify({ car: d.carRegistrations[1], a: d.assignments[1] }));

// 2) 保護者（メンバー帯）を空いた運転席へ
await drop(S(1, 'driver'), member('二年 父'));
st = await state();
chk('保護者をメンバー帯から運転席へ置くと運転手になり、車の名前も替わる', st.cars[1].driver === '二年 父' && st.cars[1].title === '二年父' && !st.cars[1].empty && !st.warn && !st.dock.includes('二年 父'), JSON.stringify({ c: st.cars[1], w: st.warn }));

// 3) 選手は運転席に置けない
await drop(S(1, 'driver'), member('一年 太郎'));
st = await state();
chk('選手は運転席に置けない（案内が出て運転手はそのまま）', st.cars[1].driver === '二年 父' && st.dock.includes('一年 太郎') && /選手なので運転席に座れません/.test(st.toast), JSON.stringify({ c: st.cars[1], t: st.toast }));

// 4) 直接入力の人を座席へ（この予定の中で別の車へ）
await drop(S(0, '中列', 0), member('祖父 太郎'));
st = await state();
chk('直接入力の人も、配置待ちから別の車の座席へ置ける', st.cars[0].seats[1] === '祖父 太郎' && !st.dock.includes('祖父 太郎'), JSON.stringify(st.cars[0]));

// 5) 運転席どうしの入れ替え
await drop(S(1, 'driver'), fromDriver(0, '一年 母'));
st = await state();
chk('運転手を別の車の運転席へドラッグすると入れ替わり、両方の車の名前も替わる', st.cars[0].driver === '二年 父' && st.cars[1].driver === '一年 母' && st.cars[0].title === '二年父' && st.cars[1].title === '一年母', JSON.stringify(st.cars.map(c => c.title + ':' + c.driver)));

// 6) 運転手を座席の人と入れ替え（座席の人が運転できる人なら）
await drop(S(0, '中列', 0), fromDriver(0, '二年 父'));
st = await state();
chk('運転手を座席へドラッグすると座席の人と入れ替わる（直接入力の人が運転席へ）', st.cars[0].driver === '祖父 太郎' && st.cars[0].seats[1] === '二年 父' && st.cars[0].title === '祖父 太郎', JSON.stringify(st.cars[0]));

// 7) 選手のいる座席と運転席は入れ替えできない・兄弟児の席にも入れない
await drop(S(1, '中列', 0), member('一年 太郎'));
await drop(S(1, 'driver'), fromSeat(1, '中列', 0, '一年 太郎'));
st = await state();
chk('座席の選手を運転席へドラッグしても入らない', st.cars[1].driver === '一年 母' && st.cars[1].seats[1] === '一年 太郎', JSON.stringify(st.cars[1]));
await drop(S(0, '中列', 2), fromDriver(0, '祖父 太郎'));
st = await state();
chk('兄弟児などの席に運転手を移そうとしても入らない', st.cars[0].driver === '祖父 太郎' && st.cars[0].seats[3] === '妹' && /兄弟児など/.test(st.toast), JSON.stringify({ c: st.cars[0], t: st.toast }));
// 兄弟児は運転席に置けない
await drop(S(0, 'driver'), fromSeat(0, '中列', 2, '妹'));
st = await state();
chk('兄弟児などを運転席へ移そうとしても入らない', st.cars[0].driver === '祖父 太郎' && st.cars[0].seats[3] === '妹', JSON.stringify(st.cars[0]));

// 8) 運転手を選ぶ画面: 配置待ちの監督・コーチを選ぶ／いまの運転手は配置待ちへ
await page.tap(S(1, 'driver'));
await page.waitForSelector('#driver-edit-modal .driver-candidate', { timeout: 5000 });
const cands = await page.evaluate(() => [...document.querySelectorAll('#driver-edit-modal .driver-candidate')].map(i => i.textContent));
chk('運転手を選ぶ画面: 選手はいない・直接入力の人もいる・どこにいるかが出る', !cands.some(t => /一年 太郎|二年 次郎/.test(t)) && cands.some(t => /祖父 太郎.*別の車を運転中/.test(t)) && cands.some(t => /二年 父.*座席に配置済み/.test(t)) && cands.some(t => /鈴木 コーチ/.test(t)), JSON.stringify(cands));
await page.locator('#driver-edit-modal .driver-candidate', { hasText: '鈴木 コーチ' }).tap();
await page.waitForTimeout(300);
st = await state();
chk('監督・コーチを運転手に選べる（元の運転手は配置待ちへ・車の名前も替わる）', st.cars[1].driver === '鈴木 コーチ' && st.cars[1].title === '鈴木' && st.dock.includes('一年 母'), JSON.stringify({ c: st.cars[1], dock: st.dock }));
// 座席にいる人を選ぶと、その席から外れて運転席へ（同じ人が2か所に出ない）
await page.tap(S(1, 'driver'));
await page.waitForSelector('#driver-edit-modal .driver-candidate', { timeout: 5000 });
await page.locator('#driver-edit-modal .driver-candidate', { hasText: '二年 父' }).tap();
await page.waitForTimeout(300);
st = await state();
const twice = st.cars.flatMap(c => [c.driver, ...c.seats]).filter(n => n === '二年 父').length;
chk('座席にいる人を運転手に選ぶと、元の席から外れる（2か所に出ない）', st.cars[1].driver === '二年 父' && twice === 1 && st.dock.includes('鈴木 コーチ'), JSON.stringify(st.cars));
// 運転席を空ける
await page.tap(S(0, 'driver'));
await page.waitForSelector('#driver-edit-modal .driver-clear-btn', { timeout: 5000 });
await page.tap('#driver-edit-modal .driver-clear-btn');
await page.waitForTimeout(300);
st = await state();
chk('「運転席を空ける」で運転手を配置待ちへ', st.cars[0].driver === '' && st.cars[0].title === '運転手未定' && st.dock.includes('祖父 太郎'), JSON.stringify({ c: st.cars[0], dock: st.dock }));
await page.screenshot({ path: 'dr-empty.png' });

// 9) スマホのタッチ: 配置待ちの役員を空いた運転席へドラッグ
const client = await ctx.newCDPSession(page);
const centerOf = sel => page.evaluate(s => { const el = typeof s === 'string' ? document.querySelector(s) : null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
async function swipe(a, b) {
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y }] });
  for (let i = 1; i <= 14; i++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * i / 14, y: a.y + (b.y - a.y) * i / 14 }] });
    await page.waitForTimeout(16);
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(500);
}
// 役員はメンバー帯にいない（子供なし・参加登録なし）ので、運転手を選ぶ画面から
await page.tap(S(0, 'driver'));
await page.waitForSelector('#driver-edit-modal .driver-candidate', { timeout: 5000 });
await page.locator('#driver-edit-modal .driver-candidate', { hasText: '役員 花子' }).tap();
await page.waitForTimeout(300);
st = await state();
chk('役員も運転手にできる', st.cars[0].driver === '役員 花子' && st.cars[0].title === '役員', JSON.stringify(st.cars[0]));
// タッチで運転手（役員）を同じ車の空いた助手席へ
const a1 = await centerOf(S(0, 'driver'));
const b1 = await centerOf(S(0, '助手席', 0));
await swipe(a1, b1);
st = await state();
chk('スマホ: 運転手を指でドラッグして助手席へ移せる（車は運転手未定に）', st.cars[0].driver === '' && st.cars[0].seats[0] === '役員 花子', JSON.stringify(st.cars[0]));
// タッチで配置待ちの人を運転席へ（祖父 太郎）
const memberSel = '#members-container .member-item[data-name="祖父 太郎"]';
// 2つ目の要素を画面に入れるとスクロールして1つ目の位置がずれるので、両方が画面に入る高さにしてから測る
await page.setViewportSize({ width: 390, height: 1800 });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
const rectOf = sel => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, vis: r.top >= 0 && r.bottom <= innerHeight }; }, sel);
const a2 = await rectOf(memberSel);
const b2 = await rectOf(S(0, 'driver'));
if (!a2.vis || !b2.vis) console.log('画面外', JSON.stringify({ a2, b2 }));
await swipe(a2, b2);
await page.setViewportSize({ width: 390, height: 900 });
st = await state();
chk('スマホ: 配置待ちの人を指でドラッグして運転席へ置ける（車の名前も替わる）', st.cars[0].driver === '祖父 太郎' && st.cars[0].title === '祖父 太郎', JSON.stringify(st.cars[0]));

// 10) 再読み込みしても同じ
d = await saved();
await open();
const st2 = await state();
chk('再読み込みしても運転手・車の名前・座席・配置待ちがそのまま', JSON.stringify(st2.cars) === JSON.stringify(st.cars.map(c => c)) && JSON.stringify(st2.dock.slice().sort()) === JSON.stringify(st.dock.slice().sort()), JSON.stringify({ before: st.cars, after: st2.cars, d1: st.dock, d2: st2.dock }));
const owners = d.carRegistrations.map(c => (c.owner || c.parent) + '>' + c.parent);
chk('保存: どちらの車も持ち主と運転手が分かれて残る', JSON.stringify(owners) === JSON.stringify(['一年 母>祖父 太郎', '祖父 太郎>二年 父']), JSON.stringify(owners));
const bar = await page.evaluate(() => (document.getElementById('assignment-stats-bar-nav') || document.getElementById('assignment-stats-bar-fs')).textContent.replace(/\s+/g, ''));
// 参加者: 監督2（帯同指導者未定）・選手2・母（持ち主・配置待ち）・役員（座席）・祖父/二年父は運転中
chk('参加人数に、運転席から外れた持ち主・座席の役員も入る（運転中の人は除く）', /参加人数6\//.test(bar), bar);

// 11) キャンバスモードのタップ（人を選んでから運転席をタップ）
await page.evaluate(() => {
  const A = FCOjima.Carpool.Assignment;
  A.openCanvasMode();
});
await page.waitForTimeout(400);
await page.evaluate(() => {
  const A = FCOjima.Carpool.Assignment;
  const el = document.querySelector('#members-container .member-item[data-name="一年 母"]');
  A.toggleCanvasSelect('一年 母', el);
  document.querySelector('.car-layout[data-car-index="1"] .seat.driver-seat').click();
});
await page.waitForTimeout(300);
st = await state();
chk('キャンバスモード: 人を選んで運転席をタップすると運転手になる（元の運転手は配置待ちへ）', st.cars[1].driver === '一年 母' && st.dock.includes('二年 父'), JSON.stringify({ c: st.cars[1], dock: st.dock }));
await page.evaluate(() => {
  const A = FCOjima.Carpool.Assignment;
  const el = document.querySelector('#members-container .member-item[data-name="二年 次郎"]');
  A.toggleCanvasSelect('二年 次郎', el);
  document.querySelector('.car-layout[data-car-index="1"] .seat.driver-seat').click();
});
await page.waitForTimeout(300);
st = await state();
chk('キャンバスモード: 選手を選んで運転席をタップしても入らない', st.cars[1].driver === '一年 母' && st.dock.includes('二年 次郎'), JSON.stringify(st.cars[1]));
await page.evaluate(() => FCOjima.Carpool.Assignment.closeCanvasMode());
await page.evaluate(() => FCOjima.Carpool.whenSaved());

// 12) 共有の文・概要
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
await drop('#members-container', fromDriver(0, '祖父 太郎'));
await page.evaluate(() => { window.__clip = ''; FCOjima.Utils.copyToClipboard = t => { window.__clip = t; return true; }; FCOjima.Carpool.Assignment.shareAssignments(); });
const clip = await page.evaluate(() => window.__clip);
chk('共有の文で運転手が決まっていない車は「運転手未定の車」', /■ 運転手未定の車/.test(clip) && /■ 一年 母の車/.test(clip), clip.slice(0, 200));
await page.evaluate(() => FCOjima.Carpool.whenSaved());
await page.goto(BASE + '/carpool/index.html?event=' + EV);
await page.waitForFunction(() => document.querySelector('#status-summary .ov-grid'), null, { timeout: 25000 });
await page.waitForTimeout(400);
const card = await page.evaluate(() => [...document.querySelectorAll('#status-summary .ov-card')].map(c => c.textContent.replace(/\s+/g, '')).find(t => /割り当て/.test(t)));
// 座る人: 選手2（出欠参加）＋運転していない運転手だった人（祖父 太郎・二年 父・鈴木 コーチ・役員 花子）。母は運転中
chk('概要の「割り当て」にも、運転席から外れた持ち主・運転手だった人が入る', /\/6人/.test(card || ''), card);

// 13) 車提供: 車の名前（運転する人＋持ち主）・選手や兄弟児は運転者にできない
await page.goto(BASE + '/carpool/cars.html?event=' + EV);
await page.waitForFunction(() => FCOjima.Carpool._base && document.querySelector('.car-card-list'), null, { timeout: 25000 });
await page.waitForTimeout(400);
const names = await page.evaluate(() => [...document.querySelectorAll('.car-card-name')].map(e => e.textContent));
chk('車提供の一覧: 運転手未定の車・ほかの人が運転する車は持ち主も出る', names[0] === '運転手未定（一年 母さんの車）' || names[0] === '運転手未定（一年 母さんの車）', JSON.stringify(names));
chk('車提供の一覧: ほかの人が運転する車は運転する人と持ち主', /^一年 母（祖父 太郎さんの車）$/.test(names[1]) || names[1] === '一年 母（祖父 太郎さんの車）', JSON.stringify(names));
const toastList = [];
for (const nm of ['一年 太郎', '妹']) {
  await page.fill('#parentName', nm);
  await page.evaluate(() => FCOjima.Carpool.CarProvision.registerCar());
  await page.waitForTimeout(200);
  toastList.push(await page.evaluate(() => [...document.querySelectorAll('.toast-notification')].map(t => t.textContent).pop() || ''));
}
d = await saved();
const toasts = toastList.join(' / ');
chk('車提供で選手・兄弟児を運転者にして登録できない', d.carRegistrations.length === 2 && /選手なので運転者にできません/.test(toasts) && /兄弟児なので運転者にできません/.test(toasts), toasts);

const bad = errs.filter(e => !ignorable(e));
chk('ページエラーなし', bad.length === 0, JSON.stringify(bad.slice(0, 3)));
await ctx.close();
await closeBrowser();
process.exit(summary() ? 1 : 0);
