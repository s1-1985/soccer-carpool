// スマホ幅（iPhone 13 / 360px Android）で各画面に横はみ出しがないか
import { put, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors } from './lib.mjs';

const EV = '1900000003001';
const event = { id: EV, title: '横はみ出し確認用のとても長いイベント名ですよ', date: '2026-11-22', type: 'game', target: ['3'], venue: '群馬県太田市の長い名前の運動公園サッカー場', meetingPlace: '尾島小学校', startTime: '09:00', endTime: '15:00', departureTime: '08:00', notes: '備考'.repeat(30) };
await put(`${T}/events/${EV}`, event);
for (let i = 0; i < 6; i++) await put(`${T}/members/ov${i}`, { name: '長い名前の選手' + i, role: 'player', grade: '3', birth: '2017-06-0' + (i + 1) });
await put(`${T}/members/ovp`, { name: '長い名前の保護者さん', role: 'father', childrenIds: ['ov0'] });
await put(`${T}/eventData/${EV}`, {
  carRegistrations: [{ parent: '長い名前の保護者さん', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 3, notes: 'チャイルドシートあり'.repeat(3) }],
  attendance: [0, 1, 2, 3, 4, 5].map(i => ({ name: '長い名前の選手' + i, status: i % 2 ? 'present' : 'unknown', notes: '' })),
  notifications: [{ date: '2026-10-16', text: '連絡'.repeat(80), type: 'info', user: '配車担当' }]
});
await makeUser('overflow@example.com', '横幅確認', 'admin', { childrenIds: ['ov0'] });

for (const device of ['iPhone 13', 'Galaxy S9+']) {
  const ctx = await context({ email: 'overflow@example.com', name: '横幅確認', device, selectedEvent: event });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  const check = async (label) => {
    const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    chk(`[${device}] ${label} に横はみ出しがない`, r.sw <= r.cw + 1, JSON.stringify(r));
  };
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  for (const tab of ['calendar', 'my-events', 'notifications', 'members', 'venues', 'admin']) {
    await page.evaluate((t) => { const b = document.querySelector(`.tablinks[onclick*="'${t}'"]`); if (b) b.click(); }, tab);
    await page.waitForTimeout(400);
    await check('HUB ' + tab + 'タブ');
  }
  await page.evaluate((id) => FCOjima.Hub.Calendar.showEventDetails(id), EV);
  await page.waitForTimeout(600);
  await check('HUB イベント詳細モーダル');
  await page.evaluate(() => FCOjima.UI.closeModal('event-details-modal'));
  for (const p of ['index.html', 'attendance.html', 'cars.html', 'assignments.html', 'notifications.html']) {
    await page.goto(BASE + '/carpool/' + p + '?event=' + EV);
    await page.waitForFunction(() => window.FCOjima && FCOjima.Carpool && FCOjima.Carpool._base, null, { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(700);
    await check('配車 ' + p);
    if (device === 'Galaxy S9+') await page.screenshot({ path: 'ov-' + p.replace('.html', '') + '.png' });
  }
  const bad = errs.filter(e => !/favicon|ERR_|Failed to load resource|open-meteo|gsi|storage/i.test(e));
  chk(`[${device}] ページエラーなし`, bad.length === 0, JSON.stringify(bad.slice(0, 3)));
  await ctx.close();
}
await closeBrowser();
process.exit(summary() ? 1 : 0);
