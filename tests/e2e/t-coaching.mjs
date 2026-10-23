// 監督・コーチの都合（カレンダー: タップで ○ → △ → × → 未回答）と、予定ごとの担当（監督のカレンダー）
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors } from './lib.mjs';
await wipe();
const today = new Date(Date.now() + 9 * 3600e3);
const iso = d => d.toISOString().slice(0, 10);
// 次の土曜・日曜（今日が土日なら来週の土日）
const sat = new Date(today); sat.setUTCDate(sat.getUTCDate() + ((6 - sat.getUTCDay() + 7) % 7 || 7));
const sun = new Date(sat); sun.setUTCDate(sun.getUTCDate() + 1);
const SAT = iso(sat), SUN = iso(sun);
await put(`${T}/members/c1`, { name: '佐藤 監督', role: 'coach', abbr: '佐藤' });
await put(`${T}/members/c2`, { name: '鈴木 コーチ', role: 'assist', abbr: '鈴木' });
await put(`${T}/members/c3`, { name: '田中 コーチ', role: 'assist', abbr: '田中' });
await put(`${T}/members/p1`, { name: '一年 太郎', role: 'player', grade: '1' });
await put(`${T}/members/f1`, { name: '一年 母', role: 'mother', childrenIds: ['p1'] });
const E1 = '1900000080001', E2 = '1900000080002', EN = '1900000080003';
await put(`${T}/events/${E1}`, { title: '笠懸', date: SAT, type: 'game', target: ['1', '2'], startTime: '09:00', venue: '笠懸球技場' });
await put(`${T}/events/${E2}`, { title: '練習', date: SAT, type: 'practice', target: ['3', '4'], startTime: '13:00' });
await put(`${T}/events/${EN}`, { title: 'ナイター練習', date: SAT, type: 'nighter', target: ['1', '2', '3', '4', '5', '6'] });
await makeUser('kantoku@example.com', '佐藤 監督', 'coach');
await makeUser('suzuki@example.com', '鈴木 コーチ', 'assist');
await makeUser('coachmom@example.com', '一年 母', 'parent', { childrenIds: ['p1'] });
const mob = (w) => ({ viewport: { width: w, height: w <= 320 ? 568 : 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const overflow = (s => {
  const vw = document.documentElement.clientWidth;
  return [...document.querySelectorAll(s + ' *')].filter(e => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && (r.right > vw + .5 || r.left < -.5);
  }).map(e => e.className || e.tagName).slice(0, 5);
});
const ignorable = e => /favicon|ERR_|Failed to load resource|open-meteo|gsi|storage/i.test(e);
const cellSel = d => `#my-coaching .co-cal-day[data-date="${d}"]`;
const ymText = d => `${parseInt(d.slice(0, 4))}年${parseInt(d.slice(5, 7))}月`;

// 1) コーチ（鈴木）: 参加予定タブの「指導の予定」（月のカレンダー）
{
  const ctx = await context({ email: 'suzuki@example.com', name: '鈴木 コーチ', device: mob(320) });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  page.on('dialog', d => d.accept(d.type() === 'prompt' ? '10時から' : undefined));
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  chk('子どものいないコーチにも「参加予定」タブが出る', await page.evaluate(() => getComputedStyle(document.getElementById('my-events-tab')).display !== 'none'), '');
  await page.tap('#my-events-tab');
  await page.waitForSelector('#my-coaching .co-cal-day', { timeout: 10000 });
  const rerender = () => page.evaluate(() => FCOjima.Hub.Coaching.renderMine(document.getElementById('my-coaching'), FCOjima.Hub.Coaching.myCoach(FCOjima.Auth.currentUserProfile)));
  // その日を選んで開く
  const openDay = async (date) => {
    await page.evaluate(d => { FCOjima.Hub.Coaching._mineMonth = d.slice(0, 7); FCOjima.Hub.Coaching._mineSel = d; }, date);
    await rerender();
    await page.waitForSelector(cellSel(date), { timeout: 5000 });
  };
  const v = await page.evaluate(() => ({
    duty: document.querySelector('#my-coaching .co-duty').textContent,
    progress: document.querySelector('#my-coaching .co-progress-num').textContent,
    month: document.querySelector('#my-coaching .co-cal-ym').textContent,
    dows: [...document.querySelectorAll('#my-coaching .co-cal-dows span')].map(s => s.textContent).join(''),
    kids: getComputedStyle(document.getElementById('my-events-kids')).display
  }));
  chk('いちばん上に「あなたの担当」（まだなければその旨）', /あなたの担当/.test(v.duty) && /まだ担当はありません/.test(v.duty), v.duty);
  chk('回答の進み具合が出る（回答済み 0 / N日）', /回答済み 0 \/ \d+日/.test(v.progress), v.progress);
  chk('月のカレンダー（月曜始まり）で出る', /^\d{4}年\d{1,2}月$/.test(v.month) && v.dows === '月火水木金土日', JSON.stringify(v));
  chk('子どもがいなければ子どもの参加予定の欄は出ない', v.kids === 'none', v.kids);
  await openDay(SAT);
  const c0 = await page.evaluate((s) => { const c = document.querySelector(s); return { tag: c.tagName, un: c.classList.contains('is-unanswered'), mark: c.querySelector('.co-cal-mark').textContent, dot: !!c.querySelector('.co-cal-dot') }; }, cellSel(SAT));
  const off = await page.evaluate(() => [...document.querySelectorAll('#my-coaching .co-cal-day.is-off')].map(e => e.tagName));
  chk('聞かれている日は押せる枠（未回答）で、予定がある日に印。聞かれていない日は押せない', c0.tag === 'BUTTON' && c0.un && c0.mark === '' && c0.dot && off.length > 0 && off.every(t => t === 'SPAN'), JSON.stringify({ c0, off: off.length }));
  const panel0 = await page.evaluate(() => ({ evs: document.querySelector('#my-coaching .co-dp-evs').textContent, state: document.querySelector('#my-coaching .co-dp-state').textContent, btns: [...document.querySelectorAll('#my-coaching .co-answer3 .co-ans')].map(b => b.textContent) }));
  chk('下にその日の予定（ナイター練習は除く）と ○ 行ける／△ 一部だけ／× 行けない', /笠懸09:00〜/.test(panel0.evs) && /練習13:00〜/.test(panel0.evs) && !/ナイター/.test(panel0.evs) && panel0.state === '未回答' && JSON.stringify(panel0.btns) === JSON.stringify(['○行ける', '△一部だけ', '×行けない']), JSON.stringify(panel0));
  // タップするたびに ○ → △ → × → 未回答
  const tapCell = async (d) => { await page.tap(cellSel(d)); await page.waitForTimeout(150); };
  const markOf = d => page.evaluate(s => document.querySelector(s).querySelector('.co-cal-mark').textContent, cellSel(d));
  const answerOf = async (d) => { await page.evaluate(() => FCOjima.Hub.Coaching.whenSaved()); const a = await get(`${T}/coachAvailability/c2`); return a && a.answers && a.answers[d] ? a.answers[d].s : null; };
  await tapCell(SAT);
  let m1 = await markOf(SAT);
  chk('1回タップで ○（保存される）', m1 === '○' && await answerOf(SAT) === 'ok', m1);
  await tapCell(SAT);
  m1 = await markOf(SAT);
  const part = await page.evaluate(() => [...document.querySelectorAll('#my-coaching .co-part-btn')].map(b => b.textContent + (b.classList.contains('is-on') ? '*' : '')));
  chk('2回目で △（時間による）。下に 午前だけ／午後だけ／時間による', m1 === '△' && await answerOf(SAT) === 'part' && JSON.stringify(part) === JSON.stringify(['午前だけ', '午後だけ', '時間による*']), JSON.stringify({ m1, part }));
  await page.tap('#my-coaching .co-part-btn[data-s="am"]');
  await page.waitForTimeout(150);
  const sub = await page.evaluate(s => (document.querySelector(s).querySelector('.co-cal-sub') || {}).textContent, cellSel(SAT));
  chk('△の中身を「午前だけ」にできる（カレンダーにも小さく出る）', await answerOf(SAT) === 'am' && sub === '午前', String(sub));
  await tapCell(SAT);
  chk('3回目で ×', await markOf(SAT) === '×' && await answerOf(SAT) === 'ng', '');
  await tapCell(SAT);
  chk('4回目で未回答に戻る（保存からも消える）', await markOf(SAT) === '' && await answerOf(SAT) === null, '');
  await tapCell(SAT);
  // 下のボタン: 選んでいるものをもう一度押すと取り消し
  await page.tap('#my-coaching .co-answer3 .co-ans[data-s="ok"]');
  await page.waitForTimeout(150);
  chk('下の ○ をもう一度押すと取り消し', await answerOf(SAT) === null, '');
  await page.tap('#my-coaching .co-answer3 .co-ans[data-s="ng"]');
  await page.waitForTimeout(150);
  chk('下の × を押すと ×', await answerOf(SAT) === 'ng' && await markOf(SAT) === '×', '');
  await page.tap('#my-coaching .co-answer3 .co-ans[data-s="ok"]');
  await page.waitForTimeout(150);
  await page.tap('#my-coaching .co-memo');
  await page.waitForFunction(() => document.querySelector('#my-coaching .co-memo.has-note'), null, { timeout: 8000 });
  let av = await get(`${T}/coachAvailability/c2`);
  await page.evaluate(() => FCOjima.Hub.Coaching.whenSaved());
  av = await get(`${T}/coachAvailability/c2`);
  chk('メモも書ける', av && av.answers[SAT].s === 'ok' && av.answers[SAT].note === '10時から', JSON.stringify(av && av.answers));
  await tapCell(SAT);
  await page.evaluate(() => FCOjima.Hub.Coaching.whenSaved());
  av = await get(`${T}/coachAvailability/c2`);
  chk('カレンダーで変えてもメモは残る', av.answers[SAT].s === 'part' && av.answers[SAT].note === '10時から', JSON.stringify(av.answers[SAT]));
  await page.tap('#my-coaching .co-answer3 .co-ans[data-s="ok"]');
  await page.waitForTimeout(150);
  // 次の日へ（›）
  await page.tap('#my-coaching .co-dp-next');
  await page.waitForTimeout(150);
  const selNext = await page.evaluate(() => ({ panel: document.querySelector('#my-coaching .co-daypanel').dataset.date, sel: (document.querySelector('#my-coaching .co-cal-day.is-sel') || {}).dataset }));
  chk('下の › で次の聞かれている日へ（カレンダーでも選ばれる）', selNext.panel === SUN && selNext.sel && selNext.sel.date === SUN, JSON.stringify(selNext));
  const ov = await page.evaluate(overflow, '#my-coaching');
  chk('320px で指導の予定がはみ出さない', ov.length === 0, JSON.stringify(ov));
  await page.locator('#my-coaching .co-card').screenshot({ path: 'co-my.png' });
  // 月の切り替え
  const months = await page.evaluate(() => [...new Set(FCOjima.Hub.Coaching.planDates().map(d => d.slice(0, 7)))].sort());
  chk('聞く日は2か月以上にわたる（8週間分）', months.length >= 2, JSON.stringify(months));
  await page.evaluate(m => { FCOjima.Hub.Coaching._mineMonth = m; FCOjima.Hub.Coaching._mineSel = null; }, months[0]);
  await rerender();
  const navState = await page.evaluate(() => ({ prev: document.querySelector('#my-coaching .co-cal-prev').disabled, next: document.querySelector('#my-coaching .co-cal-next').disabled }));
  await page.tap('#my-coaching .co-cal-next');
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => document.querySelector('#my-coaching .co-cal-ym').textContent);
  chk('‹ › で月を切り替えられる（最初の月は ‹ が押せない）', navState.prev && !navState.next && after === ymText(months[1] + '-01'), JSON.stringify({ navState, after }));
  // まとめて ○
  await page.tap('#my-coaching .co-bulk');
  await page.waitForFunction(() => !document.querySelector('#my-coaching .co-bulk'), null, { timeout: 8000 });
  av = await get(`${T}/coachAvailability/c2`);
  const all = await page.evaluate(() => FCOjima.Hub.Coaching.planDates());
  chk('「未回答をまとめて ○」で残りの日がすべて ○（回答済みの日・メモはそのまま）', all.every(d => av.answers[d] && av.answers[d].s === 'ok') && av.answers[SAT].note === '10時から', Object.keys(av.answers).length + '/' + all.length);
  chk('全部回答すると「✓ 回答済み」', await page.evaluate(() => /✓ 回答済み/.test(document.querySelector('#my-coaching .co-cal-nav').textContent)), '');
  // 日曜を × にしておく（監督の画面の確認用）: ○ → △ → ×
  await openDay(SUN);
  await tapCell(SUN);
  await tapCell(SUN);
  chk('日曜を × に（○ から2回タップ）', await answerOf(SUN) === 'ng', '');
  const bad = errs.filter(e => !ignorable(e));
  chk('ページエラーなし（コーチ）', bad.length === 0, JSON.stringify(bad.slice(0, 3)));
  await ctx.close();
}

// 2) 監督: 管理タブ「指導者の予定・担当」（月のカレンダー）
{
  const ctx = await context({ email: 'kantoku@example.com', name: '佐藤 監督', device: mob(360) });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  page.on('dialog', d => d.accept());
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.getElementById('admin-tab').click());
  await page.tap('#btn-coach-planner');
  await page.waitForSelector('#coach-planner-modal .co-cal-day', { timeout: 10000 });
  // 土曜の月へ（担当のいない日が最初に開く）
  await page.evaluate(d => { FCOjima.Hub.Coaching._planMonth = d.slice(0, 7); FCOjima.Hub.Coaching._planSel = null; FCOjima.Hub.Coaching.renderPlanner(); }, SAT);
  const cell = d => `#coach-planner-modal .co-cal-day[data-date="${d}"]`;
  const cellInfo = d => page.evaluate(s => { const el = document.querySelector(s); return { counts: (el.querySelector('.co-cal-counts') || {}).textContent, st: (el.querySelector('.co-cal-st') || {}).textContent || '', sel: el.classList.contains('is-sel') }; }, cell(d));
  const c = await cellInfo(SAT);
  chk('カレンダーに ○△× の人数と ⚠（担当のいない予定）。最初は担当のいない日が開く', c.counts === '○1' && c.st === '⚠' && c.sel, JSON.stringify(c));
  const csun = await cellInfo(SUN);
  chk('予定のない日は人数だけ（日曜は ×1）', csun.counts === '×1' && csun.st === '', JSON.stringify(csun));
  const tag = await page.evaluate(() => (document.querySelector('#coach-planner-modal .co-cal-nav .co-tag') || {}).textContent);
  chk('月の見出しに「⚠ 担当なし N日」', tag === '⚠ 担当なし 1日', String(tag));
  const day = await page.evaluate((d) => {
    const el = document.querySelector(`#coach-planner-modal .co-pday[data-date="${d}"]`);
    const line = cls => [...el.querySelectorAll(cls + ' .co-person')].map(p => p.textContent);
    return {
      ok: line('.co-line-ok'), none: line('.co-line-none'),
      evs: [...el.querySelectorAll('.co-pev')].map(e => e.querySelector('.co-pev-title').textContent + '|' + e.querySelector('.co-pev-chips').textContent + '|' + [...e.querySelectorAll('.co-cand')].map(c => c.textContent).join(','))
    };
  }, SAT);
  chk('下にその日の「行ける／未回答」の人（メモも）', JSON.stringify(day.ok) === JSON.stringify(['鈴木📝10時から']) && JSON.stringify(day.none) === JSON.stringify(['佐藤', '田中']), JSON.stringify(day));
  chk('予定ごとに担当（まだいない）と、押せば担当になる行ける人（ナイター練習は出ない）', JSON.stringify(day.evs) === JSON.stringify(['笠懸|⚠ まだいません|＋ 鈴木', '練習|⚠ まだいません|＋ 鈴木']), JSON.stringify(day.evs));
  // 代わりに都合を入れる（田中は ×）
  await page.locator(`#coach-planner-modal .co-pday[data-date="${SAT}"] .co-person`, { hasText: '田中' }).tap();
  await page.waitForSelector('#coach-answer-modal .co-ans', { timeout: 5000 });
  const sheet = await page.evaluate(() => ({ title: document.querySelector('#coach-answer-modal .co-answer-title').textContent, btns: [...document.querySelectorAll('#coach-answer-modal .co-ans')].map(b => b.textContent) }));
  chk('名前を押すと、その人のその日の都合を入れる画面（○ △ ×）', /^田中 コーチ /.test(sheet.title) && JSON.stringify(sheet.btns) === JSON.stringify(['○行ける', '△一部だけ', '×行けない']), JSON.stringify(sheet));
  await page.tap('#coach-answer-modal .co-ans[data-s="ng"]');
  await page.waitForTimeout(600);
  const av3 = await get(`${T}/coachAvailability/c3`);
  const ng = await page.evaluate((d) => [...document.querySelectorAll(`#coach-planner-modal .co-pday[data-date="${d}"] .co-line-ng .co-person`)].map(p => p.textContent), SAT);
  chk('本人の代わりに都合を入れられ（×はすぐ保存して閉じる）、「行けない」の行に移る', av3 && av3.answers[SAT].s === 'ng' && JSON.stringify(ng) === JSON.stringify(['田中']) && await page.evaluate(() => document.getElementById('coach-answer-modal').style.display === 'none'), JSON.stringify({ av3, ng }));
  // 代わりに △ 午後だけ（佐藤）
  await page.locator(`#coach-planner-modal .co-pday[data-date="${SAT}"] .co-person`, { hasText: '佐藤' }).tap();
  await page.waitForSelector('#coach-answer-modal .co-ans', { timeout: 5000 });
  await page.tap('#coach-answer-modal .co-ans[data-s="part"]');
  await page.waitForSelector('#coach-answer-modal .co-part-btn[data-s="pm"]', { timeout: 5000 });
  await page.tap('#coach-answer-modal .co-part-btn[data-s="pm"]');
  await page.waitForTimeout(600);
  const av1 = await get(`${T}/coachAvailability/c1`);
  const pt = await page.evaluate((d) => [...document.querySelectorAll(`#coach-planner-modal .co-pday[data-date="${d}"] .co-line-pt .co-person`)].map(p => p.textContent), SAT);
  chk('代わりの入力で △ を選ぶと「午前だけ・午後だけ・時間による」を選べる（一部の行に出る）', av1 && av1.answers[SAT].s === 'pm' && JSON.stringify(pt) === JSON.stringify(['佐藤△午後']), JSON.stringify({ av1, pt }));
  chk('カレンダーの人数も変わる（○1 △1 ×1）', (await cellInfo(SAT)).counts === '○1△1×1', JSON.stringify(await cellInfo(SAT)));
  // 1タップで担当に
  await page.locator(`#coach-planner-modal .co-pev[data-event="${E1}"]`).locator('.co-cand', { hasText: '鈴木' }).tap();
  await page.waitForFunction((id) => !!document.querySelector(`#coach-planner-modal .co-pev[data-event="${id}"] .co-assigned`), E1, { timeout: 8000 });
  let as1 = await get(`${T}/coachAssignments/${E1}`);
  const ev2 = await page.evaluate(() => [...document.querySelectorAll('#coach-planner-modal .co-pev')].map(e => e.querySelector('.co-pev-chips').textContent + '|' + [...e.querySelectorAll('.co-cand')].map(c => c.textContent).join(',')));
  chk('行ける人を押すと1タップで担当になり、すぐ保存される', as1 && JSON.stringify(as1.memberIds) === JSON.stringify(['c2']) && /^鈴木✕/.test(ev2[0]), JSON.stringify({ as1, ev2 }));
  chk('同じ日の別の予定では「〇〇も担当」と出る（掛け持ちに気づける）', /＋ 鈴木笠懸も担当/.test(ev2[1]) && /＋ 佐藤△午後/.test(ev2[1]), ev2[1]);
  chk('まだ担当のいない予定が残っていればカレンダーは ⚠ のまま', (await cellInfo(SAT)).st === '⚠', '');
  // ✕ で外す → もう一度付ける
  await page.locator(`#coach-planner-modal .co-pev[data-event="${E1}"]`).locator('.co-assigned').tap();
  await page.waitForFunction((id) => !document.querySelector(`#coach-planner-modal .co-pev[data-event="${id}"] .co-assigned`), E1, { timeout: 8000 });
  as1 = await get(`${T}/coachAssignments/${E1}`);
  chk('担当の ✕ で外せる', as1 && as1.memberIds.length === 0, JSON.stringify(as1));
  await page.locator(`#coach-planner-modal .co-pev[data-event="${E1}"]`).locator('.co-cand', { hasText: '鈴木' }).tap();
  await page.waitForFunction((id) => !!document.querySelector(`#coach-planner-modal .co-pev[data-event="${id}"] .co-assigned`), E1, { timeout: 8000 });
  // ほかの人から選ぶ（田中＝行けない を練習に）
  await page.locator(`#coach-planner-modal .co-pev[data-event="${E2}"]`).locator('.co-more-pick').tap();
  await page.waitForSelector('#coach-assign-modal .co-pick', { timeout: 5000 });
  const groups = await page.evaluate(() => [...document.querySelectorAll('#coach-assign-modal .co-pick-group')].map(g => g.querySelector('.co-sub-title').textContent + ':' + [...g.querySelectorAll('.co-pick')].map(b => b.querySelector('.co-pick-name').firstChild.textContent).join(',')));
  chk('「ほかの人から選ぶ」は行ける人（○・△）・行けない人に分かれる', JSON.stringify(groups) === JSON.stringify(['行ける人（○・△）:鈴木 コーチ,佐藤 監督', '行けない人:田中 コーチ']), JSON.stringify(groups));
  await page.locator('#coach-assign-modal .co-pick', { hasText: '田中' }).tap();
  await page.waitForFunction(() => document.querySelector('#coach-assign-modal .co-pick.is-on'), null, { timeout: 8000 });
  await page.tap('#coach-assign-modal .close');
  await page.waitForTimeout(400);
  const as2 = await get(`${T}/coachAssignments/${E2}`);
  const st2 = await cellInfo(SAT);
  const tag2 = await page.evaluate(() => (document.querySelector('#coach-planner-modal .co-cal-nav .co-tag') || {}).textContent || '');
  chk('ほかの人も担当にでき、全部の予定に担当がつくとカレンダーが ✓ になる（見出しの ⚠ も消える）', as2 && JSON.stringify(as2.memberIds) === JSON.stringify(['c3']) && st2.st === '✓' && !/担当なし/.test(tag2), JSON.stringify({ as2, st2, tag2 }));
  // 日をタップすると下が切り替わる
  await page.tap(cell(SUN));
  await page.waitForSelector(`#coach-planner-modal .co-pday[data-date="${SUN}"]`, { timeout: 5000 });
  chk('日をタップすると下にその日が出る', (await cellInfo(SUN)).sel, '');
  const ov = await page.evaluate(overflow, '#coach-planner-modal');
  chk('360px で指導者の予定・担当の画面がはみ出さない', ov.length === 0, JSON.stringify(ov));
  await page.tap(cell(SAT));
  await page.waitForSelector(`#coach-planner-modal .co-pday[data-date="${SAT}"]`, { timeout: 5000 });
  await page.screenshot({ path: 'co-plan.png' });
  // 回答のお願い（LINE用）
  await page.tap('#coach-planner-modal .co-copy-request');
  await page.waitForTimeout(500);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  chk('未回答の人へのお願いをコピーできる（全部回答した人は入らない）', /【指導者の都合のお願い】/.test(clip) && /カレンダー/.test(clip) && /佐藤 監督さん/.test(clip) && !/鈴木 コーチさん/.test(clip), clip.slice(0, 160));
  // この日に予定を追加 → フォームにその日の都合
  await page.tap(cell(SUN));
  await page.waitForSelector(`#coach-planner-modal .co-pday[data-date="${SUN}"] .co-add-ev`, { timeout: 5000 });
  await page.tap(`#coach-planner-modal .co-pday[data-date="${SUN}"] .co-add-ev`);
  await page.waitForFunction(() => document.getElementById('event-modal').style.display === 'flex', null, { timeout: 5000 });
  await page.waitForFunction(() => /この日の指導者/.test(document.getElementById('event-coach-hint').textContent), null, { timeout: 5000 });
  const h1 = await page.evaluate(() => ({ date: document.getElementById('event-date').value, hint: document.getElementById('event-coach-hint').textContent.replace(/\s+/g, '') }));
  chk('「この日に予定を追加」でその日付の予定追加が開き、その日の都合が出る', h1.date === SUN && /行けない鈴木/.test(h1.hint) && /未回答2人/.test(h1.hint), JSON.stringify(h1));
  await page.fill('#event-date', SAT);
  await page.dispatchEvent('#event-date', 'change');
  await page.waitForTimeout(300);
  const h2 = await page.evaluate(() => document.getElementById('event-coach-hint').textContent.replace(/\s+/g, ''));
  chk('日付を変えるとその日の都合に変わる（△は △午後 などと添える）', /行ける鈴木・佐藤（△午後）/.test(h2) && /行けない田中/.test(h2), h2);
  await page.evaluate(() => FCOjima.UI.closeModal('event-modal'));
  // 予定の詳細
  await page.evaluate(id => FCOjima.Hub.Calendar.showEventDetails(id), E1);
  await page.waitForSelector('#event-coach-btn', { timeout: 8000 });
  const det = await page.evaluate(() => [...document.querySelectorAll('#event-details-content .ed-fact')].map(f => f.textContent.replace(/\s+/g, '')).filter(t => /帯同指導者/.test(t)));
  chk('予定の詳細に「🧢 帯同指導者」と担当の名前（マネージャーには「担当」ボタン）', det.length === 1 && /🧢帯同指導者鈴木コーチ担当/.test(det[0]), JSON.stringify(det));
  await page.tap('#event-coach-btn');
  await page.waitForSelector('#coach-assign-modal .co-pick', { timeout: 5000 });
  await page.waitForTimeout(400);
  const onTop = await page.evaluate(() => { const r = document.querySelector('#coach-assign-modal .modal-content').getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + 30); return document.getElementById('coach-assign-modal').contains(el); });
  chk('予定の詳細からも担当を選べる（詳細の上に開く）', onTop, '');
  await page.screenshot({ path: 'co-pick.png' });
  await page.tap('#coach-assign-modal .close');
  const bad = errs.filter(e => !ignorable(e));
  chk('ページエラーなし（監督）', bad.length === 0, JSON.stringify(bad.slice(0, 3)));
  await ctx.close();
}

