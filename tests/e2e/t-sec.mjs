// セキュリティの検証: 攻撃する側（ログインしていない人・未登録の Google アカウント・承認待ち・却下・承認済みの保護者）から
// Firestore と Storage のルールを直接たたき、読めない・書けない・なりすませないことを確かめる
import { put, get, wipe, chk, summary, T, FS, fv } from './lib.mjs';
await wipe();

const ROOT = FS;
const BUCKET = 'fc-ojimajr-hub.firebasestorage.app';
const ST = `http://127.0.0.1:9199/v0/b/${BUCKET}/o`;
async function token(email, name) {
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=k', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postBody: 'id_token=' + encodeURIComponent(JSON.stringify({ sub: 'sub-' + email, email, email_verified: true, name })) + '&providerId=google.com', requestUri: 'http://127.0.0.1', returnSecureToken: true }) });
  const j = await r.json();
  return { uid: j.localId, tok: j.idToken, name, email };
}
async function user(key, name, role, extra = {}) {
  const u = await token(key + '@sec.example.com', name);
  await put(`${T}/users/${u.uid}`, { name, role, status: 'approved', email: u.email, ...extra });
  return u;
}
const fields = (d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, fv(v)]));
const auth = (who) => (who && who.tok ? { Authorization: 'Bearer ' + who.tok } : {});
async function write(who, path, data) { // 作成または全体の上書き
  const r = await fetch(`${ROOT}/${path}`, { method: 'PATCH', headers: { ...auth(who), 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: fields(data) }) });
  return r.ok;
}
async function patch(who, path, data) { // 指定した項目だけ変える
  const q = Object.keys(data).map(f => 'updateMask.fieldPaths=' + encodeURIComponent(f)).join('&');
  const r = await fetch(`${ROOT}/${path}?${q}`, { method: 'PATCH', headers: { ...auth(who), 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: fields(data) }) });
  return r.ok;
}
async function read(who, path) { return (await fetch(`${ROOT}/${path}`, { headers: auth(who) })).ok; }
async function remove(who, path) { return (await fetch(`${ROOT}/${path}`, { method: 'DELETE', headers: auth(who) })).ok; }
// 申請（登録画面と同じく、registeredAt はサーバーの時刻）
async function apply(who, data) {
  const body = { writes: [{ update: { name: `projects/fc-ojimajr-hub/databases/(default)/documents/${T}/users/${who.uid}`, fields: fields(data) },
    updateTransforms: [{ fieldPath: 'registeredAt', setToServerValue: 'REQUEST_TIME' }] }] };
  const r = await fetch(`${ROOT}:commit`, { method: 'POST', headers: { ...auth(who), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.ok;
}
const upload = (who, path, body = 'hello', type = 'text/plain') => fetch(`${ST}?name=${encodeURIComponent(path)}`, { method: 'POST', headers: { ...(who ? { Authorization: 'Bearer ' + who.tok } : {}), 'Content-Type': type }, body }).then(r => r.status);
const download = (who, path) => fetch(`${ST}/${encodeURIComponent(path)}?alt=media`, { headers: who ? { Authorization: 'Bearer ' + who.tok } : {} }).then(r => r.status);

// ---------- 準備 ----------
const A = await user('admin', '管理 太郎', 'admin');
const K = await user('kantoku', '佐藤 監督', 'coach');
const P = await user('parent', '保護者 一', 'parent', { childrenIds: ['p1'] });
const Pend = await token('pend@sec.example.com', '承認待ち さん');
await put(`${T}/users/${Pend.uid}`, { name: '承認待ち さん', role: 'parent', status: 'pending', email: Pend.email });
const Rej = await token('rej@sec.example.com', '却下 さん');
await put(`${T}/users/${Rej.uid}`, { name: '却下 さん', role: 'parent', status: 'rejected', email: Rej.email });
const X = await token('stranger@sec.example.com', '部外者');
await put(`${T}/settings/roles`, { kantoku: K.uid });
await put(`${T}/members/p1`, { name: '山田 太郎', role: 'player', grade: '3', birth: '2017-05-05' });
await put(`${T}/members/p2`, { name: '鈴木 次郎', role: 'player', grade: '2', birth: '2018-01-01' });
await put(`${T}/members/m1`, { name: '保護者 一', role: 'mother', childrenIds: ['p1'] });
await put(`${T}/members/k1`, { name: '佐藤 監督', role: 'coach' });
await put(`${T}/events/e1`, { title: '練習', date: '2026-12-01', type: 'practice' });
await put(`${T}/eventData/e1`, { attendance: {} });
await put(`${T}/notifications/n1`, { date: '2026/10/23 08:00', text: 'お知らせ', user: '管理 太郎', uid: A.uid, byAdmin: true });
await put(`${T}/logs/l1`, { datetime: new Date().toISOString(), type: 'members', action: 'メンバー追加', details: 'x', user: '管理 太郎' });
await put(`${T}/config/c1`, { x: 1 });
const uPath = (u) => `${T}/users/${u.uid}`;

// ---------- ログインしていない人・未登録・承認待ち・却下は、チームのデータを読めない・書けない ----------
const PATHS = ['members/p1', 'events/e1', 'eventData/e1', 'notifications/n1', 'logs/l1', 'venues/v1', 'settings/permissions', 'settings/roles',
  'dutyGroups/g1', 'dutyAssignments/e1', 'coachAvailability/k1', 'coachAssignments/e1', 'config/c1', `users/${A.uid}`];
for (const [label, who] of [['ログインしていない人', null], ['未登録の Google アカウント', X], ['承認待ち', Pend], ['却下された人', Rej]]) {
  const readable = [];
  for (const p of PATHS) if (await read(who, `${T}/${p}`)) readable.push(p);
  chk(`${label}はチームのデータを読めない`, readable.length === 0, readable.join(','));
  const writable = [];
  for (const p of ['members/hack', 'events/hack', 'eventData/hack', 'notifications/hack', 'logs/hack', 'venues/hack']) {
    if (await write(who, `${T}/${p}`, { name: 'x', text: 'x', user: 'x', title: 'x', date: '2026-12-01' })) writable.push(p);
  }
  chk(`${label}はチームのデータを書けない`, writable.length === 0, writable.join(','));
}
chk('ログインしていない人・未登録の人は、ほかの人の申請を作れない', !(await write(null, `${T}/users/someone`, { name: 'x', role: 'parent', status: 'pending' }))
  && !(await write(X, `${T}/users/${A.uid}x`, { name: 'x', role: 'parent', status: 'pending' })));

// ---------- 申請（新規登録）で、承認する人が決める項目を入れられない ----------
// 申請が1回通るとその人のドキュメントができ、あとの書き込みは「上書き」として拒否されるので、確かめるたびに別のアカウントを使う
let nth = 0;
const fresh = async () => token(`new${++nth}@sec.example.com`, '新人' + nth);
const base = (u) => ({ name: u.name, kana: 'シンジン', requestedRole: 'parent', email: u.email, role: 'parent', childrenIds: [], childrenNames: ['山田 太郎'], status: 'pending' });
const tryApply = async (extra) => { const u = await fresh(); return apply(u, { ...base(u), ...extra }); };
chk('申請で、承認済み・管理者として登録できない', !(await tryApply({ status: 'approved' })) && !(await tryApply({ role: 'admin' })));
chk('申請で、子供の紐づけ（childrenIds・照合済みの印）を入れられない', !(await tryApply({ childrenIds: ['p1'] })) && !(await tryApply({ childrenLinked: true })));
chk('申請で、承認した人・承認の日時を入れられない', !(await tryApply({ approvedBy: A.uid })) && !(await tryApply({ approvedAt: '2026-01-01' })));
chk('申請で、ログインと違うメールアドレスを名乗れない', !(await tryApply({ email: 'admin@sec.example.com' })));
chk('申請で、決まった項目以外を入れられない', !(await tryApply({ byAdmin: true })) && !(await tryApply({ uidOf: A.uid })));
chk('登録画面と同じ申請はできる（メールを空にした申請も）', await tryApply({}) && await tryApply({ email: null }));
chk('承認待ち・却下された人は、自分の申請を承認済みに書き換えられない',
  !(await patch(Pend, uPath(Pend), { status: 'approved' })) && !(await patch(Rej, uPath(Rej), { status: 'approved' })) && !(await remove(Rej, uPath(Rej))));

// ---------- 承認済みの保護者 ----------
chk('保護者は自分の役割・子供の紐づけ・名前を変えられない',
  !(await patch(P, uPath(P), { role: 'admin' })) && !(await patch(P, uPath(P), { childrenIds: ['p1', 'p2'] })) && !(await patch(P, uPath(P), { name: '管理 太郎' })));
chk('保護者はほかの人のユーザー情報（メールなど）を読めない', !(await read(P, uPath(A))) && !(await read(P, uPath(K))) && await read(P, uPath(P)));
chk('保護者は管理の設定（config）・操作ログを読めない', !(await read(P, `${T}/config/c1`)) && !(await read(P, `${T}/logs/l1`)));
chk('保護者は権限の設定・監督の記録を書けない',
  !(await write(P, `${T}/settings/permissions`, { parent: { approve: true } })) && !(await write(P, `${T}/settings/roles`, { kantoku: P.uid })) && !(await write(P, `${T}/settings/other`, { x: 1 })));
chk('保護者は当番・荷物・指導者の担当を書けない',
  !(await write(P, `${T}/dutyAssignments/e1`, { groupId: 'g' })) && !(await write(P, `${T}/dutyGroups/g1`, { name: 'g' }))
  && !(await write(P, `${T}/luggageSettings/s1`, { items: [] })) && !(await write(P, `${T}/coachAssignments/e1`, { members: [] })));
chk('保護者は自分の家庭でない人の兄弟児を書き換えられない', !(await patch(P, `${T}/members/k1`, { siblings: [{ name: 'x' }] })) && await patch(P, `${T}/members/m1`, { siblings: [{ name: '妹' }] }));
chk('保護者はほかの人の連絡を書き換えられない', !(await patch(P, `${T}/notifications/n1`, { text: '書き換え' })));
chk('ほかのチームのデータは読めない・書けない', !(await read(P, 'teams/other/members/p1')) && !(await write(P, 'teams/other/members/p1', { name: 'x' })));

// ---------- なりすまし（連絡事項・操作ログ）----------
chk('連絡事項を、書いた人の uid なしで書けない（だれが書いたか分からない連絡を作れない）',
  !(await write(P, `${T}/notifications/n-nouid`, { date: '2026/10/23 09:00', text: '明日は中止です', user: '保護者 一' })));
chk('連絡事項を、ほかの人の名前で書けない（保護者が「管理 太郎」を名乗る）',
  !(await write(P, `${T}/notifications/n-spoof`, { date: '2026/10/23 09:00', text: '明日は中止です', user: '管理 太郎', uid: P.uid })));
chk('連絡事項は、自分の名前と uid なら書ける', await write(P, `${T}/notifications/n-ok`, { date: '2026/10/23 09:00', text: 'よろしくお願いします', user: '保護者 一', uid: P.uid }));
chk('操作ログを、ほかの人の名前で書けない（保護者が「管理 太郎」の操作を作る）',
  !(await write(P, `${T}/logs/l-spoof`, { datetime: new Date().toISOString(), type: 'members', action: 'メンバー削除', details: 'x', user: '管理 太郎' })));
chk('操作ログは、自分の名前なら書ける', await write(P, `${T}/logs/l-ok`, { datetime: new Date().toISOString(), type: 'events', action: 'イベント追加', details: 'x', user: '保護者 一' }));

// ---------- 添付ファイル（Storage）----------
const F = `teams/fc-ojima/events/e1/sec-${Date.now()}.txt`;
chk('添付ファイル: ログインしていない人・承認待ちはアップロードも開くこともできない',
  await upload(null, F) === 403 && await upload(Pend, F) === 403 && await upload(P, F) === 200 && await download(null, F) === 403 && await download(Pend, F) === 403);
chk('添付ファイル: 10MB を超えるファイルはアップロードできない', await upload(P, F + '.big', 'x'.repeat(10 * 1024 * 1024 + 1)) === 403);
chk('添付ファイル: ほかのチームの場所には置けない', await upload(P, `teams/other/events/e1/x.txt`) === 403);

process.exitCode = summary() ? 1 : 0;
