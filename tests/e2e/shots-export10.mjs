// 観察用: 配車の画像出力（html2canvas）の結果を保存する  使い方: node shots-export.mjs 出力先.png
import fs from 'fs';
import { put, wipe, makeUser, context, closeBrowser, BASE, T } from './lib.mjs';
await wipe();
const D1 = new Date(Date.now() + 9 * 3600e3 + 86400e3).toISOString().slice(0, 10);
for (const [id, n] of [['p1', '曽根 逞生'], ['p2', 'たくみ'], ['p3', '高橋 凛']]) await put(`${T}/members/${id}`, { name: n, role: 'player', grade: '3' });
const E = '1900000950001';
await put(`${T}/events/${E}`, { title: 'ああああ', date: D1, type: 'game', target: ['3'] });
await put(`${T}/eventData/${E}`, {
  attendance: [{ name: '曽根 逞生', status: 'present', notes: '' }, { name: 'たくみ', status: 'present', notes: '' }],
  carRegistrations: [
    { parent: '曽根父', canDrive: 'both', frontSeat: 1, middleSeat: 2, backSeat: 3, notes: '', extraPassengers: [] },
    { parent: '曽根 靖弘', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 0, notes: '', extraPassengers: [] },
    { parent: '田口', canDrive: 'both', frontSeat: 1, middleSeat: 2, backSeat: 3, notes: '', extraPassengers: [] },
    { parent: '古屋', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 3, notes: '', extraPassengers: [] },
    { parent: '高橋', canDrive: 'both', frontSeat: 1, middleSeat: 2, backSeat: 0, notes: '', extraPassengers: [] },
    { parent: '佐藤', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 3, notes: '', extraPassengers: [] },
    { parent: '鈴木', canDrive: 'both', frontSeat: 1, middleSeat: 2, backSeat: 3, notes: '', extraPassengers: [] },
    { parent: '田中', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 0, notes: '', extraPassengers: [] },
    { parent: '伊藤', canDrive: 'both', frontSeat: 1, middleSeat: 2, backSeat: 3, notes: '', extraPassengers: [] },
    { parent: '山本', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 3, notes: '', extraPassengers: [] }
  ],
  assignments: [{ carIndex: 0, driver: '曽根父', seats: { '助手席': {}, '中列': {}, '後列': { 2: 'たくみ' } } }]
});
await makeUser('admin@example.com', '管理者', 'admin');
const ctx = await context({ email: 'admin@example.com', name: '管理者', device: null });
const page = await ctx.newPage();
await page.goto(BASE + '/carpool/assignments.html?event=' + E);
await page.waitForSelector('.car-top-view .car-art', { timeout: 25000 });
await page.waitForTimeout(1000);
await page.evaluate(() => { window.__blob = null; FCOjima.Carpool.Assignment._downloadImage = (b) => { window.__blob = b; }; });
await page.evaluate(() => FCOjima.Carpool.Assignment.exportAssignmentsAsImage());
await page.waitForFunction(() => window.__blob, null, { timeout: 30000 });
const b64 = await page.evaluate(() => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(window.__blob); }));
fs.writeFileSync(process.argv[2] || 'export.png', Buffer.from(b64, 'base64'));
await closeBrowser();
