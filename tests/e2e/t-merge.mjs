// 車両データのその場編集（座席数変更）と、他の人の車両追加・連絡削除が同時に起きたときのマージ
import { put, get, makeUser, context, chk, summary, closeBrowser, BASE, T } from './lib.mjs';

const EV = '1900000000901';
const event = { id: EV, title: 'マージ確認', date: '2026-11-08', type: 'game', target: [], venue: '尾島', startTime: '09:00' };
await put(`${T}/events/${EV}`, event);
await put(`${T}/eventData/${EV}`, {
  carRegistrations: [
    { parent: '一号車', canDrive: 'both', frontSeat: 1, middleSeat: 2, backSeat: 0, notes: '' },
    { parent: '二号車', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 0, notes: '' }
  ],
  attendance: [], assignments: [],
  notifications: [
    // 保護者が自分で書いた連絡（ほかの人の連絡は、保護者は消せない: 権限の設定の「ほかの人の連絡の削除」）
    { date: '2026-10-10', text: '古い連絡', type: 'info', user: '保護者' },
    { date: '2026-10-12', text: '残す連絡', type: 'info', user: 'x' }
  ],
  comment: '', comments: []
});
await makeUser('mergeC@example.com', '配車担当', 'coach');
await makeUser('mergeP@example.com', '保護者', 'parent');
const ctxC = await context({ email: 'mergeC@example.com', name: '配車担当', selectedEvent: event });
const ctxP = await context({ email: 'mergeP@example.com', name: '保護者', selectedEvent: event });
const pC = await ctxC.newPage(), pP = await ctxP.newPage();
pC.on('dialog', d => d.accept()); pP.on('dialog', d => d.accept());

await pC.goto(BASE + '/carpool/assignments.html?event=' + EV);
await pC.waitForFunction(() => document.querySelectorAll('.car-layout').length === 2, null, { timeout: 25000 });
await pP.goto(BASE + '/carpool/cars.html?event=' + EV);
await pP.waitForFunction(() => window.FCOjima && FCOjima.Carpool && FCOjima.Carpool._base, null, { timeout: 25000 });

// 保護者が車両を追加（配車担当の画面は古いまま）
await pP.fill('#parentName', '三号車');
await pP.click('#register-car');
await pP.evaluate(() => FCOjima.Carpool.whenSaved());
// 配車担当が一号車の中列を2→3に変更
await pC.evaluate(() => FCOjima.Carpool.Assignment.adjustCarSeat(0, 'middleSeat', 1));
await pC.evaluate(() => FCOjima.Carpool.whenSaved());

let d = await get(`${T}/eventData/${EV}`);
const regs = d.carRegistrations.map(c => c.parent + ':' + c.middleSeat);
chk('座席数変更が反映され、順序も保たれる', regs[0] === '一号車:3' && regs[1] === '二号車:3', JSON.stringify(regs));
chk('同時に追加された車両も残る', regs.length === 3 && regs[2].startsWith('三号車'), JSON.stringify(regs));

// 連絡: 保護者が「古い連絡」を削除、配車担当（古い画面）が新しい連絡を投稿 → 削除も投稿も反映
await pP.goto(BASE + '/carpool/notifications.html?event=' + EV);
await pP.waitForFunction(() => window.FCOjima && FCOjima.Carpool && FCOjima.Carpool._base, null, { timeout: 25000 });
await pC.goto(BASE + '/carpool/notifications.html?event=' + EV);
await pC.waitForFunction(() => window.FCOjima && FCOjima.Carpool && FCOjima.Carpool._base, null, { timeout: 25000 });
await pP.evaluate(() => {
  const idx = FCOjima.Carpool.appData.notifications.findIndex(n => n.text === '古い連絡');
  FCOjima.Carpool.Notifications.deleteNotification(idx);
});
await pP.evaluate(() => FCOjima.Carpool.whenSaved());
await pC.fill('#notificationText', '新しい連絡');
await pC.click('#send-notification');
await pC.evaluate(() => FCOjima.Carpool.whenSaved());
d = await get(`${T}/eventData/${EV}`);
const texts = d.notifications.map(n => n.text);
chk('他の人が削除した連絡が、古い画面からの投稿で復活しない', !texts.includes('古い連絡'), JSON.stringify(texts));
chk('新しい連絡が先頭に入り、残す連絡も残る', texts[0] === '新しい連絡' && texts.includes('残す連絡'), JSON.stringify(texts));

await closeBrowser();
process.exit(summary() ? 1 : 0);
