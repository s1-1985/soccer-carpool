// 出欠マトリクスからの参加イベント移動（出欠のみをトランザクションで更新）＋配車管理の概要ページ
import { put, get, list, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors } from './lib.mjs';

const EA = '1900000001001', EB = '1900000001002';
await put(`${T}/members/m5`, { name: '五年生くん', role: 'player', grade: '5' });
await put(`${T}/events/${EA}`, { title: '高学年の試合', date: '2026-11-15', type: 'game', target: ['5'] });
await put(`${T}/events/${EB}`, { title: '低学年の試合', date: '2026-11-15', type: 'game', target: ['2'] });
await put(`${T}/eventData/${EA}`, {
  attendance: [{ name: '五年生くん', status: 'present', notes: '' }],
  carRegistrations: [{ parent: '車A', canDrive: 'both', frontSeat: 1, middleSeat: 2, backSeat: 0, notes: '' }],
  assignments: [{ carIndex: 0, driver: '車A', seats: { '助手席': { '0': '五年生くん' }, '中列': {}, '後列': {} } }],
  comment: '残すコメント', comments: [{ text: '残すコメント', author: 'x', timestamp: 1 }]
});
await makeUser('moveadmin@example.com', '移動管理者', 'admin');
const ctx = await context({ email: 'moveadmin@example.com', name: '移動管理者', device: null });
const page = await ctx.newPage();
const errs = watchErrors(page);
page.on('dialog', d => d.accept());
await page.goto(BASE + '/hub/index.html');
await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub && FCOjima.Hub.Admin, null, { timeout: 30000 });
await page.waitForTimeout(800);
await page.evaluate(async ([a, b]) => {
  const evs = FCOjima.Hub.events;
  const member = FCOjima.Hub.members.find(m => m.name === '五年生くん');
  await FCOjima.Hub.Admin.movePlayerToEvent(member, evs.find(e => String(e.id) === a), evs.find(e => String(e.id) === b));
}, [EA, EB]);
await page.waitForTimeout(1500);
const da = await get(`${T}/eventData/${EA}`);
const db = await get(`${T}/eventData/${EB}`);
const eb = await get(`${T}/events/${EB}`);
chk('移動元の出欠が不参加になる', da.attendance[0].status === 'absent', JSON.stringify(da.attendance));
chk('移動元の配車データ・コメントは消えない', da.comments.length === 1 && da.assignments.length === 1 && da.carRegistrations.length === 1);
chk('移動先の出欠が参加で追加される', db && db.attendance.some(a => a.name === '五年生くん' && a.status === 'present'), JSON.stringify(db));
chk('移動先イベントに学年外追加選手として保存される', (eb.extraPlayers || []).includes('五年生くん'), JSON.stringify(eb.extraPlayers));
const notes = await list(`${T}/notifications`);
chk('変更通知が連絡事項に投稿される', notes.some(n => n.type === 'move' && n.memberName === '五年生くん'));

// 配車管理の概要ページ（ID付きURL）
await page.goto(BASE + '/carpool/index.html?event=' + EA);
await page.waitForFunction(() => document.querySelector('#status-summary .ov-grid'), null, { timeout: 25000 });
const sum = await page.textContent('#event-summary');
chk('配車管理の概要ページがイベントIDから表示される', sum.includes('高学年の試合'), sum.trim().slice(0, 40));
const bad = errs.filter(e => !/favicon|ERR_|Failed to load resource|open-meteo|gsi|storage/i.test(e));
console.log('errors:', JSON.stringify(bad.slice(0, 5)));
chk('ページエラーなし', bad.length === 0);
await closeBrowser();
process.exit(summary() ? 1 : 0);