// 3) 保護者: 担当は見えるが、都合は読めない・担当は変えられない
{
  const ctx = await context({ email: 'coachmom@example.com', name: '一年 母', device: mob(360) });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  page.on('dialog', d => d.accept());
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => FCOjima.UI.closeModal('move-notice-modal'));
  await page.evaluate(id => FCOjima.Hub.Calendar.showEventDetails(id), E1);
  await page.waitForSelector('.ed-head', { timeout: 8000 });
  await page.waitForTimeout(300);
  const det = await page.evaluate(() => ({ text: document.getElementById('event-details-content').textContent.replace(/\s+/g, ''), btn: !!document.getElementById('event-coach-btn') }));
  chk('保護者にも予定の詳細で担当の指導者が見える（「担当」ボタンは出ない）', /🧢帯同指導者鈴木コーチ/.test(det.text) && !det.btn, det.text.slice(0, 80));
  chk('保護者の参加予定タブには「指導の予定」は出ない', await page.evaluate(() => document.getElementById('my-coaching').innerHTML === ''), '');
  const r = await page.evaluate(async () => {
    const team = FCOjimaFirebase.Collections.members().parent;
    const out = {};
    try { await team.collection('coachAvailability').get(); out.read = 'ok'; } catch (e) { out.read = e.code; }
    try { await team.collection('coachAssignments').doc('x').set({ memberIds: ['c1'] }); out.assign = 'ok'; } catch (e) { out.assign = e.code; }
    try { await team.collection('coachAvailability').doc('c2').set({ answers: {} }, { merge: true }); out.write = 'ok'; } catch (e) { out.write = e.code; }
    return out;
  });
  chk('保護者は指導者の都合を読めず、都合・担当を書き換えられない', r.read === 'permission-denied' && r.assign === 'permission-denied' && r.write === 'permission-denied', JSON.stringify(r));
  const bad = errs.filter(e => !ignorable(e) && !/permission/i.test(e));
  chk('ページエラーなし（保護者）', bad.length === 0, JSON.stringify(bad.slice(0, 3)));
  await ctx.close();
}

