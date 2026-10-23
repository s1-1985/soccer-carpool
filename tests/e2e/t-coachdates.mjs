// 指導者に都合を聞く日: 祝日は自動・期間で追加・この日は聞かない・カレンダーの日付から聞く日にする
import fs from 'fs';
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors } from './lib.mjs';

// 祝日の計算はアプリと同じファイルを使う
globalThis.window = globalThis;
(0, eval)(fs.readFileSync(new URL('../../js/common/holidays.js', import.meta.url), 'utf8'));
const H = globalThis.FCOjima.Holidays;

await wipe();
const jst = new Date(Date.now() + 9 * 3600e3);
const iso = d => d.toISOString().slice(0, 10);
const plus = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const TODAY = iso(jst);
const isWeekday = d => d.getUTCDay() >= 1 && d.getUTCDay() <= 5;
const plain = d => isWeekday(d) && !H.nameOf(iso(d));
// 次の土日（今日が土日なら来週）
const sat = plus(jst, ((6 - jst.getUTCDay() + 7) % 7) || 7);
const sun = plus(sat, 1);
const SAT = iso(sat), SUN = iso(sun);
// 15日以上先の 水〜金（祝日なし）: お盆のような平日の連続
let r1 = plus(jst, 15);
while (!(r1.getUTCDay() === 3 && plain(r1) && plain(plus(r1, 1)) && plain(plus(r1, 2)))) r1 = plus(r1, 1);
const R1 = [iso(r1), iso(plus(r1, 1)), iso(plus(r1, 2))];
// 8週間より先の 水・木（祝日なし）
let far = plus(jst, 70);
while (!(far.getUTCDay() === 3 && plain(far) && plain(plus(far, 1)))) far = plus(far, 1);
const FAR = [iso(far), iso(plus(far, 1))];
// 8週間より先の平日（予定の追加フォームで「この日も都合を聞く」）
let late = plus(far, 7);
while (!plain(late)) late = plus(late, 1);
const LATE = iso(late);
console.log({ TODAY, SAT, SUN, R1, FAR, LATE });

await put(`${T}/members/c1`, { name: '佐藤 監督', role: 'coach', abbr: '佐藤' });
await put(`${T}/members/c2`, { name: '鈴木 コーチ', role: 'assist', abbr: '鈴木' });
await put(`${T}/members/c3`, { name: '田中 コーチ', role: 'assist', abbr: '田中' });
await put(`${T}/members/p1`, { name: '一年 太郎', role: 'player', grade: '1' });
await put(`${T}/members/f1`, { name: '一年 母', role: 'mother', childrenIds: ['p1'] });
const E1 = '1900000090001';
await put(`${T}/events/${E1}`, { title: '笠懸', date: SAT, type: 'game', target: ['1', '2'], startTime: '09:00' });
await makeUser('kantoku@example.com', '佐藤 監督', 'coach');
await makeUser('suzuki@example.com', '鈴木 コーチ', 'assist');
await makeUser('coachmom@example.com', '一年 母', 'parent', { childrenIds: ['p1'] });
const mob = (w) => ({ viewport: { width: w, height: w <= 320 ? 568 : 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const overflow = (s => {
  const vw = document.documentElement.clientWidth;
  return [...document.querySelectorAll(s + ' *')].filter(e => {
    const r = e.getBoundingClientRect();
    if (!(r.width > 0 && (r.right > vw + .5 || r.left < -.5))) return false;
    return true;
  }).map(e => e.className || e.tagName).slice(0, 5);
});
const ignorable = e => /favicon|ERR_|Failed to load resource|open-meteo|gsi|storage/i.test(e);
const open = async (page) => {
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(800);
};
const plan = () => get(`${T}/coachDates/plan`);

// 0) 祝日の計算（ブラウザ上）
{
  const ctx = await context({ email: 'kantoku@example.com', name: '佐藤 監督', device: mob(360) });
  const page = await ctx.newPage();
  await open(page);
  const h = await page.evaluate(() => ['2026-11-03', '2026-09-22', '2026-05-06', '2027-03-22', '2029-09-24', '2026-10-19', '2026-11-23'].map(d => d + ':' + FCOjima.Holidays.nameOf(d)));
  chk('祝日・国民の休日・振替休日を計算できる', JSON.stringify(h) === JSON.stringify(['2026-11-03:文化の日', '2026-09-22:国民の休日', '2026-05-06:振替休日', '2027-03-22:振替休日', '2029-09-24:振替休日', '2026-10-19:', '2026-11-23:勤労感謝の日']), JSON.stringify(h));
  // カレンダー: 表示中の月の祝日は赤（holiday）
  const cal = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('#calendar-grid .calendar-day')];
    return {
      want: cells.filter(c => FCOjima.Holidays.nameOf(c.dataset.date)).map(c => c.dataset.date),
      got: cells.filter(c => c.classList.contains('holiday')).map(c => c.dataset.date + ':' + c.title),
      color: (cells.find(c => c.classList.contains('holiday') && !c.classList.contains('other-month')) || {}).querySelector ? getComputedStyle(cells.find(c => c.classList.contains('holiday') && !c.classList.contains('other-month')).querySelector('.date')).color : 'none'
    };
  });
  chk('カレンダーの祝日のマスは赤字で、名前が付く', cal.want.length === cal.got.length && cal.got.every(x => /:.+/.test(x)) && (cal.color === 'none' || cal.color === 'rgb(220, 53, 69)'), JSON.stringify(cal));
  await ctx.close();
}

