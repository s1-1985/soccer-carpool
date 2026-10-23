// 11巡目: 予定の日付に仕込んだHTML（指導者の画面）・削除したメンバーが担当のままに見える・名前を直すとログインの名前と食い違う・その日の予定の文言
import { put, get, del, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, FS, fv, watchErrors } from './lib.mjs';
await wipe();
const jst = new Date(Date.now() + 9 * 3600e3);
const iso = d => d.toISOString().slice(0, 10);
const plus = n => { const x = new Date(jst); x.setUTCDate(x.getUTCDate() + n); return iso(x); };
const TODAY = plus(0);
// 次の土曜・日曜（今日が土日なら来週）
const sat = new Date(jst); sat.setUTCDate(sat.getUTCDate() + ((6 - sat.getUTCDay() + 7) % 7 || 7));
const SAT = iso(sat);
const sunD = new Date(sat); sunD.setUTCDate(sunD.getUTCDate() + 1);
const SUN = iso(sunD);

await put(`${T}/members/c1`, { name: '佐藤 監督', role: 'coach', abbr: '佐藤' });
await put(`${T}/members/c2`, { name: '鈴木 コーチ', role: 'assist', abbr: '鈴木' });
await put(`${T}/members/p1`, { name: '一年 太郎', role: 'player', grade: '1' });
await put(`${T}/members/f1`, { name: '一年 母', role: 'mother', childrenIds: ['p1'] });
const kantokuUid = await makeUser('r11kantoku@example.com', '佐藤 監督', 'coach');
const suzukiUid = await makeUser('r11suzuki@example.com', '鈴木 コーチ', 'assist');
const momUid = await makeUser('r11mom@example.com', '一年 母', 'parent', { childrenIds: ['p1'] });

