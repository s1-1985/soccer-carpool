// 6巡目: 添付ファイル（Storage）と選手情報（members）の権限
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, FS, watchErrors } from './lib.mjs';
await wipe();
const BUCKET = 'fc-ojimajr-hub.firebasestorage.app';
const ST = `http://127.0.0.1:9199/v0/b/${BUCKET}/o`;

async function token(email, name) {
  const t = JSON.stringify({ sub: 'sub-' + email, email, email_verified: true, name });
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=k', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postBody: 'id_token=' + encodeURIComponent(t) + '&providerId=google.com', requestUri: 'http://127.0.0.1', returnSecureToken: true }) });
  const j = await r.json();
  return { idToken: j.idToken, uid: j.localId };
}
const upload = (tok, path) => fetch(`${ST}?name=${encodeURIComponent(path)}`, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'text/plain' }, body: 'hello' }).then(r => r.status);
const download = (tok, path) => fetch(`${ST}/${encodeURIComponent(path)}?alt=media`, { headers: { Authorization: 'Bearer ' + tok } }).then(r => r.status);
const listing = (tok, prefix) => fetch(`${ST}?prefix=${encodeURIComponent(prefix)}`, { headers: { Authorization: 'Bearer ' + tok } }).then(r => r.status);
const remove = (tok, path) => fetch(`${ST}/${encodeURIComponent(path)}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } }).then(r => r.status);
const readDoc = (tok, p) => fetch(`${FS}/${p}`, { headers: { Authorization: 'Bearer ' + tok } }).then(r => r.status);

await put(`${T}/members/p1`, { name: '山田 太郎', kana: 'ヤマダ タロウ', role: 'player', grade: '3', birth: '2017-05-05' });
await put(`${T}/members/p2`, { name: '佐藤 花子', role: 'player', grade: '2', birth: '2018-07-07' });
await makeUser('sec-admin@example.com', '管理者', 'admin');
const admin = await token('sec-admin@example.com', '管理者');
const pend = await token('sec-pend@example.com', '承認待ち');
await put(`${T}/users/${pend.uid}`, { name: '承認待ち', role: 'parent', status: 'pending' });
const stranger = await token('sec-x@example.com', '部外者');

const P = `teams/fc-ojima/events/ev${Date.now()}/案内.txt`;
const PREFIX = P.split('/').slice(0, 4).join('/') + '/';

// 1) 添付ファイル
chk('承認済みユーザーは添付ファイルをアップロードできる', await upload(admin.idToken, P) === 200);
chk('承認済みユーザーは添付ファイルを開ける', await download(admin.idToken, P) === 200);
for (const [label, u] of [['承認待ちのユーザー', pend], ['未登録のGoogleアカウント', stranger]]) {
  chk(`${label}は添付ファイルを開けない`, (await download(u.idToken, P)) === 403);
  chk(`${label}は添付ファイルの一覧を見られない`, (await listing(u.idToken, PREFIX)) === 403);
  chk(`${label}はアップロードできない`, (await upload(u.idToken, P.replace('案内', label))) === 403);
  chk(`${label}は削除できない`, (await remove(u.idToken, P)) === 403);
}
chk('承認済みユーザーは添付ファイルを削除できる', await remove(admin.idToken, P) === 204 || await download(admin.idToken, P) === 404);

// 2) 選手情報
chk('承認済みユーザーは選手の情報を読める', await readDoc(admin.idToken, `${T}/members/p1`) === 200);
chk('承認待ちのユーザーは選手の情報（氏名・生年月日）を読めない', await readDoc(pend.idToken, `${T}/members/p1`) === 403);
chk('未登録のGoogleアカウントは選手の情報を読めない', await readDoc(stranger.idToken, `${T}/members/p1`) === 403);

// 3) 新規登録: 子供は氏名入力。名簿を読まないので権限エラーも出ない
const ctx = await context({ email: 'sec-new@example.com', name: '新しい保護者' });
const page = await ctx.newPage();
const errs = watchErrors(page);
await page.goto(BASE + '/hub/register.html');
await page.waitForFunction(() => document.querySelector('#child-inputs input'), null, { timeout: 20000 });
await page.fill('#reg-name', '山田 一郎');
await page.fill('#reg-kana', 'ヤマダ イチロウ');
await page.fill('#child-inputs input', 'やまだ たろう');
await page.click('#add-child-input');
await page.fill('#child-inputs input >> nth=1', '鈴木 次郎');
await page.click('button[type="submit"]');
await page.waitForURL(/pending\.html/, { timeout: 15000 });
const newUid = (await token('sec-new@example.com', '新しい保護者')).uid;
const ud = await get(`${T}/users/${newUid}`);
chk('新規登録で入力した子供の氏名が申請に保存される', JSON.stringify(ud.childrenNames) === '["やまだ たろう","鈴木 次郎"]' && ud.status === 'pending', JSON.stringify(ud));
chk('新規登録画面で権限エラーが出ない（選手名簿を読まない）', !errs.some(e => /permission|insufficient/i.test(e)), errs.join(' | ').slice(0, 200));
await ctx.close();

// 4) 承認: 入力された氏名を名簿と照合（一致する選手を初期選択）して子供を設定
const actx = await context({ email: 'sec-admin@example.com', name: '管理者', device: null });
const ap = await actx.newPage();
ap.on('dialog', d => d.accept());
await ap.goto(BASE + '/hub/index.html');
await ap.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
await ap.evaluate(() => document.querySelector('.tablinks[onclick*="admin"]').click());
await ap.waitForFunction(() => document.querySelectorAll('.pending-child-select').length === 2, null, { timeout: 15000 });
const sel = await ap.evaluate(() => [...document.querySelectorAll('.pending-child-select')].map(s => s.value));
chk('承認カードで、入力された氏名に一致する選手が選ばれている（ひらがな入力も一致）', sel[0] === 'p1' && sel[1] === '', JSON.stringify(sel));
await ap.evaluate(() => { const card = document.querySelector('.pending-child-select').closest('#pending-users-list > div'); card.querySelector('.approve-btn').click(); });
await ap.waitForTimeout(1500);
const ud2 = await get(`${T}/users/${newUid}`);
chk('承認すると照合した子供が設定される', ud2.status === 'approved' && JSON.stringify(ud2.childrenIds) === '["p1"]', JSON.stringify({ s: ud2.status, c: ud2.childrenIds }));
await actx.close();

// 5) 承認された保護者は参加予定で子供が見える
await put(`${T}/events/e1`, { title: '3年の試合', date: '2026-12-20', type: 'game', target: ['3'] });
const pctx = await context({ email: 'sec-new@example.com', name: '新しい保護者' });
const pp = await pctx.newPage();
await pp.goto(BASE + '/hub/index.html');
await pp.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
await pp.waitForTimeout(1500);
const kids = await pp.evaluate(() => FCOjima.Hub.MyEvents.getChildren().map(m => m.name));
chk('承認された保護者の参加予定に子供が出る', JSON.stringify(kids) === '["山田 太郎"]', JSON.stringify(kids));
await pctx.close();

await closeBrowser();
process.exit(summary() ? 1 : 0);
