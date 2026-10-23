// スマホ2列表示で座席が縮まない（名前が縦書きにならない）ことを確認
import { put, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors } from './lib.mjs';

const EV = '1900000000501';
const names = ['山田太郎', '佐藤花子', '鈴木一郎', '高橋次郎', '田中三郎', '伊藤四郎', '渡辺五郎', '中村六郎'];
for (let i = 0; i < names.length; i++) {
  await put(`${T}/members/s${i}`, { name: names[i], abbr: names[i], role: 'player', grade: '3', gender: 'male' });
}
await put(`${T}/members/d1`, { name: '曽根父', role: 'father' });
await put(`${T}/members/d2`, { name: '高阪母', role: 'mother' });
const event = { id: EV, title: '座席幅確認', date: '2026-10-25', type: 'game', target: ['3'], venue: '尾島グラウンド', startTime: '09:00' };
await put(`${T}/events/${EV}`, event);
await put(`${T}/eventData/${EV}`, {
  carRegistrations: [
    { parent: '曽根父', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 0, notes: '' },
    { parent: '高阪母', canDrive: 'both', frontSeat: 1, middleSeat: 2, backSeat: 3, notes: '' }
  ],
  attendance: names.map(n => ({ name: n, status: 'present', notes: '' })),
  assignments: [
    { carIndex: 0, driver: '曽根父', seats: { '助手席': { '0': names[0] }, '中列': { '0': names[1], '1': names[2], '2': names[3] }, '後列': {} } },
    { carIndex: 1, driver: '高阪母', seats: { '助手席': {}, '中列': { '0': names[4] }, '後列': { '0': names[5], '1': names[6], '2': names[7] } } }
  ]
});

const email = 'seat-mobile@example.com';
await makeUser(email, '座席確認', 'admin');
const ctx = await context({ email, name: '座席確認', selectedEvent: event });
const page = await ctx.newPage();
const errs = watchErrors(page);
await page.goto(BASE + '/carpool/assignments.html?event=' + EV);
await page.waitForFunction(() => document.querySelectorAll('.car-top-view').length >= 2, null, { timeout: 25000 });
await page.waitForTimeout(800);

const m = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.car-top-view').forEach((cv, ci) => {
    const r = cv.getBoundingClientRect();
    cv.querySelectorAll('.seat-row').forEach((row, ri) => {
      const seats = [...row.querySelectorAll('.seat, .seat-spacer')];
      out.push({ ci, ri, carL: Math.round(r.left), carR: Math.round(r.right),
        widths: seats.map(s => Math.round(s.getBoundingClientRect().width)),
        lefts: seats.map(s => Math.round(s.getBoundingClientRect().left)),
        rights: seats.map(s => Math.round(s.getBoundingClientRect().right)) });
    });
  });
  const tags = [...document.querySelectorAll('.seat-name-tag')].map(t => {
    const r = t.getBoundingClientRect();
    return { text: t.textContent, w: Math.round(r.width), h: Math.round(r.height) };
  });
  return { rows: out, tags };
});
console.log(JSON.stringify(m.rows));
const minW = Math.min(...m.rows.flatMap(r => r.widths));
chk('スマホ2列表示で座席が40px未満に縮まない', minW >= 39, 'min width=' + minW);
const overflow = m.rows.filter(r => Math.min(...r.lefts) < r.carL - 1 || Math.max(...r.rights) > r.carR + 1);
chk('座席が車体の外にはみ出さない', overflow.length === 0, JSON.stringify(overflow));
await page.screenshot({ path: 'seat-mobile.png' });
console.log('errors:', JSON.stringify(errs.slice(0, 5)));
await ctx.close();
await closeBrowser();
process.exit(summary() ? 1 : 0);