async function tokenFor(email, name) {
  return (await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=k', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postBody: 'id_token=' + encodeURIComponent(JSON.stringify({ sub: 'sub-' + email, email, email_verified: true, name })) + '&providerId=google.com', requestUri: 'http://127.0.0.1', returnSecureToken: true }) }).then(r => r.json()));
}
async function putAs(tok, path, data) {
  const r = await fetch(`${FS}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, fv(v)])) }) });
  return r.ok;
}

// 1) 承認済みの保護者が、アプリを通さずに日付へHTMLを仕込んだ予定を作る（予定は承認済みなら誰でも書ける）
const mtok = await tokenFor('r11mom@example.com', '一年 母');
const BAD = TODAY + `"><img src=x onerror="(window.__xss=window.__xss||[]).push(1)">`;
const wrote = await putAs(mtok.idToken, `${T}/events/1900000110001`, { title: '日付に細工', date: BAD, type: 'game', target: ['1'] });
chk('（前提）保護者は予定を書き込める', wrote, '');
// 2) 担当の指導者がメンバーから削除された予定（日曜）
await put(`${T}/events/1900000110002`, { title: '日曜の試合', date: SUN, type: 'game', target: ['1'], startTime: '09:00' });
await put(`${T}/coachAssignments/1900000110002`, { memberIds: ['c9'] }); // c9 はメンバーにいない（削除済み）
await put(`${T}/events/1900000110003`, { title: '土曜の練習', date: SAT, type: 'practice', target: ['1'], startTime: '09:00' });
await put(`${T}/coachAssignments/1900000110003`, { memberIds: ['c2'] });
// 3) 対象学年でない予定（その日の予定の一覧で「わが子だけ」に隠れる）
await put(`${T}/events/1900000110004`, { title: '5年の練習', date: SAT, type: 'practice', target: ['5'] });
await put(`${T}/coachAssignments/1900000110004`, { memberIds: ['c2'] });

const hubReady = async (page) => {
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
};

// 監督（指導者・マネージャー）
{
  const ctx = await context({ email: 'r11kantoku@example.com', name: '佐藤 監督', device: null });
  const page = await ctx.newPage();
  const errs = watchErrors(page);
  page.on('dialog', d => d.accept());
  await hubReady(page);
  await page.click('#my-events-tab');
  await page.waitForSelector('#my-coaching .co-cal-day', { timeout: 10000 });
  await page.waitForTimeout(500);
  const mine = await page.evaluate(() => ({
    xss: window.__xss || [],
    imgs: document.querySelectorAll('#my-coaching img').length,
    dates: FCOjima.Hub.Coaching.planDates().filter(d => !/^\d{4}-\d{2}-\d{2}$/.test(d)),
    sel: FCOjima.Hub.Coaching._mineSel
  }));
  chk('コーチの「指導の予定」で、予定の日付に仕込んだHTMLが動かない', mine.xss.length === 0 && mine.imgs === 0, JSON.stringify(mine));
  chk('日付として正しくない予定は都合を聞く日に入らない', mine.dates.length === 0 && /^\d{4}-\d{2}-\d{2}$/.test(mine.sel || ''), JSON.stringify(mine));

  await page.click('#admin-tab');
  await page.evaluate(() => FCOjima.Hub.Coaching.openPlanner());
  await page.waitForSelector('#coach-planner-modal .co-cal-day', { timeout: 10000 });
  await page.waitForTimeout(500);
  const plan = await page.evaluate(() => ({
    xss: window.__xss || [],
    imgs: document.querySelectorAll('#coach-planner-modal img').length,
    sel: FCOjima.Hub.Coaching._planSel
  }));
  chk('監督の「指導者の予定・担当」で、予定の日付に仕込んだHTMLが動かない', plan.xss.length === 0 && plan.imgs === 0 && /^\d{4}-\d{2}-\d{2}$/.test(plan.sel || ''), JSON.stringify(plan));

  // 担当の指導者がメンバーから削除された予定は「担当なし」（⚠）。以前はカレンダーで ✓ になっていた
  await page.evaluate(d => { FCOjima.Hub.Coaching._planMonth = d.slice(0, 7); FCOjima.Hub.Coaching._planSel = d; FCOjima.Hub.Coaching.renderPlanner(); }, SUN);
  await page.waitForSelector(`#coach-planner-modal .co-cal-day[data-date="${SUN}"]`, { timeout: 5000 });
  const st = await page.evaluate(({ SUN, SAT }) => {
    const cell = d => { const c = document.querySelector(`#coach-planner-modal .co-cal-day[data-date="${d}"] .co-cal-st`); return c ? c.textContent : ''; };
    return {
      sun: cell(SUN), sat: SAT.slice(0, 7) === SUN.slice(0, 7) ? cell(SAT) : '✓',
      empty: !!document.querySelector('#coach-planner-modal .co-pev.is-empty'),
      tag: (document.querySelector('#coach-planner-modal .co-cal-nav .co-tag-warn') || {}).textContent || ''
    };
  }, { SUN, SAT });
  chk('担当の指導者が削除された予定は、カレンダーでも ⚠（担当なし）。見出しの「担当なし」にも数える', st.sun === '⚠' && st.empty && /担当なし [1-9]/.test(st.tag) && st.sat === '✓', JSON.stringify(st));
  await page.evaluate(() => document.getElementById('coach-planner-modal')._close());

  // 名前を直す: 鈴木 コーチ → 鈴木 浩二、一年 母 → 一年 花子（ログインの名前も合わせる）
  await page.evaluate(() => { document.querySelector('.tablinks[onclick*="members"]').click(); FCOjima.Hub.Members.openAddMemberModal('c2'); });
  await page.fill('#member-name', '鈴木 浩二');
  await page.click('#member-form button[type="submit"]');
  await page.waitForTimeout(1500);
  await page.evaluate(() => FCOjima.Hub.Members.openAddMemberModal('f1'));
  await page.fill('#member-name', '一年 花子');
  await page.click('#member-form button[type="submit"]');
  await page.waitForTimeout(3000);
  const su = await get(`${T}/users/${suzukiUid}`);
  const mo = await get(`${T}/users/${momUid}`);
  chk('メンバーの名前を直すと、その人のログインの名前も同じに変わる（コーチ・保護者）', su.name === '鈴木 浩二' && mo.name === '一年 花子' && su.role === 'assist' && su.status === 'approved', JSON.stringify([su.name, mo.name, su.role]));

  // 自分の名前を直したとき（自分のログインの名前は自分では変えられない）は知らせる
  const alerts = [];
  await page.exposeFunction('__alert', t => alerts.push(t));
  await page.evaluate(() => { const o = FCOjima.UI.showAlert; FCOjima.UI.showAlert = function(m) { window.__alert(String(m)); return o.apply(this, arguments); }; });
  await page.evaluate(() => FCOjima.Hub.Members.openAddMemberModal('c1'));
  await page.fill('#member-name', '佐藤 健');
  await page.click('#member-form button[type="submit"]');
  await page.waitForTimeout(3000);
  const ka = await get(`${T}/users/${kantokuUid}`);
  chk('自分の名前を直したときは、ログインの名前は変わらない旨を知らせる', ka.name === '佐藤 監督' && alerts.some(t => /ログインの名前/.test(t)), JSON.stringify([ka.name, alerts]));
  const real = errs.filter(e => !/favicon|ERR_|Failed to load resource|open-meteo|gsi|storage/i.test(e));
  chk('監督の画面でページエラーなし', real.length === 0, real.join(' | '));
  await ctx.close();
}

// 名前を直されたコーチ: 指導の予定がそのまま使える（以前は「名前が違う」の案内になり回答できなかった）
{
  const ctx = await context({ email: 'r11suzuki@example.com', name: '鈴木 コーチ', device: null });
  const page = await ctx.newPage();
  await hubReady(page);
  await page.click('#my-events-tab');
  await page.waitForSelector('#my-coaching .co-my', { timeout: 10000 });
  await page.waitForTimeout(800);
  const v = await page.evaluate(() => ({
    me: (FCOjima.Hub.Coaching.myCoach(FCOjima.Auth.currentUserProfile) || {}).id || null,
    cal: document.querySelectorAll('#my-coaching .co-cal-day.is-asked').length,
    duty: (document.querySelector('#my-coaching .co-duty') || {}).textContent || ''
  }));
  chk('名前を直されたコーチも「指導の予定」で回答でき、担当も出る', v.me === 'c2' && v.cal > 0 && /土曜の練習/.test(v.duty), JSON.stringify(v));
  // 未回答の日に「＋ メモ」を押して、何も書かずに OK → 回答は未回答のまま（以前は「△ 時間による」になった）
  await page.evaluate(d => { const C = FCOjima.Hub.Coaching; C._mineMonth = d.slice(0, 7); C._mineSel = d; return C.renderMine(document.getElementById('my-coaching'), C.myCoach(FCOjima.Auth.currentUserProfile)); }, SUN);
  await page.waitForSelector(`#my-coaching .co-daypanel[data-date="${SUN}"]`, { timeout: 5000 });
  page.once('dialog', d => d.accept(''));
  await page.click('#my-coaching .co-memo');
  await page.waitForTimeout(800);
  await page.evaluate(() => FCOjima.Hub.Coaching.whenSaved());
  const memo = await page.evaluate(d => ({ a: FCOjima.Hub.Coaching.answerOf('c2', d), state: document.querySelector('#my-coaching .co-dp-state').textContent }), SUN);
  const saved = await get(`${T}/coachAvailability/c2`);
  chk('メモを空のまま OK を押しても、未回答の日は未回答のまま', memo.a === null && memo.state === '未回答' && !(saved && saved.answers && saved.answers[SUN]), JSON.stringify({ memo, saved }));
  // 監督が自分の名前を直した分は、ほかの指導者がメンバーを開いて保存し直すと合う
  page.on('dialog', d => d.accept());
  await page.evaluate(() => { document.querySelector('.tablinks[onclick*="members"]').click(); FCOjima.Hub.Members.openAddMemberModal('c1'); });
  await page.click('#member-form button[type="submit"]');
  await page.waitForTimeout(3000);
  const ka2 = await get(`${T}/users/${kantokuUid}`);
  chk('自分では変えられなかったログインの名前も、ほかの指導者が保存し直すと名簿の名前に合う', ka2.name === '佐藤 健' && ka2.role === 'coach', JSON.stringify(ka2));
  await ctx.close();
}

// 名前を直された保護者: 子どもの紐づけが残る（その日の予定の一覧で「わが子だけ」）
{
  const ctx = await context({ email: 'r11mom@example.com', name: '一年 母', device: null });
  const page = await ctx.newPage();
  await hubReady(page);
  const v = await page.evaluate((SAT) => {
    FCOjima.Hub.Calendar.myChildOnly = true;
    FCOjima.Hub.Calendar.openDayModal(SAT);
    return {
      kids: FCOjima.Hub.MyEvents.getChildren().map(m => m.name),
      hidden: (document.querySelector('#day-events-list .day-events-hidden') || {}).textContent || '',
      btn: document.getElementById('my-child-filter').textContent
    };
  }, SAT);
  chk('名前を直された保護者も子どもの紐づけが残る（登録時の子どもの記録でもつながるので、修正前も通る確認）', JSON.stringify(v.kids) === '["一年 太郎"]', JSON.stringify(v));
  chk('その日の予定で隠れている件数の説明が、ボタンと同じ「わが子だけ」', /「わが子だけ」/.test(v.hidden) && /1件/.test(v.hidden) && /わが子だけ/.test(v.btn), JSON.stringify(v));
  await ctx.close();
}

await closeBrowser();
process.exit(summary() ? 1 : 0);
