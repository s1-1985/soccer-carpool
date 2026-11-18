// 週末の段取り（js/hub/weekend.js）: 予定をまとめて追加（先週と同じ）→ LINE で知らせる文 → 出欠の集計と声かけ →
// 必要な人数に足りない予定 → 車の提供をまだ答えていない保護者 → 配車表へ。参加予定へのリンク（?tab=my-events）
import { put, list, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors } from './lib.mjs';
import fs from 'fs';
await wipe();
const SHOT = process.env.SHOTS || '';
const jstNow = new Date(Date.now() + 9 * 3600e3);
const iso = d => d.toISOString().slice(0, 10);
// 段取りの週（火曜から7日）と、その週の土曜・日曜
const tue = new Date(jstNow); tue.setUTCDate(tue.getUTCDate() - ((tue.getUTCDay() + 5) % 7));
const plus = n => { const d = new Date(tue); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const FROM = plus(0), SAT = plus(4), SUN = plus(5), LAST_SAT = plus(-3);
for (const [id, name, grade] of [['p31', '小川 悠真', '3'], ['p32', '加藤 樹', '3'], ['p33', '木村 大和', '3'], ['p61', '渡良瀬 翔', '6'], ['p62', '新井 翼', '6']]) await put(`${T}/members/${id}`, { name, role: 'player', grade });
await put(`${T}/members/f31`, { name: '小川 恵', role: 'mother', childrenIds: ['p31'] });
await put(`${T}/members/f32`, { name: '加藤 健一', role: 'father', childrenIds: ['p32'] });
await put(`${T}/members/f61`, { name: '渡良瀬 父', role: 'father', childrenIds: ['p61'] });
const E3 = '1900000990003', E6 = '1900000990006', EL = '1900000990001';
await put(`${T}/events/${E3}`, { title: '岩松', date: SUN, type: 'game', target: ['3'], venue: '岩松', departureTime: '07:30', minPlayers: 4 });
await put(`${T}/events/${E6}`, { title: 'スポアカ', date: SUN, type: 'game', target: ['6'], venue: '渡良瀬', departureTime: '07:00' });
await put(`${T}/events/${EL}`, { title: '先週の練習試合', date: LAST_SAT, type: 'game', target: ['3'], venue: '笠懸', startTime: '09:00', minPlayers: 8 });
await put(`${T}/eventData/${E3}`, { attendance: [{ name: '小川 悠真', status: 'present' }, { name: '加藤 樹', status: 'present' }, { name: '木村 大和', status: 'absent' }],
  carRegistrations: [{ parent: '小川 恵', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 0, extraPassengers: [] }] });
await put(`${T}/eventData/${E6}`, { attendance: [{ name: '渡良瀬 翔', status: 'present' }] });
await makeUser('kantoku@example.com', '佐藤 監督', 'coach');
await makeUser('officer@example.com', '役員 一郎', 'officer');
await makeUser('ogawa@example.com', '小川 恵', 'parent', { childrenIds: ['p31'] });

async function openHub(email, name, url = '/hub/index.html') {
  const ctx = await context({ email, name });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  page.on('dialog', d => d.accept());
  await page.goto(BASE + url);
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(900);
  return { ctx, page, errs };
}

// ---------- 監督: 段取りの画面 ----------
{
  const { ctx, page, errs } = await openHub('kantoku@example.com', '佐藤 監督');
  await page.evaluate(() => document.querySelector('.tablinks[onclick*="admin"]').click());
  const tile = await page.evaluate(() => { const b = document.getElementById('btn-weekend'); return !!b && b.offsetParent !== null; });
  chk('監督の管理タブに「週末の段取り」がある', tile);
  await page.click('#btn-weekend');
  await page.waitForSelector('#weekend-modal .wk-step', { timeout: 10000 });
  await page.waitForTimeout(500);
  const v = await page.evaluate(() => {
    const steps = [...document.querySelectorAll('#weekend-modal .wk-step h3')].map(h => h.textContent);
    return { steps, range: document.querySelector('.wk-range').textContent, text: document.querySelector('#weekend-modal .wk-body').textContent };
  });
  chk('段取りは 予定を出す → 出欠 → 参加の調整 → 車 → 配車表 の5つ', v.steps.length === 5 && /予定を出す/.test(v.steps[0]) && /出欠/.test(v.steps[1]) && /参加を調整/.test(v.steps[2]) && /車を集める/.test(v.steps[3]) && /配車表/.test(v.steps[4]), JSON.stringify(v.steps));
  chk('出欠: 未回答の子の名前が出る（スポアカの新井 翼）', /未回答: 新井 翼/.test(v.text), v.text.slice(0, 300));
  chk('参加の調整: 必要な人数に足りない予定を知らせる（岩松 参加2 / 必要4）', /参加 2 \/ 必要 4/.test(v.text) && /2人足りません/.test(v.text));
  chk('車: 車の提供をまだ答えていない保護者（加藤 健一・渡良瀬 父）が出る。答えた小川 恵は出ない', /加藤 健一/.test(v.text) && /渡良瀬 父/.test(v.text) && !/まだ答えていない保護者: [^\n]*小川 恵/.test(v.text));
  chk('配車表: 割り当ての画面へのリンク', await page.evaluate((id) => !!document.querySelector('#weekend-modal a.wk-link[href="../carpool/assignments.html?event=' + id + '"]'), E3));
  // LINE の文
  await page.click('.wk-share[data-kind="plan"]');
  const plan = await page.evaluate(() => document.querySelector('.wk-share-text').value);
  chk('「LINEで知らせる」: 予定の一覧と、参加予定で答えるリンク（?tab=my-events）', /岩松/.test(plan) && /スポアカ/.test(plan) && /07:30出発/.test(plan) && /参加予定/.test(plan) && /\/hub\/index\.html\?tab=my-events/.test(plan), plan);
  await page.click('.wk-share[data-kind="remind"]');
  const remind = await page.evaluate(() => document.querySelector('.wk-share-text').value);
  chk('「未回答の人に声をかける」: 未回答の子だけ', /新井 翼/.test(remind) && !/小川 悠真/.test(remind), remind);
  await page.click('.wk-share[data-kind="car"]');
  const car = await page.evaluate(() => document.querySelector('.wk-share-text').value);
  chk('「車の提供を頼む」: 答えていない保護者と予定', /加藤 健一/.test(car) && /渡良瀬 父/.test(car) && !/小川 恵/.test(car), car);
  if (SHOT) await page.screenshot({ path: SHOT + '/weekend.png', fullPage: true });
  // 参加者を入れ替える（参加の変更の画面が開く）
  await page.click(`.wk-move[data-event="${E3}"]`);
  await page.waitForTimeout(800);
  chk('「参加者を入れる・入れ替える」で参加の変更の画面が開く', await page.evaluate(() => { const m = document.getElementById('player-move-modal') || document.querySelector('.pm-list'); return !!m && (m.offsetParent !== null || getComputedStyle(m.closest('.modal') || m).display !== 'none'); }));
  await page.evaluate(() => document.querySelectorAll('.modal').forEach(m => { if (m.id !== 'weekend-modal') m.style.display = 'none'; }));

  // まとめて追加（先週と同じ）
  await page.click('.wk-bulk');
  await page.waitForSelector('.wk-brow');
  await page.click('.wk-copy');
  await page.waitForTimeout(300);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.wk-brow')].map(r => ({ d: r.querySelector('.b-date').value, t: r.querySelector('.b-title').value, g: [...r.querySelectorAll('.b-grades input:checked')].map(c => c.value), min: r.querySelector('.b-min').value })));
  chk('「先週と同じ」で先週の予定が7日ずらして写る（学年・必要な人数も）', rows.length === 1 && rows[0].t === '先週の練習試合' && rows[0].d === SAT && rows[0].g.join() === '3' && rows[0].min === '8', JSON.stringify(rows));
  await page.click('.wk-addrow');
  const last = page.locator('.wk-brow').last();
  await last.locator('.b-date').selectOption(SUN);
  await last.locator('.b-title').fill('前橋コーエイ');
  await last.locator('.b-grades input[value="6"]').check();
  await last.locator('.b-venue').fill('前橋');
  await last.locator('.b-dep').fill('06:30');
  if (SHOT) await page.screenshot({ path: SHOT + '/weekend-bulk.png', fullPage: true });
  await page.click('.wk-save');
  await page.waitForSelector('#weekend-modal .wk-step', { timeout: 10000 });
  await page.waitForTimeout(2000);
  const evs = await list(`${T}/events`);
  const c1 = evs.find(e => e.title === '先週の練習試合' && e.date === SAT);
  const c2 = evs.find(e => e.title === '前橋コーエイ');
  chk('「この内容で予定を作る」で予定ができる（日付・学年・会場・出発・必要な人数）', c1 && c1.minPlayers === 8 && JSON.stringify(c1.target) === '["3"]' && c2 && c2.date === SUN && c2.venue === '前橋' && c2.departureTime === '06:30' && JSON.stringify(c2.target) === '["6"]', JSON.stringify({ c1, c2 }));
  chk('作った予定が段取りの一覧に出る', await page.evaluate(() => /前橋コーエイ/.test(document.querySelector('.wk-evs').textContent)));
  chk('段取りの画面でページエラーなし', errs.filter(e => !/favicon|manifest|net::ERR|404/.test(e)).length === 0, errs.join(' | ').slice(0, 200));
  await ctx.close();
}

// ---------- 役員も開ける・保護者には出ない ----------
{
  const { ctx, page } = await openHub('officer@example.com', '役員 一郎');
  await page.evaluate(() => document.querySelector('.tablinks[onclick*="admin"]').click());
  chk('役員も「週末の段取り」を開ける（集計・車・配車表の担当）', await page.evaluate(() => { const b = document.getElementById('btn-weekend'); return !!b && b.offsetParent !== null && FCOjima.Hub.Weekend.canOpen(); }));
  await ctx.close();
}
{
  const { ctx, page } = await openHub('ogawa@example.com', '小川 恵', '/hub/index.html?tab=my-events');
  await page.waitForTimeout(1200);
  const v = await page.evaluate(() => ({ tab: document.getElementById('my-events').style.display !== 'none', can: FCOjima.Hub.Weekend.canOpen() }));
  chk('LINE のリンク（?tab=my-events）から開くと参加予定のタブが開く', v.tab, JSON.stringify(v));
  chk('保護者は週末の段取りを開けない', !v.can);
  await ctx.close();
}
// 必要な人数は予定の編集でも決められる
{
  const { ctx, page } = await openHub('kantoku@example.com', '佐藤 監督');
  await page.evaluate((id) => FCOjima.Hub.Calendar.editEvent(id), E6);
  await page.waitForTimeout(500);
  await page.fill('#event-min-players', '7');
  await page.evaluate(() => FCOjima.Hub.Calendar.saveEvent());
  await page.waitForTimeout(1500);
  const e6 = (await list(`${T}/events`)).find(e => e.id === E6);
  chk('予定の編集で「必要な人数」を保存できる', e6 && e6.minPlayers === 7, JSON.stringify(e6 && e6.minPlayers));
  await ctx.close();
}
await closeBrowser();
process.exitCode = summary() ? 1 : 0;
