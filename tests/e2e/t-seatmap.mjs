// 車提供の座席の図: 兄弟児などメンバー外の人の席をその場で決める → 座席割り当てではその席（選手は置けない・ほかの車へ移せない）
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors } from './lib.mjs';
await wipe();
const EV = '1900000070001';
await put(`${T}/members/p1`, { name: '一年 太郎', role: 'player', grade: '1' });
await put(`${T}/members/p2`, { name: '一年 花子', role: 'player', grade: '1' });
await put(`${T}/members/p3`, { name: '一年 次郎', role: 'player', grade: '1' });
await put(`${T}/members/p4`, { name: '一年 三郎', role: 'player', grade: '1' });
await put(`${T}/members/f1`, { name: '曽根 靖弘', role: 'father', abbr: '曽根', childrenIds: ['p1'], siblings: [{ name: '彩加', note: '3歳' }, { name: '大地', note: '' }] });
await put(`${T}/members/m2`, { name: '別家 母', role: 'mother', childrenIds: ['p2'], siblings: [{ name: '別家の妹', note: '' }] });
await put(`${T}/events/${EV}`, { title: '練習試合', date: '2026-11-28', type: 'game', target: ['1'] });
await put(`${T}/eventData/${EV}`, { attendance: ['一年 太郎', '一年 花子', '一年 次郎', '一年 三郎'].map(n => ({ name: n, status: 'present', notes: '' })) });
await makeUser('seat@example.com', '曽根 靖弘', 'admin');

