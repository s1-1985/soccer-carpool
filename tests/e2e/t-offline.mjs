// 通信エラー時の挙動: 空白画面にならない／古い端末データで他の人の変更を上書きしない／保存失敗を知らせる
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T } from './lib.mjs';
await wipe();
await put(`${T}/events/ev1`, { title: '最新タイトル', date: '2026-11-01', type: 'practice', target: [] });
await makeUser('offadmin@example.com', '管理者', 'admin');

// 1) 承認確認の読み込みに失敗 → 空白ではなくエラー表示
{
  const ctx = await context({ email: 'offadmin@example.com', name: '管理者', device: null });
  const page = await ctx.newPage();
  // Firestore への通信だけを遮断（Authは通す）
  await page.route('http://127.0.0.1:8080/**', r => r.abort('internetdisconnected'));
  await page.goto(BASE + '/hub/index.html');
  await page.waitForTimeout(12000);
  const txt = await page.evaluate(() => document.body.innerText);
  chk('承認確認を読み込めないとき、空白ではなくエラーと再読み込みの案内を表示する', /読み込めませんでした|通信/.test(txt), txt.slice(0, 120).replace(/\s+/g, ' '));
  await ctx.close();
}

// 2) 端末に古いイベント一覧が残っている状態で、サーバーから読めなかったとき
{
  const ctx = await context({ email: 'offadmin@example.com', name: '管理者', device: null });
  const page = await ctx.newPage();
  // 古い一覧を端末に仕込む（以前開いたときの内容）
  await page.addInitScript(() => {
    localStorage.setItem('fcojima_events', JSON.stringify([{ id: 'ev1', title: '古いタイトル', date: '2026-11-01', type: 'practice', target: [] }]));
  });
  // サーバーからの一括読み込み（loadAllData）を1回だけ通信エラーにする（プロフィールの読み込みは通す）。
  // 以前は Firestore への通信をプロフィール読み込み後に遮断していたが、遮断より先に一括読み込みが
  // 終わることがあり、結果が実行ごとに変わっていた
  await page.route('**/js/common/db.js*', async r => {
    const resp = await r.fetch();
    const body = await resp.text();
    await r.fulfill({ response: resp, body: body + '\n;(function(){var o=FCOjima.DB.loadAllData,n=0;FCOjima.DB.loadAllData=function(){if(n++===0){var e=new Error("サーバーに接続できません（オフライン）");e.code="unavailable";return Promise.reject(e);}return o.apply(this,arguments);};})();' });
  });
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Auth && FCOjima.Auth.currentUserProfile, null, { timeout: 30000 });
  await page.waitForFunction(() => FCOjima.Hub && FCOjima.Hub.Calendar && document.querySelector('#calendar-grid .calendar-day'), null, { timeout: 40000 });
  await page.waitForTimeout(1500);
  const shownWarn = await page.evaluate(() => (document.querySelector('.toast-notification') || {}).textContent || '');
  chk('サーバーから読めず端末の古いデータを表示しているときは知らせる', /古い|読み込めません|オフライン/.test(shownWarn), shownWarn);
  // 通信が戻った状態で、ユーザーが新しいイベントを追加する
  await page.evaluate(() => {
    FCOjima.Hub.Calendar.openAddEventModal(new Date(2026, 10, 5));
    document.getElementById('event-title').value = '新しいイベント';
    FCOjima.Hub.Calendar.saveEvent();
  });
  await page.waitForTimeout(3000);
  const ev1 = await get(`${T}/events/ev1`);
  chk('古い端末データのまま保存しても、他のイベントを古い内容で上書きしない', ev1 && ev1.title === '最新タイトル', ev1 && ev1.title);
  const toast = await page.evaluate(() => (document.querySelector('.toast-notification') || {}).textContent || '');
  console.log('toast after save:', toast);
  await ctx.close();
}
await closeBrowser();
process.exit(summary() ? 1 : 0);