// 4) コーチ本人: いちばん上の「あなたの担当」とカレンダーの🧢
{
  const ctx = await context({ email: 'suzuki@example.com', name: '鈴木 コーチ', device: mob(360) });
  const page = await ctx.newPage();
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.tap('#my-events-tab');
  await page.waitForSelector('#my-coaching .co-duty-item', { timeout: 10000 });
  const duty = await page.evaluate(() => [...document.querySelectorAll('#my-coaching .co-duty-item')].map(b => b.textContent));
  await page.evaluate(d => { FCOjima.Hub.Coaching._mineMonth = d.slice(0, 7); FCOjima.Hub.Coaching._mineSel = d; FCOjima.Hub.Coaching.renderMine(document.getElementById('my-coaching'), FCOjima.Hub.Coaching.myCoach(FCOjima.Auth.currentUserProfile)); }, SAT);
  await page.waitForSelector(cellSel(SAT), { timeout: 5000 });
  const flag = await page.evaluate(s => document.querySelector(s).querySelector('.co-cal-flag').textContent, cellSel(SAT));
  const mine = await page.evaluate(() => (document.querySelector('#my-coaching .co-daypanel .co-mine') || {}).textContent || '');
  chk('コーチ本人のいちばん上に「あなたの担当」（日付・予定・時間・会場）、カレンダーに🧢、下にも担当', duty.length === 1 && /笠懸/.test(duty[0]) && /09:00〜・笠懸球技場/.test(duty[0]) && flag === '🧢' && mine === '🧢 あなたの担当: 笠懸', JSON.stringify({ duty, flag, mine }));
  await page.tap('#my-coaching .co-duty-item');
  await page.waitForFunction(() => document.getElementById('event-details-modal').style.display === 'flex', null, { timeout: 8000 });
  chk('「あなたの担当」を押すとその予定の詳細が開く', await page.evaluate(() => /笠懸/.test(document.getElementById('event-details-content').textContent)), '');
  await ctx.close();
}
await closeBrowser();
process.exit(summary() ? 1 : 0);