// 1) 監督: 指導者の予定・担当の画面
{
  const ctx = await context({ email: 'kantoku@example.com', name: '佐藤 監督', device: mob(360) });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  page.on('dialog', d => d.accept());
  await open(page);
  // 8週間のうちの平日の祝日は自動で聞く日
  const autoHol = await page.evaluate(() => FCOjima.Hub.Coaching.planDates().filter(d => { const w = new Date(d + 'T00:00:00').getDay(); return w >= 1 && w <= 5; }));
  const expectHol = [];
  // 8週間の終わりは週末の区切り（火曜）まで延ばす
  let endD = plus(jst, 56); endD = plus(endD, (2 - endD.getUTCDay() + 7) % 7);
  for (let d = new Date(jst); iso(d) < iso(endD); d = plus(d, 1)) if (isWeekday(d) && H.nameOf(iso(d))) expectHol.push(iso(d));
  const lastSun = await page.evaluate(() => { const p = FCOjima.Hub.Coaching.planDates(); return p.filter(d => new Date(d + 'T00:00:00').getDay() === 0).pop(); });
  chk('8週間の最後の週末が途中で切れない（土曜があれば日曜も入る）', lastSun === iso(plus(endD, -2)), lastSun + ' / ' + iso(plus(endD, -2)));
  chk('8週間のうちの平日の祝日は自動で聞く日になる（それ以外の平日は入らない）', JSON.stringify(autoHol) === JSON.stringify(expectHol), JSON.stringify({ autoHol, expectHol }));

  await page.evaluate(() => document.getElementById('admin-tab').click());
  await page.tap('#btn-coach-planner');
  await page.waitForSelector('#coach-planner-modal .co-cal-day', { timeout: 10000 });
  const cell = d => `#coach-planner-modal .co-cal-day[data-date="${d}"]`;
  const ymText = d => `${parseInt(d.slice(0, 4))}年${parseInt(d.slice(5, 7))}月`;
  const monthLabel = () => page.evaluate(() => document.querySelector('#coach-planner-modal .co-cal-ym').textContent);
  // その日の月を開いて（‹ › で）、日をタップ
  const goDay = async (d) => {
    for (let i = 0; i < 24 && await monthLabel() !== ymText(d); i++) {
      const cur = await monthLabel();
      const fwd = await page.evaluate(([c, want]) => { const n = s => { const m = s.match(/(\d+)年(\d+)月/); return +m[1] * 12 + +m[2]; }; return n(want) > n(c); }, [cur, ymText(d)]);
      await page.tap(fwd ? '#coach-planner-modal .co-cal-next' : '#coach-planner-modal .co-cal-prev');
      await page.waitForFunction(c => document.querySelector('#coach-planner-modal .co-cal-ym').textContent !== c, cur, { timeout: 5000 });
    }
    await page.tap(cell(d));
    await page.waitForSelector(`#coach-planner-modal .co-pday[data-date="${d}"]`, { timeout: 8000 });
  };
  const cellCls = d => page.evaluate(s => { const el = document.querySelector(s); return el ? el.className + '|' + el.textContent : null; }, cell(d));
  const firstMonth = await monthLabel();
  chk('監督の画面は今月のカレンダーから開く（前の月には戻れない）', firstMonth === ymText(TODAY) && await page.evaluate(() => document.querySelector('#coach-planner-modal .co-cal-prev').disabled), firstMonth);
  await goDay(SAT);
  const satBtns = await page.evaluate(s => ({ skip: !!document.querySelector(`#coach-planner-modal .co-pday[data-date="${s}"] .co-skip`), add: (document.querySelector('#coach-planner-modal .co-add-dates') || {}).textContent }), SAT);
  await goDay(SUN);
  const sunSkip = await page.evaluate(u => !!document.querySelector(`#coach-planner-modal .co-pday[data-date="${u}"] .co-skip`), SUN);
  chk('予定のない日にだけ「この日は聞かない」が出る・「都合を聞く日を追加」ボタンがある', !satBtns.skip && sunSkip && /都合を聞く日を追加/.test(satBtns.add || ''), JSON.stringify({ satBtns, sunSkip }));
  // この日は聞かない → 聞かない日 → 戻す
  await page.tap(`#coach-planner-modal .co-pday[data-date="${SUN}"] .co-skip`);
  await page.waitForSelector(`#coach-planner-modal .co-pday.is-skipped[data-date="${SUN}"] .co-unskip`, { timeout: 8000 });
  let p = await plan();
  const asked1 = await page.evaluate(d => FCOjima.Hub.Coaching.isAsked(d), SUN);
  const sunCell = await cellCls(SUN);
  chk('「この日は聞かない」で聞かない日になり（保存）、「聞く日に戻す」が出る。カレンダーにも「聞かない」', p && p.skip && p.skip[SUN] === true && !asked1 && /is-skipped/.test(sunCell) && /聞かない/.test(sunCell), JSON.stringify({ p, sunCell }));
  await page.screenshot({ path: 'cd-skip.png' });
  await page.tap(`#coach-planner-modal .co-pday[data-date="${SUN}"] .co-unskip`);
  await page.waitForSelector(`#coach-planner-modal .co-pday:not(.is-skipped)[data-date="${SUN}"] .co-skip`, { timeout: 8000 });
  p = await plan();
  chk('「聞く日に戻す」で元に戻る', p && (!p.skip || !p.skip[SUN]) && await page.evaluate(d => FCOjima.Hub.Coaching.isAsked(d), SUN) && /is-asked/.test(await cellCls(SUN)), JSON.stringify(p));
  // もう一度聞かない日にしておく（コーチの画面の確認用）
  await page.tap(`#coach-planner-modal .co-pday[data-date="${SUN}"] .co-skip`);
  await page.waitForSelector(`#coach-planner-modal .co-pday.is-skipped[data-date="${SUN}"]`, { timeout: 8000 });
  // 平日の祝日: 赤い日付で、下に祝日の名前
  if (expectHol.length) {
    await goDay(expectHol[0]);
    const hv = await page.evaluate(d => ({ cls: document.querySelector(`#coach-planner-modal .co-cal-day[data-date="${d}"]`).className, hol: (document.querySelector('#coach-planner-modal .co-pday .co-hol') || {}).textContent }), expectHol[0]);
    chk('平日の祝日は聞く日として赤い日付で出て、下に祝日の名前', /is-asked/.test(hv.cls) && /co-sun/.test(hv.cls) && hv.hol === H.nameOf(expectHol[0]), JSON.stringify(hv));
  }

  // 期間で追加
  await page.tap('#coach-planner-modal .co-add-dates');
  await page.waitForSelector('#coach-dates-modal #co-dates-from', { timeout: 5000 });
  await page.fill('#co-dates-from', R1[2]);
  await page.fill('#co-dates-to', R1[0]);
  await page.dispatchEvent('#co-dates-to', 'change');
  let pv = await page.evaluate(() => ({ t: document.querySelector('#coach-dates-modal .co-dates-preview').textContent, dis: document.querySelector('#coach-dates-modal .co-dates-save').disabled }));
  chk('おわりの日が前だとエラーで追加できない', /おわりの日は/.test(pv.t) && pv.dis, JSON.stringify(pv));
  await page.fill('#co-dates-from', SAT);
  await page.fill('#co-dates-to', SAT);
  await page.dispatchEvent('#co-dates-to', 'change');
  pv = await page.evaluate(() => ({ t: document.querySelector('#coach-dates-modal .co-dates-preview').textContent, dis: document.querySelector('#coach-dates-modal .co-dates-save').disabled }));
  chk('もう聞く日になっている日だけなら追加できない（その旨が出る）', /もう全部が聞く日/.test(pv.t) && pv.dis, JSON.stringify(pv));
  await page.fill('#co-dates-from', R1[0]);
  await page.fill('#co-dates-to', R1[2]);
  await page.dispatchEvent('#co-dates-to', 'change');
  pv = await page.evaluate(() => ({ t: document.querySelector('#coach-dates-modal .co-dates-preview').textContent, dis: document.querySelector('#coach-dates-modal .co-dates-save').disabled }));
  chk('期間を選ぶと新しく聞く日が出る', /新しく聞く日: /.test(pv.t) && (pv.t.match(/\(/g) || []).length === 3 && !pv.dis, JSON.stringify(pv));
  const ovd = await page.evaluate(overflow, '#coach-dates-modal');
  chk('360px で「都合を聞く日を追加」がはみ出さない', ovd.length === 0, JSON.stringify(ovd));
  await page.screenshot({ path: 'cd-add.png' });
  await page.tap('#coach-dates-modal .co-dates-save');
  await page.waitForFunction(() => document.getElementById('coach-dates-modal').style.display === 'none', null, { timeout: 8000 });
  await page.waitForSelector(`#coach-planner-modal .co-pday[data-date="${R1[0]}"]`, { timeout: 8000 });
  p = await plan();
  const r1Cells = await Promise.all(R1.map(cellCls));
  chk('追加した日が保存され、その月のカレンダーが開いて聞く日の枠になる', p && R1.every(d => p.add && p.add[d] === true) && await monthLabel() === ymText(R1[0]) && r1Cells.every(c => /is-asked/.test(c || '')), JSON.stringify({ add: p && p.add, month: await monthLabel(), r1Cells }));
  // 8週間より先も追加できる
  await page.tap('#coach-planner-modal .co-add-dates');
  await page.waitForSelector('#coach-dates-modal #co-dates-from', { timeout: 5000 });
  await page.fill('#co-dates-from', FAR[0]);
  await page.fill('#co-dates-to', FAR[1]);
  await page.dispatchEvent('#co-dates-to', 'change');
  await page.tap('#coach-dates-modal .co-dates-save');
  await page.waitForSelector(`#coach-planner-modal .co-pday[data-date="${FAR[0]}"]`, { timeout: 8000 });
  chk('8週間より先の日も追加でき、その月が開く', await monthLabel() === ymText(FAR[0]) && /is-asked/.test(await cellCls(FAR[1])), await monthLabel());
  // 追加した平日を外す（予定がなければ「この日は聞かない」で、ただの日に戻る）
  await goDay(FAR[1]);
  await page.tap(`#coach-planner-modal .co-pday[data-date="${FAR[1]}"] .co-skip`);
  await page.waitForSelector(`#coach-planner-modal .co-pday[data-date="${FAR[1]}"] .co-ask-day`, { timeout: 8000 });
  p = await plan();
  chk('追加した日も「この日は聞かない」で外せる（聞く日でない日に戻る）', p && !p.add[FAR[1]] && !(p.skip || {})[FAR[1]] && p.add[FAR[0]] === true && /is-open/.test(await cellCls(FAR[1])), JSON.stringify(p && p.add));
  // カレンダーの日を選んで「この日も指導者に都合を聞く」
  await page.tap(`#coach-planner-modal .co-pday[data-date="${FAR[1]}"] .co-ask-day`);
  await page.waitForSelector(`#coach-planner-modal .co-pday[data-date="${FAR[1]}"] .co-avail`, { timeout: 8000 });
  p = await plan();
  chk('聞く日でない日も、選んで「この日も指導者に都合を聞く」で聞く日にできる', p.add[FAR[1]] === true && /is-asked/.test(await cellCls(FAR[1])), JSON.stringify(p.add));
  await page.tap(`#coach-planner-modal .co-pday[data-date="${FAR[1]}"] .co-skip`);
  await page.waitForSelector(`#coach-planner-modal .co-pday[data-date="${FAR[1]}"] .co-ask-day`, { timeout: 8000 });
  const ov = await page.evaluate(overflow, '#coach-planner-modal');
  chk('360px で指導者の予定・担当の画面がはみ出さない', ov.length === 0, JSON.stringify(ov));
  await page.tap('#coach-planner-modal .close');

  // カレンダーの日付から: まだ聞いていない平日
  const cand = await page.evaluate(([today, r1]) => {
    const C = FCOjima.Hub.Coaching;
    return [...document.querySelectorAll('#calendar-grid .calendar-day')].map(c => c.dataset.date).filter(d => {
      const w = new Date(d + 'T00:00:00').getDay();
      return d > today && w >= 1 && w <= 5 && !FCOjima.Holidays.nameOf(d) && !C.isAsked(d) && r1.indexOf(d) === -1;
    })[0] || null;
  }, [TODAY, R1]);
  if (!cand) console.log('（カレンダーの表示中の月に、まだ聞いていない平日がないため省略）');
  else {
    await page.evaluate(d => FCOjima.Hub.Calendar.openDayModal(d), cand);
    await page.waitForFunction(() => /まだ都合を聞いていない/.test(document.getElementById('day-events-coach').textContent), null, { timeout: 8000 });
    await page.tap('#day-events-coach .co-dayask-on');
    await page.waitForFunction(() => /都合を聞く日です/.test(document.getElementById('day-events-coach').textContent), null, { timeout: 8000 });
    p = await plan();
    const t = await page.evaluate(() => document.getElementById('day-events-coach').textContent);
    const mark = await page.evaluate(d => !!document.querySelector(`#calendar-grid .calendar-day[data-date="${d}"] .cal-coach-mark`), cand);
    chk('カレンダーの日付から「この日も指導者に都合を聞く」で聞く日になり、日付に🧢の印が付く', p.add[cand] === true && /回答 0 \/ 3人/.test(t) && mark, JSON.stringify({ t, mark, cand }));
    await page.screenshot({ path: 'cd-day.png' });
    await page.tap('#day-events-coach .co-dayask-off');
    await page.waitForFunction(() => /まだ都合を聞いていない/.test(document.getElementById('day-events-coach').textContent), null, { timeout: 8000 });
    p = await plan();
    const mark2 = await page.evaluate(d => !!document.querySelector(`#calendar-grid .calendar-day[data-date="${d}"] .cal-coach-mark`), cand);
    chk('「この日は聞かない」で元に戻り、印も消える', !p.add[cand] && !mark2, JSON.stringify({ add: p.add, mark2 }));
    await page.evaluate(() => FCOjima.UI.closeModal('day-events-modal'));
  }
  // カレンダーの日付から: 聞く日（土曜・予定あり）→ 都合・担当を見る
  await page.evaluate(d => FCOjima.Hub.Calendar.openDayModal(d), SAT);
  await page.waitForFunction(() => /都合を聞く日です/.test(document.getElementById('day-events-coach').textContent), null, { timeout: 8000 });
  const satBox = await page.evaluate(() => ({ off: !!document.querySelector('#day-events-coach .co-dayask-off'), open: !!document.querySelector('#day-events-coach .co-dayask-open') }));
  chk('予定のある日は「聞かない」にできず、「都合・担当を見る」が出る', !satBox.off && satBox.open, JSON.stringify(satBox));
  await page.tap('#day-events-coach .co-dayask-open');
  await page.waitForSelector(`#coach-planner-modal .co-pday[data-date="${SAT}"]`, { timeout: 8000 });
  const opened = await page.evaluate(d => ({ day: document.getElementById('day-events-modal').style.display, month: document.querySelector('#coach-planner-modal .co-cal-ym').textContent, sel: document.querySelector(`#coach-planner-modal .co-cal-day[data-date="${d}"]`).classList.contains('is-sel') }), SAT);
  chk('「都合・担当を見る」で指導者の画面がその日を選んだ状態で開く', opened.day === 'none' && opened.month === `${parseInt(SAT.slice(0, 4))}年${parseInt(SAT.slice(5, 7))}月` && opened.sel, JSON.stringify(opened));
  await page.tap('#coach-planner-modal .close');
  // 聞かない日にした日曜はカレンダーでもそう出る
  await page.evaluate(d => FCOjima.Hub.Calendar.openDayModal(d), SUN);
  await page.waitForFunction(() => /聞かない日/.test(document.getElementById('day-events-coach').textContent), null, { timeout: 8000 });
  chk('聞かない日にした日はカレンダーの日付からも分かり、「聞く日に戻す」がある', await page.evaluate(() => !!document.querySelector('#day-events-coach .co-dayask-on')), '');
  await page.evaluate(() => FCOjima.UI.closeModal('day-events-modal'));
  // 今日より前の日には出ない
  await page.evaluate(d => FCOjima.Hub.Calendar.openDayModal(d), iso(plus(jst, -2)));
  await page.waitForTimeout(300);
  chk('今日より前の日には指導者の欄は出ない', await page.evaluate(() => document.getElementById('day-events-coach').style.display === 'none'), '');
  await page.evaluate(() => FCOjima.UI.closeModal('day-events-modal'));

  // 予定の追加フォーム: 8週間のうちの平日 → 登録すれば聞く日／8週間より先 → 「この日も都合を聞く」
  const near = await page.evaluate(([today]) => {
    for (let i = 3; i < 40; i++) {
      const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() + i);
      const s = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
      if (d.getDay() >= 1 && d.getDay() <= 5 && !FCOjima.Hub.Coaching.isAsked(s)) return s;
    }
    return null;
  }, [TODAY]);
  await page.evaluate(d => FCOjima.Hub.Calendar.openAddEventModal(new Date(d + 'T00:00:00')), near);
  await page.waitForFunction(() => /予定（ナイター練習以外）を登録すると/.test(document.getElementById('event-coach-hint').textContent), null, { timeout: 8000 });
  chk('8週間のうちのまだ聞いていない日は「予定を登録すると聞く日になる」と出る', true, near);
  await page.fill('#event-date', LATE);
  await page.dispatchEvent('#event-date', 'change');
  await page.waitForSelector('#event-coach-hint .co-hint-ask', { timeout: 8000 });
  await page.tap('#event-coach-hint .co-hint-ask');
  await page.waitForFunction(() => /未回答3人/.test(document.getElementById('event-coach-hint').textContent.replace(/\s+/g, '')), null, { timeout: 8000 });
  p = await plan();
  chk('8週間より先の日は予定の追加フォームから「この日も都合を聞く」にできる', p.add[LATE] === true, JSON.stringify(p.add));
  await page.evaluate(() => FCOjima.UI.closeModal('event-modal'));
  const bad = errs.filter(e => !ignorable(e));
  chk('ページエラーなし（監督）', bad.length === 0, JSON.stringify(bad.slice(0, 3)));
  await ctx.close();
}

