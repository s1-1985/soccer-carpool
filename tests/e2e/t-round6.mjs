// 6巡目: 配車管理の下部固定バーが画面からはみ出さない
import { put, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T } from './lib.mjs';
await wipe();
await put(`${T}/events/n1`, { title: 'バー確認', date: '2026-12-13', type: 'game', target: [] });
await put(`${T}/eventData/n1`, { carRegistrations: [{ parent: '父', canDrive: 'both', frontSeat: 1, middleSeat: 2, backSeat: 0 }] });
await makeUser('r6@example.com', '管理者', 'admin');
for (const device of [null, 'iPhone 13']) {
  const ctx = await context({ email: 'r6@example.com', name: '管理者', device });
  const page = await ctx.newPage();
  for (const pg of ['index', 'attendance', 'cars', 'assignments', 'notifications']) {
    await page.goto(BASE + `/carpool/${pg}.html?event=n1`);
    await page.waitForTimeout(1800);
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const nav = document.querySelector('.global-navigation');
      const btns = [...nav.querySelectorAll('button')].filter(b => getComputedStyle(b).display !== 'none').map(b => b.getBoundingClientRect());
      return { vw, navR: Math.round(nav.getBoundingClientRect().right), maxBtnR: Math.round(Math.max(...btns.map(b => b.right))) };
    });
    chk(`[${device || 'PC'}] ${pg}: 下部の固定ボタンが画面の右端で切れない`, r.navR <= r.vw && r.maxBtnR <= r.vw, JSON.stringify(r));
  }
  await ctx.close();
}
// 保護者には（読めない）操作ログのボタンを出さない。管理者には出る
await makeUser('r6p@example.com', '保護者', 'parent');
for (const [email, name, expect] of [['r6p@example.com', '保護者', false], ['r6@example.com', '管理者', true]]) {
  const ctx = await context({ email, name });
  const page = await ctx.newPage();
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  const has = await page.evaluate(() => ['view-logs', 'member-logs', 'notifications-logs', 'venues-logs'].map(id => !!document.getElementById(id)));
  chk(`${name}には「ログを表示」ボタンが${expect ? '出る' : '出ない（ログはマネージャーしか読めない）'}`, has.every(x => x === expect), JSON.stringify(has));
  await ctx.close();
}

await closeBrowser();
process.exit(summary() ? 1 : 0);
