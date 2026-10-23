// 8巡目: 通信が不安定なときに端末の古い配車データでサーバーを上書きしない など
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T } from './lib.mjs';
await wipe();
await put(`${T}/members/p1`, { name: '選手いち', role: 'player', grade: '3' });
await put(`${T}/events/ev8`, { title: '最新の試合', date: '2026-11-20', type: 'game', target: ['3'] });
// サーバー上の最新（他の人がその後に変更した内容）
await put(`${T}/eventData/ev8`, {
  attendance: [{ name: '選手いち', status: 'present', notes: '' }],
  carRegistrations: [{ parent: '新しい運転手', seats: 4, frontSeat: true, middleSeat: 0, backSeat: 3, notes: '' }],
  assignments: [{ driver: '新しい運転手', seats: { front: ['選手いち'], middle: [], back: [] } }]
});
await makeUser('r8@example.com', '保護者', 'parent');

// 1) 座席割り当ての画面を開いたとき、サーバーからの読み込みが失敗（電波が悪い等）しても、
//    端末に残っていた古い配車データをサーバーに書き戻さない
{
  const ctx = await context({ email: 'r8@example.com', name: '保護者' });
  const page = await ctx.newPage();
  // 以前この端末で開いたときの古い内容
  await page.addInitScript(() => {
    localStorage.setItem('fcojima_event_ev8', JSON.stringify({
      attendance: [{ name: '選手いち', status: 'absent', notes: '' }],
      carRegistrations: [{ parent: '古い運転手', seats: 3, frontSeat: true, middleSeat: 0, backSeat: 2, notes: '' }],
      assignments: [], notifications: []
    }));
  });
  // 最初のイベントデータの読み込みだけ失敗させる（通信が一時的に途切れた状態）
  await page.route('**/js/common/db.js*', async r => {
    const resp = await r.fetch();
    const body = await resp.text();
    await r.fulfill({ response: resp, body: body + '\n;(function(){var o=FCOjima.DB.loadEventData,n=0;FCOjima.DB.loadEventData=function(){if(n++===0){var e=new Error("Failed to get document because the client is offline.");e.code="unavailable";return Promise.reject(e);}return o.apply(this,arguments);};})();' });
  });
  await page.goto(BASE + '/carpool/assignments.html?event=ev8');
  await page.waitForFunction(() => document.querySelector('#assignment-event-info strong'), null, { timeout: 25000 });
  await page.waitForTimeout(3000);
  const d = await get(`${T}/eventData/ev8`);
  const parents = (d.carRegistrations || []).map(c => c.parent);
  const att = (d.attendance || []).find(a => a.name === '選手いち');
  chk('読み込みに失敗しても、端末の古い配車データでサーバーの車の登録を上書きしない', parents.length === 1 && parents[0] === '新しい運転手', JSON.stringify(parents));
  chk('読み込みに失敗しても、端末の古い出欠でサーバーの出欠を上書きしない', att && att.status === 'present', JSON.stringify(att));
  await ctx.close();
}

// 2) 概要タブの「割り当て」: 荷物・不参加の人・削除した車の乗員を割り当て済みに数えない
await put(`${T}/members/pa`, { name: '選手エー', role: 'player', grade: '3' });
await put(`${T}/members/pb`, { name: '選手ビー', role: 'player', grade: '3' });
await put(`${T}/members/pc`, { name: '選手シー', role: 'player', grade: '3' });
await put(`${T}/members/pd`, { name: '選手ディー', role: 'player', grade: '3' });
await put(`${T}/events/ev9`, { title: '割り当て確認', date: '2026-11-21', type: 'game', target: ['3'] });
await put(`${T}/eventData/ev9`, {
  attendance: [
    { name: '選手エー', status: 'present', notes: '' }, { name: '選手ビー', status: 'present', notes: '' },
    { name: '選手シー', status: 'present', notes: '' }, { name: '選手ディー', status: 'absent', notes: '' }
  ],
  carRegistrations: [{ parent: '運転手いち', canDrive: 'both', frontSeat: 1, middleSeat: 3, backSeat: 0, notes: '', extraPassengers: [{ name: '弟くん' }] }],
  assignments: [
    { carIndex: 0, driver: '運転手いち', seats: { '助手席': { '0': '選手エー' }, '中列': { '0': '荷物', '1': '選手ディー', '2': '弟くん' }, '後列': {} } },
    { carIndex: 1, driver: '消えた運転手', seats: { '助手席': {}, '中列': { '0': '選手ビー' }, '後列': {} } }
  ]
});
{
  const ctx = await context({ email: 'r8@example.com', name: '保護者', device: null });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  await page.goto(BASE + '/carpool/index.html?event=ev9');
  await page.waitForFunction(() => document.querySelector('.ov-card[href="assignments.html"] .ov-main'), null, { timeout: 25000 });
  const card = await page.evaluate(() => { const c = document.querySelector('.ov-card[href="assignments.html"]'); return { t: c.querySelector('.ov-main').textContent, ok: c.classList.contains('ok') }; });
  chk('概要の「割り当て」は、参加の選手のうち今ある車に割り当て済みの人だけ数える（荷物・不参加・削除した車の分は数えない）', card.t === '1/3' && !card.ok, JSON.stringify(card));

  // 3) 割り当てページ: 不参加になった人の印・注意書き、共有文は表示中の車から作る
  await page.goto(BASE + '/carpool/assignments.html?event=ev9');
  await page.waitForFunction(() => document.querySelectorAll('.car-layout').length > 0, null, { timeout: 25000 });
  await page.waitForTimeout(800);
  const st = await page.evaluate(() => {
    const seat = [...document.querySelectorAll('.seat[data-person]')].find(s => s.dataset.person === '選手ディー');
    const w = document.getElementById('seat-absent-warning');
    return { marked: !!(seat && seat.classList.contains('seat-absent')), warn: w && w.offsetParent ? w.textContent : '' };
  });
  chk('割り当てた後に「不参加」になった人の座席に印が付き、上部に注意書きが出る', st.marked && /選手ディー/.test(st.warn), JSON.stringify(st));
  await page.evaluate(() => { window.__shared = null; FCOjima.Utils.copyToClipboard = t => { window.__shared = t; return true; }; });
  await page.click('#share-button-nav');
  const shared = await page.evaluate(() => window.__shared || '');
  chk('共有する割り当てに、削除した車（の古い割り当て）が載らない', shared && !/消えた運転手/.test(shared), shared.slice(0, 160).replace(/\n/g, ' / '));
  chk('共有する割り当てで、不参加になった人には（不参加）と添える', /選手ディー（不参加）/.test(shared), '');
  chk('共有する割り当ての座席は 助手席→中列 の順', shared.indexOf('助手席') >= 0 && shared.indexOf('助手席') < shared.indexOf('中列'), '');
  await page.click('#seat-absent-warning .seat-absent-clear-btn');
  await page.evaluate(() => FCOjima.Carpool.whenSaved());
  await page.waitForTimeout(500);
  const d9 = await get(`${T}/eventData/ev9`);
  const seatsJson = JSON.stringify(d9.assignments || []);
  const warnHidden = await page.evaluate(() => { const w = document.getElementById('seat-absent-warning'); return !w || !w.offsetParent; });
  chk('「座席から外す」で不参加の人だけ座席から外れて保存される', !/選手ディー/.test(seatsJson) && /選手エー/.test(seatsJson) && /荷物/.test(seatsJson) && warnHidden, seatsJson.slice(0, 200));
  await ctx.close();
}

await closeBrowser();
process.exit(summary() ? 1 : 0);