// 2) コーチ: 祝日・追加した日が並び、聞かない日は出ない
{
  const ctx = await context({ email: 'suzuki@example.com', name: '鈴木 コーチ', device: mob(320) });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  await open(page);
  await page.tap('#my-events-tab');
  await page.waitForSelector('#my-coaching .co-cal-day', { timeout: 10000 });
  // 最初の月から › で最後の月まで、聞かれている日（押せる枠）を集める
  const dates = [], hols = [];
  for (let i = 0; i < 12; i++) {
    const m = await page.evaluate(() => [...document.querySelectorAll('#my-coaching button.co-cal-day.is-asked')].map(b => ({ d: b.dataset.date, red: b.classList.contains('co-sun') })));
    m.forEach(x => { dates.push(x.d); if (H.nameOf(x.d)) hols.push(x); });
    if (await page.evaluate(() => document.querySelector('#my-coaching .co-cal-next').disabled)) break;
    const cur = await page.evaluate(() => document.querySelector('#my-coaching .co-cal-ym').textContent);
    await page.tap('#my-coaching .co-cal-next');
    await page.waitForFunction(c => document.querySelector('#my-coaching .co-cal-ym').textContent !== c, cur, { timeout: 5000 });
  }
  chk('「聞かない日」にした日曜はコーチのカレンダーで押せない', dates.indexOf(SUN) === -1 && dates.indexOf(SAT) !== -1, SUN);
  chk('追加した平日（8週間より先も）がコーチのカレンダーで聞かれている日になる', R1.every(d => dates.indexOf(d) !== -1) && dates.indexOf(FAR[0]) !== -1 && dates.indexOf(FAR[1]) === -1 && dates.indexOf(LATE) !== -1, JSON.stringify(dates));
  chk('祝日は赤い日付で出る', hols.length > 0 ? hols.every(x => x.red) : true, JSON.stringify(hols));
  if (hols.length) {
    await page.evaluate(d => { const C = FCOjima.Hub.Coaching; C._mineMonth = d.slice(0, 7); C._mineSel = d; C.renderMine(document.getElementById('my-coaching'), C.myCoach(FCOjima.Auth.currentUserProfile)); }, hols[0].d);
    await page.waitForSelector(`#my-coaching .co-daypanel[data-date="${hols[0].d}"]`, { timeout: 5000 });
    const hn = await page.evaluate(() => (document.querySelector('#my-coaching .co-daypanel .co-hol') || {}).textContent);
    chk('祝日を選ぶと下に祝日の名前が出る', hn === H.nameOf(hols[0].d), String(hn));
  }
  const head = await page.evaluate(() => document.querySelector('#my-coaching .co-progress-head .co-sub-title').textContent);
  chk('見出しは「都合の回答」（土日だけではないため）', head === '都合の回答', head);
  const ov = await page.evaluate(overflow, '#my-coaching');
  chk('320px で指導の予定がはみ出さない', ov.length === 0, JSON.stringify(ov));
  await page.locator('#my-coaching .co-card').screenshot({ path: 'cd-my.png' });
  // コーチ（マネージャー）もカレンダーに印が付く
  const bad = errs.filter(e => !ignorable(e));
  chk('ページエラーなし（コーチ）', bad.length === 0, JSON.stringify(bad.slice(0, 3)));
  await ctx.close();
}

