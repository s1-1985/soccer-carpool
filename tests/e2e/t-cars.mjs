// 車の絵（SVG）・出欠の編集（ほかの人のお子さんも）・参加予定での車の提供
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors } from './lib.mjs';
await wipe();
const jst = new Date(Date.now() + 9 * 3600e3);
const D1 = new Date(jst.getTime() + 86400e3 * 2).toISOString().slice(0, 10);
for (const [id, name, grade] of [['p31', '小川 悠真', '3'], ['p32', '加藤 樹', '3'], ['p41', '工藤 颯', '4']]) await put(`${T}/members/${id}`, { name, role: 'player', grade });
await put(`${T}/members/f31`, { name: '小川 恵', role: 'mother', childrenIds: ['p31'] });
await put(`${T}/members/f41`, { name: '工藤 さおり', role: 'mother', childrenIds: ['p41'] });
const E1 = '1900000900001';
await put(`${T}/events/${E1}`, { title: '笠懸カップ', date: D1, type: 'game', target: ['3', '4'], startTime: '09:00', venue: '笠懸球技場' });
await put(`${T}/eventData/${E1}`, {
  attendance: [{ name: '工藤 颯', status: 'present', notes: '' }, { name: '加藤 樹', status: 'absent', notes: '' }],
  carRegistrations: [{ parent: '工藤 さおり', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 3, notes: '', extraPassengers: [] }]
});
await makeUser('admin@example.com', '管理者', 'admin');
await makeUser('ogawa@example.com', '小川 恵', 'parent', { childrenIds: ['p31'] });
await makeUser('kudo@example.com', '工藤 さおり', 'parent', { childrenIds: ['p41'] });
const att = async (n) => ((await get(`${T}/eventData/${E1}`)).attendance || []).find(a => a.name === n);
const cars = async () => (await get(`${T}/eventData/${E1}`)).carRegistrations || [];

// ---------- 車の絵 ----------
{
  const ctx = await context({ email: 'admin@example.com', name: '管理者' });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  await page.goto(BASE + '/carpool/assignments.html?event=' + E1);
  await page.waitForSelector('.car-top-view .car-art', { timeout: 25000 });
  await page.waitForTimeout(800);
  const v = await page.evaluate(() => {
    const box = document.querySelector('.car-top-view'), svg = box.querySelector(':scope > .car-art');
    const r = { width: box.clientWidth, height: box.clientHeight }, s = svg.getBoundingClientRect();
    const seat = box.querySelector('.seat');
    const sr = seat.getBoundingClientRect();
    const top = document.elementFromPoint(sr.x + sr.width / 2, sr.y + sr.height / 2);
    return { has: box.classList.contains('has-car-art'), wDiff: Math.abs(s.width - r.width - 18), hDiff: Math.abs(s.height - r.height - 10), seatOnTop: !!(top && top.closest('.seat')), paths: svg.querySelectorAll('path,rect').length };
  });
  chk('座席割り当ての車にSVGの車の絵が敷かれ、箱の大きさに合っている', v.has && v.wDiff < 2 && v.hDiff < 2 && v.paths >= 10, JSON.stringify(v));
  chk('席は絵より手前にあり、タップできる', v.seatOnTop, JSON.stringify(v));
  await page.goto(BASE + '/carpool/cars.html?event=' + E1);
  await page.waitForSelector('.cp-car .car-art', { timeout: 25000 });
  const n0 = await page.evaluate(() => document.querySelectorAll('.cp-car > .car-art').length);
  const w0 = await page.evaluate(() => Number(document.querySelector('.cp-car > .car-art').dataset.w));
  await page.setViewportSize({ width: 300, height: 800 });
  await page.waitForTimeout(800);
  const w1 = await page.evaluate(() => Number(document.querySelector('.cp-car > .car-art').dataset.w));
  chk('画面の幅が変わると、絵も箱の大きさに合わせて描き直される', w1 < w0, w0 + ' → ' + w1);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(500);
  await page.click('.cp-stepper[data-key="backSeat"] .cp-step-plus');
  await page.waitForTimeout(600);
  const m = await page.evaluate(() => ({ n: document.querySelectorAll('.cp-car > .car-art').length, rows: document.querySelectorAll('.cp-car .cp-row').length }));
  chk('車提供の座席の図も同じ絵。席を足しても絵は1枚のまま・席をタップできる', n0 === 1 && m.n === 1, JSON.stringify({ n0, m }));
  await page.click('.cp-car button.cp-seat >> nth=0');
  await page.waitForSelector('#cp-seat-modal', { state: 'visible', timeout: 5000 });
  chk('絵の上の席をタップすると席の選択が開く', true);
  chk('車の画面でページエラーなし', errs.filter(e => !/favicon|manifest|net::ERR|404/.test(e)).length === 0, errs.join(' | ').slice(0, 200));
  await ctx.close();
}