const mob = { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const ctx = await context({ email: 'seat@example.com', name: '曽根 靖弘', device: mob });
const page = await ctx.newPage();
const errs = watchErrors(page);
page.on('dialog', d => d.accept());
await page.goto(BASE + '/carpool/cars.html?event=' + EV);
await page.waitForFunction(() => document.querySelector('#cp-car .cp-seat') && FCOjima.Carpool._base, null, { timeout: 25000 });
await page.waitForTimeout(400);
const seatsOf = () => page.evaluate(() => [...document.querySelectorAll('#cp-car .cp-seat')].map(b => (b.dataset.seatType || 'driver') + (b.dataset.seatIndex || '') + ':' + b.querySelector('.cp-seat-name').textContent));
const s0 = await seatsOf();
chk('最初は助手席1・中列3・後列0（従来の既定）で、車の図に運転席と席が並ぶ', JSON.stringify(s0) === JSON.stringify(['助手席0:空き', 'driver:運転者', '中列0:空き', '中列1:空き', '中列2:空き']), JSON.stringify(s0));
await page.fill('#parentName', '曽根 靖弘');
await page.waitForTimeout(200);
const drv = await page.evaluate(() => document.querySelector('.cp-seat-driver .cp-seat-name').textContent);
chk('運転席に運転者（略称）が出る', drv === '曽根', drv);
// 後列を2席に
await page.tap('.cp-stepper[data-key="backSeat"] .cp-step-plus');
await page.tap('.cp-stepper[data-key="backSeat"] .cp-step-plus');
const sum1 = await page.evaluate(() => document.getElementById('cp-seat-summary').textContent.replace(/\s+/g, ''));
chk('−／＋で席の数を変えられ、乗車可能な席の数が出る', /乗車可能6席/.test(sum1), sum1);
// 兄弟児にチェック → 空いている席（後列1）
await page.locator('#sibling-options label', { hasText: '彩加' }).locator('input').check();
const s1 = await seatsOf();
const tag1 = await page.evaluate(() => (document.querySelector('#sibling-options .cp-sib-seat') || {}).textContent);
chk('兄弟児にチェックすると空いている席（後列→中列→助手席の順）に乗り、一覧に席が出る', s1.includes('後列0:彩加') && tag1 === '後列1', JSON.stringify({ s1, tag1 }));
const sum2 = await page.evaluate(() => document.getElementById('cp-seat-summary').textContent.replace(/\s+/g, ''));
chk('兄弟児を乗せると、乗車可能な席は座席数から兄弟児の人数を引いた数になる', /座席6−兄弟児など1＝乗車可能5席/.test(sum2), sum2);
// 席をタップして兄弟児を助手席へ移す
await page.tap('.cp-seat[data-seat-type="助手席"][data-seat-index="0"]');
await page.waitForSelector('#cp-seat-modal .cp-sib-choice', { timeout: 5000 });
const choices = await page.evaluate(() => [...document.querySelectorAll('#cp-seat-modal .cp-sib-choice')].map(b => b.textContent));
chk('席をタップすると家庭の兄弟児を選べる（乗っている子は「〇〇から移す」）', choices.length === 2 && /彩加.*後列1から移す/.test(choices[0]) && /大地.*乗せる/.test(choices[1]), JSON.stringify(choices));
await page.locator('#cp-seat-modal .cp-sib-choice', { hasText: '彩加' }).tap();
await page.waitForTimeout(200);
const s2 = await seatsOf();
chk('選んだ席に移る（元の席は空く）', s2.includes('助手席0:彩加') && s2.includes('後列0:空き'), JSON.stringify(s2));
// ほかの人を名前で乗せる
await page.tap('.cp-seat[data-seat-type="中列"][data-seat-index="2"]');
await page.fill('#cp-seat-other-name', '友だちのA君');
await page.tap('#cp-seat-other-add');
await page.waitForTimeout(200);
const s3 = await seatsOf();
const lab3 = await page.evaluate(() => document.querySelector('.cp-seat[data-seat-type="中列"][data-seat-index="2"] .cp-seat-label').textContent);
chk('兄弟児以外の人も名前で乗せられる（「同乗者」）', s3.includes('中列2:友だちのA君') && lab3 === '同乗者', JSON.stringify(s3));
// 中列を1席に減らす → 中列3の人は空いている席へ
await page.tap('.cp-stepper[data-key="middleSeat"] .cp-step-minus');
await page.tap('.cp-stepper[data-key="middleSeat"] .cp-step-minus');
await page.waitForTimeout(200);
const s4 = await seatsOf();
chk('席を減らすと、なくなった席の人は空いている席に移る', s4.includes('後列0:友だちのA君') && !s4.some(x => x.startsWith('中列1') || x.startsWith('中列2')), JSON.stringify(s4));
// 席を空ける
await page.tap('.cp-seat[data-seat-type="後列"][data-seat-index="0"]');
await page.tap('#cp-seat-clear');
await page.waitForTimeout(200);
const s5 = await seatsOf();
chk('「この席を空ける」で選手が乗れる席に戻る', s5.includes('後列0:空き') && !s5.some(x => /友だち/.test(x)), JSON.stringify(s5));
// 別の家庭の運転者にすると前の家庭の兄弟児は降りる（名前で乗せた人は残る）
await page.tap('.cp-seat[data-seat-type="後列"][data-seat-index="1"]');
await page.fill('#cp-seat-other-name', '親戚の子');
await page.press('#cp-seat-other-name', 'Enter');
await page.fill('#parentName', '別家 母');
await page.waitForTimeout(300);
const s6 = await seatsOf();
chk('別の家庭の運転者にすると前の家庭の兄弟児は席から降りる（名前で乗せた人は残る）', !s6.some(x => /彩加/.test(x)) && s6.includes('後列1:親戚の子'), JSON.stringify(s6));
await page.fill('#parentName', '曽根 靖弘');
await page.waitForTimeout(200);
await page.locator('#sibling-options label', { hasText: '彩加' }).locator('input').check();
// 登録
await page.screenshot({ path: 'seat-form.png', fullPage: false });
await page.tap('#register-car');
await page.evaluate(() => FCOjima.Carpool.whenSaved());
let d = await get(`${T}/eventData/${EV}`);
const car = (d.carRegistrations || []).find(c => c.parent === '曽根 靖弘');
chk('登録すると席の数と、兄弟児などの席が保存される', car && car.frontSeat === 1 && car.middleSeat === 1 && car.backSeat === 2 &&
  JSON.stringify(car.extraPassengers) === JSON.stringify([{ name: '親戚の子', seatType: '後列', seatIndex: 1 }, { name: '彩加', seatType: '後列', seatIndex: 0 }]), JSON.stringify(car));
const card = await page.evaluate(() => [...document.querySelectorAll('.car-card')].map(c => c.textContent).join('|'));
chk('登録済みの車に兄弟児などの席が出る', /彩加（後列1）/.test(card) && /親戚の子（後列2）/.test(card), card.slice(0, 160));
chk('登録済みの車の席数は、座席数から兄弟児などの人数を引いた「乗車可能」になる（4席−2人＝2席）', /後列 2 − 兄弟児など 2 ＝ 乗車可能 2 席/.test(card), card.slice(0, 120));
const stats = await page.evaluate(() => document.getElementById('car-stats').textContent.replace(/\s+/g, ''));
chk('車両の集計も乗車可能な席の数（兄弟児などを除く）', /乗車可能2席\/必要4席/.test(stats) && /兄弟児など2人/.test(stats), stats);
const s7 = await seatsOf();
chk('登録後は座席の図が既定に戻る', JSON.stringify(s7) === JSON.stringify(['助手席0:空き', 'driver:運転者', '中列0:空き', '中列1:空き', '中列2:空き']), JSON.stringify(s7));
const ov = await page.evaluate(() => { const vw = document.documentElement.clientWidth; return [...document.querySelectorAll('.car-form *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > vw + .5; }).length; });
chk('360px で車提供のフォームがはみ出さない', ov === 0, String(ov));

// 2台目（兄弟児なし）
await put(`${T}/eventData/${EV}`, Object.assign({}, d, { carRegistrations: (d.carRegistrations || []).concat([{ parent: '別家 母', canDrive: 'both', frontSeat: 1, middleSeat: 2, backSeat: 0, notes: '', extraPassengers: [] }]) }));

// 配車の概要: 乗車可能な席（曽根 4−2 ＋ 別家 3 ＝ 5）
await page.goto(BASE + '/carpool/index.html?event=' + EV);
await page.waitForFunction(() => document.querySelector('#status-summary .ov-grid'), null, { timeout: 25000 });
const ovText = await page.evaluate(() => document.getElementById('status-summary').textContent.replace(/\s+/g, ''));
chk('配車の概要の席数も兄弟児などを除いた乗車可能な席', /乗車可能5席/.test(ovText), ovText.slice(0, 120));

// 座席割り当て
await page.goto(BASE + '/carpool/assignments.html?event=' + EV);
await page.waitForFunction(() => document.querySelectorAll('.car-layout').length === 2, null, { timeout: 25000 });
await page.waitForTimeout(800);
const seat = (ci, t, i) => `.car-layout[data-car-index="${ci}"] .seat[data-seat-type="${t}"][data-seat-index="${i}"]`;
const bar = await page.evaluate(() => (document.getElementById('assignment-stats-bar-nav') || document.getElementById('assignment-stats-bar-fs')).textContent.replace(/\s+/g, ''));
chk('割り当ての座席数も兄弟児などを除いた乗車可能な席（配置済にも兄弟児などは数えない）', /参加人数4\/座席数5/.test(bar) && /配置済0/.test(bar) && /空席5/.test(bar), bar);
const occ = await page.evaluate(([a, b]) => [document.querySelector(a).dataset.person, document.querySelector(b).dataset.person], [seat(0, '後列', 0), seat(0, '後列', 1)]);
chk('座席割り当てでは、車提供で決めた席に兄弟児などが座る', occ[0] === '彩加' && occ[1] === '親戚の子', JSON.stringify(occ));
// 選手を兄弟児の席に置こうとしても置けない（ドラッグ＆ドロップ）
const dropRes = await page.evaluate((sel) => {
  const s = document.querySelector(sel);
  const dt = new DataTransfer();
  dt.setData('text/plain', '一年 太郎');
  dt.setData('application/json', JSON.stringify({ type: 'member', name: '一年 太郎' }));
  s.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  return { person: s.dataset.person, toast: (document.querySelector('.toast-notification:last-child') || {}).textContent || '' };
}, seat(0, '後列', 0));
chk('選手を兄弟児の席に入れようとしても入らず、案内が出る', dropRes.person === '彩加' && /兄弟児など/.test(dropRes.toast), JSON.stringify(dropRes));
// 空いている席には入る
const dropOk = await page.evaluate((sel) => {
  const s = document.querySelector(sel);
  const dt = new DataTransfer();
  dt.setData('text/plain', '一年 太郎');
  dt.setData('application/json', JSON.stringify({ type: 'member', name: '一年 太郎' }));
  s.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  return s.dataset.person;
}, seat(0, '中列', 0));
chk('空いている席には選手を入れられる', dropOk === '一年 太郎', dropOk);
// 兄弟児をほかの車へ移そうとしても移らない／同じ車の中なら入れ替えられる
const ex = await page.evaluate(([a, b, c]) => {
  FCOjima.Carpool.Assignment.handleSeatExchange('0', '後列', '0', '1', '中列', '0');
  const cross = [document.querySelector(a).dataset.person || '', document.querySelector(b).dataset.person || ''];
  FCOjima.Carpool.Assignment.handleSeatExchange('0', '後列', '0', '0', '中列', '0');
  const same = [document.querySelector(a).dataset.person || '', document.querySelector(c).dataset.person || ''];
  return { cross, same };
}, [seat(0, '後列', 0), seat(1, '中列', 0), seat(0, '中列', 0)]);
chk('兄弟児などはほかの車へは移せない', ex.cross[0] === '彩加' && ex.cross[1] === '', JSON.stringify(ex.cross));
chk('同じ車の中なら兄弟児と選手の席を入れ替えられる', ex.same[0] === '一年 太郎' && ex.same[1] === '彩加', JSON.stringify(ex.same));
// ランダム割り当てでも決めた席に座る
await page.evaluate(() => FCOjima.Carpool.Assignment.generateRandomAssignments());
await page.waitForTimeout(800);
await page.evaluate(() => FCOjima.Carpool.whenSaved());
d = await get(`${T}/eventData/${EV}`);
const a0 = (d.assignments || []).find(a => a.driver === '曽根 靖弘');
chk('ランダム割り当てでも兄弟児などは車提供で決めた席に座る', a0 && a0.seats['後列']['0'] === '彩加' && a0.seats['後列']['1'] === '親戚の子', JSON.stringify(a0 && a0.seats));
const placed = Object.values(a0.seats).flatMap(o => Object.values(o)).concat(Object.values(((d.assignments || []).find(a => a.driver === '別家 母') || { seats: {} }).seats).flatMap(o => Object.values(o)));
chk('ランダム割り当てで選手は全員どこかの席に入る', ['一年 太郎', '一年 花子', '一年 次郎', '一年 三郎'].every(n => placed.includes(n)), JSON.stringify(placed));
await page.screenshot({ path: 'seat-assign.png' });

const bad = errs.filter(e => !/favicon|ERR_|Failed to load resource|open-meteo|gsi|storage/i.test(e));
chk('ページエラーなし', bad.length === 0, JSON.stringify(bad.slice(0, 5)));
await closeBrowser();
process.exit(summary() ? 1 : 0);