// 3) 保護者: 聞く日は読めるが変えられない。カレンダーに印・指導者の欄は出ない
{
  const ctx = await context({ email: 'coachmom@example.com', name: '一年 母', device: mob(360) });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  page.on('dialog', d => d.accept());
  await open(page);
  await page.evaluate(() => FCOjima.UI.closeModal('move-notice-modal'));
  const r = await page.evaluate(async () => {
    const doc = FCOjimaFirebase.Collections.members().parent.collection('coachDates').doc('plan');
    const out = {};
    try { await doc.get(); out.read = 'ok'; } catch (e) { out.read = e.code; }
    try { await doc.set({ add: { '2030-01-01': true } }, { merge: true }); out.write = 'ok'; } catch (e) { out.write = e.code; }
    return out;
  });
  chk('保護者は聞く日を読めるが、変えられない', r.read === 'ok' && r.write === 'permission-denied', JSON.stringify(r));
  await page.evaluate(d => FCOjima.Hub.Calendar.openDayModal(d), SAT);
  await page.waitForTimeout(400);
  const v = await page.evaluate(() => ({ coach: document.getElementById('day-events-coach').style.display, marks: document.querySelectorAll('.cal-coach-mark').length }));
  chk('保護者にはカレンダーの🧢の印も、その日の予定の指導者の欄も出ない', v.coach === 'none' && v.marks === 0, JSON.stringify(v));
  const bad = errs.filter(e => !ignorable(e) && !/permission/i.test(e));
  chk('ページエラーなし（保護者）', bad.length === 0, JSON.stringify(bad.slice(0, 3)));
  await ctx.close();
}
await closeBrowser();
process.exit(summary() ? 1 : 0);