// ---------- ほかの人のお子さんの出欠も、予定の詳細で直せる ----------
{
  const ctx = await context({ email: 'ogawa@example.com', name: '小川 恵' });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.evaluate((id) => FCOjima.Hub.Calendar.showEventDetails(id), E1);
  await page.waitForSelector('.ed-att-grid', { timeout: 10000 });
  await page.click('.ed-att[data-name="加藤 樹"]');
  chk('名前をタップすると、その子の出欠の編集が開く（ほかの人のお子さん）', await page.evaluate(() => { const e = document.getElementById('ed-att-edit'); return !e.hidden && /加藤 樹/.test(e.textContent) && e.querySelectorAll('button').length === 3; }));
  await page.click('#ed-att-edit .ed-att-edit-present');
  await page.waitForTimeout(1500);
  chk('「参加」にすると保存される（出欠表が更新）', (await att('加藤 樹')).status === 'present', JSON.stringify(await att('加藤 樹')));
  await page.waitForSelector('.ed-att[data-name="加藤 樹"]');
  chk('詳細が出し直され、一覧にも反映される', await page.evaluate(() => document.querySelector('.ed-att[data-name="加藤 樹"]').dataset.status === 'present'));
  await page.click('.ed-att[data-name="工藤 颯"]');
  await page.click('#ed-att-edit .ed-att-edit-unknown');
  await page.waitForTimeout(1500);
  chk('「未回答に戻す」で未回答に戻せる', (await att('工藤 颯')).status === 'unknown', JSON.stringify(await att('工藤 颯')));
  chk('出欠の編集でページエラーなし', errs.filter(e => !/favicon|manifest|net::ERR|404/.test(e)).length === 0, errs.join(' | ').slice(0, 200));
  await ctx.close();
}

// ---------- 参加予定で、親の車の提供を答える ----------
{
  const ctx = await context({ email: 'ogawa@example.com', name: '小川 恵' });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.getElementById('my-events-tab').click());
  await page.waitForSelector('.me-car-row', { timeout: 10000 });
  const t0 = await page.evaluate(() => ({ cls: document.querySelector('.me-car-row').className, text: document.querySelector('.me-car-state').textContent, on: document.querySelectorAll('.me-car-row .is-on').length }));
  chk('参加予定に「車の提供」が出る（最初は「まだ答えていません」）', /me-car-unknown/.test(t0.cls) && t0.text === 'まだ答えていません' && t0.on === 0, JSON.stringify(t0));
  await page.click('.me-car-row button[data-car="yes"]');
  await page.waitForFunction(() => /出せる（/.test(document.querySelector('.me-car-state').textContent), null, { timeout: 8000 });
  const r1 = (await cars()).find(c => c.parent === '小川 恵');
  chk('「出せる」で車提供が登録される（標準の席: 助手席1・中列3）', r1 && r1.canDrive === 'both' && r1.frontSeat === 1 && r1.middleSeat === 3 && (await cars()).length === 2, JSON.stringify(r1));
  chk('表示が「出せる（往復・空き4席）」になる', await page.evaluate(() => document.querySelector('.me-car-state').textContent === '出せる（往復・空き4席）'));
  await page.click('.me-car-row button[data-car="no"]');
  await page.waitForFunction(() => document.querySelector('.me-car-state').textContent === '出せない', null, { timeout: 8000 });
  const r2 = (await cars()).find(c => c.parent === '小川 恵');
  chk('「出せない」にすると canDrive が no になる（座席は残る）', r2 && r2.canDrive === 'no' && r2.middleSeat === 3 && (await cars()).length === 2, JSON.stringify(r2));
  await page.click('.me-car-row button[data-car="yes"]');
  await page.waitForFunction(() => /出せる（/.test(document.querySelector('.me-car-state').textContent), null, { timeout: 8000 });
  const r3 = (await cars()).filter(c => c.parent === '小川 恵');
  chk('もう一度「出せる」にしても、同じ車が2台にならない（往復に戻る）', r3.length === 1 && r3[0].canDrive === 'both', JSON.stringify(r3));
  chk('「くわしく設定」のリンクが車提供のページを指す', await page.evaluate((id) => document.querySelector('.me-car-link').getAttribute('href') === '../carpool/cars.html?event=' + id, E1));
  await ctx.close();
}
await closeBrowser();
process.exitCode = summary() ? 1 : 0;
