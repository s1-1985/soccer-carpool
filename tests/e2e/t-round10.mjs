// 10巡目: スマホでの見切れ・コーチ（保護者兼任）
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T } from './lib.mjs';
import { detectFn, tappableFn } from './detect.mjs';
await wipe();
await put(`${T}/members/p1`, { name: '長谷川 陽菜乃', role: 'player', grade: '6' });
await put(`${T}/members/p2`, { name: '勅使河原 蒼', role: 'player', grade: '6' });
await put(`${T}/members/c2`, { name: '長谷川 美由紀', role: 'assist', childrenIds: ['p1'] });
await put(`${T}/members/c3`, { name: 'コーチだけの人', role: 'assist' });
await put(`${T}/members/f1`, { name: '武者小路 千代子', role: 'mother', childrenIds: ['p2'] });
const EV = '1900000020001';
await put(`${T}/events/${EV}`, { title: '第35回 太田市長杯争奪 少年サッカー大会（予選リーグ）', date: '2026-11-28', type: 'game', target: ['6'] });
await put(`${T}/events/1900000020002`, { title: '保護者会・親子レクリエーション', date: '2026-11-29', type: 'event', target: [] });
await put(`${T}/eventData/${EV}`, {
  attendance: [{ name: '長谷川 陽菜乃', status: 'present', notes: '' }, { name: '勅使河原 蒼', status: 'absent', notes: '体調不良のため欠席します（熱が下がらないため）' }],
  carRegistrations: [{ parent: '武者小路 千代子', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 0, notes: '' }],
  assignments: [{ carIndex: 0, driver: '武者小路 千代子', seats: { '助手席': { '0': '長谷川 陽菜乃' }, '中列': {}, '後列': {} } }]
});
await makeUser('r10@example.com', '長谷川 美由紀', 'assist');
const mob = vw => ({ viewport: { width: vw, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

// 1) HUBの見出し: ログイン中の名前が切れずに出る（320px）
{
  const ctx = await context({ email: 'r10@example.com', name: '長谷川 美由紀', device: mob(320) });
  const page = await ctx.newPage();
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  const h = await page.evaluate(() => { const t = document.querySelector('header h1'), n = document.getElementById('header-user-name'); return { name: n && n.textContent, titleCut: t.scrollWidth > t.clientWidth, nameCut: n && n.scrollWidth > n.clientWidth }; });
  chk('スマホ（320px）でもHUBの見出しとログイン中の名前が切れずに出る', h.name === '長谷川 美由紀' && !h.titleCut && !h.nameCut, JSON.stringify(h));

  // 2) コーチ（保護者兼任）: 子供を紐づけられ、その子の予定が参加予定に出る
  await page.evaluate(() => FCOjima.Hub.Members.openAddMemberModal('c2'));
  await page.waitForTimeout(400);
  const cg = await page.evaluate(() => { const g = document.getElementById('children-group'); return { shown: g.style.display !== 'none', checked: [...g.querySelectorAll('input:checked')].map(i => i.value) }; });
  chk('コーチのメンバー編集で子供の欄が出て、紐づけた子供が選ばれている', cg.shown && cg.checked.includes('p1'), JSON.stringify(cg));
  await page.evaluate(() => FCOjima.UI.closeModal('member-modal'));
  await page.evaluate(() => document.getElementById('my-events-tab').click());
  await page.waitForTimeout(1200);
  const me = await page.evaluate(() => ({ tab: document.getElementById('my-events-tab').style.display, list: document.getElementById('my-events-list').textContent }));
  chk('保護者を兼ねるコーチにも参加予定タブが出て、子供の予定が載る', me.tab !== 'none' && /太田市長杯/.test(me.list), JSON.stringify(me).slice(0, 120));
  // 「イベント」種別の予定の出欠確認に、保護者を兼ねるコーチは出るが、コーチだけの人は出ない
  await page.evaluate(() => FCOjima.Hub.Calendar.showEventDetails('1900000020002'));
  await page.waitForFunction(() => /出欠確認/.test(document.getElementById('event-details-content').textContent), null, { timeout: 15000 });
  const det = await page.evaluate(() => document.getElementById('event-details-content').textContent);
  chk('「イベント」の出欠確認に、保護者を兼ねるコーチは出て、コーチだけの人は出ない', /長谷川 美由紀/.test(det) && !/コーチだけの人/.test(det), (det.match(/出欠確認.{0,120}/) || [''])[0]);
  await ctx.close();
}

// 3) 配車管理: スクロールしても上のタブが見出しの裏に隠れない／出欠表の備考が横幅いっぱい／見切れなし
for (const vw of [320, 390]) {
  const ctx = await context({ email: 'r10@example.com', name: '長谷川 美由紀', device: mob(vw) });
  const page = await ctx.newPage();
  await page.goto(BASE + '/carpool/attendance.html?event=' + EV);
  await page.waitForFunction(() => document.querySelectorAll('.attendance-select').length > 0, null, { timeout: 25000 });
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(300);
  const nav = await page.evaluate(() => {
    const a = document.querySelector('.carpool-nav a'); const r = a.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const links = [...document.querySelectorAll('.carpool-nav a')].map(x => Math.round(x.getBoundingClientRect().top));
    return { visible: hit === a || a.contains(hit), oneRow: new Set(links).size === 1 };
  });
  chk(`[${vw}px] 配車管理でスクロールしても上のタブが押せる（見出しの裏に隠れない）・タブは1行`, nav.visible && nav.oneRow, JSON.stringify(nav));
  const notes = await page.evaluate(() => { const i = [...document.querySelectorAll('.attendance-notes')].find(x => x.value.startsWith('体調不良')); return Math.round(i.getBoundingClientRect().width); });
  chk(`[${vw}px] 出欠表の備考の欄が横幅いっぱい（書かれた備考が読める）`, notes >= vw - 80, String(notes));
  const issues = (await page.evaluate(detectFn)).filter(x => x.k !== 'ellipsis').concat(await page.evaluate(tappableFn, null));
  chk(`[${vw}px] 出欠ページに見切れ・押せないボタンがない`, issues.length === 0, JSON.stringify(issues.slice(0, 3)));
  for (const pg of ['cars.html', 'assignments.html', 'index.html', 'notifications.html']) {
    await page.goto(BASE + '/carpool/' + pg + '?event=' + EV);
    await page.waitForFunction(() => window.FCOjima && FCOjima.Carpool && FCOjima.Carpool._base, null, { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const is2 = (await page.evaluate(detectFn)).filter(x => x.k !== 'ellipsis' && !(x.k === 'button-text-overflow' && /open-comment-btn/.test(x.el))).concat(await page.evaluate(tappableFn, null));
    chk(`[${vw}px] ${pg} に見切れ・押せないボタンがない`, is2.length === 0, JSON.stringify(is2.slice(0, 3)));
  }
  // 座席の × が名前の上に重ならない
  await page.goto(BASE + '/carpool/assignments.html?event=' + EV);
  await page.waitForFunction(() => document.querySelector('.seat.filled .seat-clear-btn'), null, { timeout: 25000 });
  const ov = await page.evaluate(() => [...document.querySelectorAll('.seat.filled')].some(s => {
    const x = s.querySelector('.seat-clear-btn').getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(s.querySelector('.seat-name-tag'));
    // 角がわずかに触れる程度（数px²）は許容し、文字に重なる面積で判定する
    return [...range.getClientRects()].some(n => Math.max(0, Math.min(x.right, n.right) - Math.max(x.left, n.left)) * Math.max(0, Math.min(x.bottom, n.bottom) - Math.max(x.top, n.top)) > 6);
  }));
  chk(`[${vw}px] 座席の × が名前の上に重ならない`, !ov, String(ov));
  const btns = await page.evaluate(() => [...document.querySelectorAll('.assignment-action-buttons button')].map(b => ({ t: b.textContent.trim(), lines: Math.round(b.getBoundingClientRect().height) })));
  chk(`[${vw}px] 割り当ての操作ボタンの文字が途中で折り返さない`, btns.every(b => b.lines < 48), JSON.stringify(btns));
  await ctx.close();
}
await closeBrowser();
process.exit(summary() ? 1 : 0);
