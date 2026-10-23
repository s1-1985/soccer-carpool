// 役割と権限（Firestore のルール）: 任命・解任のきまり、監督は1人（指定・引き継ぎ）、管理者に対する操作、ログの削除、
// 権限の設定（自分より下の欄だけ・持っていない権限は付けられない）と、設定に従って各機能が許可・拒否されること
import { put, get, wipe, chk, summary, T, FS, fv } from './lib.mjs';
await wipe();

const ROOT = FS; // .../databases/(default)/documents
const PROJ_DOCS = 'projects/fc-ojimajr-hub/databases/(default)/documents';
async function token(email, name) {
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=k', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postBody: 'id_token=' + encodeURIComponent(JSON.stringify({ sub: 'sub-' + email, email, email_verified: true, name })) + '&providerId=google.com', requestUri: 'http://127.0.0.1', returnSecureToken: true }) });
  return r.json();
}
const U = {};
async function user(key, name, role, extra = {}) {
  const t = await token(key + '@perm.example.com', name);
  U[key] = { uid: t.localId, tok: t.idToken, name };
  await put(`${T}/users/${t.localId}`, { name, role, status: 'approved', email: key + '@perm.example.com', ...extra });
  return U[key];
}
const fields = (d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, fv(v)]));
async function patch(who, path, data, mask) {
  const q = (mask || Object.keys(data)).map(f => 'updateMask.fieldPaths=' + encodeURIComponent(f)).join('&');
  const r = await fetch(`${ROOT}/${path}?${q}`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + who.tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: fields(data) }) });
  return r.ok;
}
async function create(who, path, data) {
  const r = await fetch(`${ROOT}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + who.tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: fields(data) }) });
  return r.ok;
}
async function remove(who, path) {
  const r = await fetch(`${ROOT}/${path}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + who.tok } });
  return r.ok;
}
async function read(who, path) {
  const r = await fetch(`${ROOT}/${path}`, { headers: { Authorization: 'Bearer ' + who.tok } });
  return r.ok;
}
async function listRead(who, col) {
  const r = await fetch(`${ROOT}/${col}`, { headers: { Authorization: 'Bearer ' + who.tok } });
  return r.ok;
}
// 一括の書き込み（どれかがルールで拒否されれば全部拒否）。w: [path, data, mask?]
async function commit(who, writes) {
  const body = { writes: writes.map(([path, data, mask]) => {
    const w = { update: { name: `${PROJ_DOCS}/${path}`, fields: fields(data) } };
    if (mask) w.updateMask = { fieldPaths: mask };
    return w;
  }) };
  const r = await fetch(`${ROOT}:commit`, { method: 'POST', headers: { Authorization: 'Bearer ' + who.tok, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.ok;
}
const role = async (k) => (await get(`${T}/users/${U[k].uid}`)).role;

const A = await user('admin', '管理 太郎', 'admin');
const K = await user('kantoku', '佐藤 監督', 'coach');
const C1 = await user('coach1', '鈴木 コーチ', 'assist');
const C2 = await user('coach2', '田中 コーチ', 'assist');
const O1 = await user('officer1', '役員 一郎', 'officer');
const O2 = await user('officer2', '役員 二郎', 'officer');
const P1 = await user('parent1', '保護者 一', 'parent');
const P2 = await user('parent2', '保護者 二', 'parent');
const P3 = await user('parent3', '保護者 三', 'parent');
const N = await user('newbie', '新人 さん', 'parent', { status: 'pending' });
await put(`${T}/settings/roles`, { kantoku: K.uid });
const uPath = (u) => `${T}/users/${u.uid}`;

// ---------- 任命・解任 ----------
chk('役員は保護者を役員にできる', await patch(O1, uPath(P1), { role: 'officer' }) && await role('parent1') === 'officer');
chk('役員は保護者をコーチにできない', !(await patch(O1, uPath(P2), { role: 'assist' })) && await role('parent2') === 'parent');
chk('コーチは保護者をコーチにできる', await patch(C1, uPath(P2), { role: 'assist' }) && await role('parent2') === 'assist');
chk('コーチは役員を保護者に戻せる（解任）', await patch(C1, uPath(O2), { role: 'parent' }) && await role('officer2') === 'parent');
chk('役員はコーチを外せない', !(await patch(O1, uPath(P2), { role: 'parent' })) && await role('parent2') === 'assist');
chk('コーチはコーチを外せる', await patch(C1, uPath(P2), { role: 'parent' }) && await role('parent2') === 'parent');
chk('役員は役員を外せる', await patch(O1, uPath(P1), { role: 'parent' }) && await role('parent1') === 'parent');
chk('自分の役割は変えられない（コーチが自分を監督に・役員が自分をコーチに）',
  !(await patch(C1, uPath(C1), { role: 'coach' })) && !(await patch(O1, uPath(O1), { role: 'assist' })));
chk('監督でないコーチは、監督の記録を書き換えても人を監督にできない',
  !(await commit(C1, [[uPath(P2), { role: 'coach' }, ['role']], [`${T}/settings/roles`, { kantoku: P2.uid }]])) && await role('parent2') === 'parent');
chk('管理者でも、監督の記録を変えずに2人目の監督は作れない（監督は1人だけ）', !(await patch(A, uPath(P3), { role: 'coach' })) && await role('parent3') === 'parent');

// ---------- 監督の引き継ぎ ----------
chk('監督が自分を監督のまま残して次の監督を指名することはできない',
  !(await commit(K, [[uPath(C2), { role: 'coach' }, ['role']], [`${T}/settings/roles`, { kantoku: C2.uid }]])) && await role('coach2') === 'assist');
chk('監督は次の監督を指名でき、自分はコーチになる',
  await commit(K, [[uPath(C2), { role: 'coach' }, ['role']], [uPath(K), { role: 'assist' }, ['role']], [`${T}/settings/roles`, { kantoku: C2.uid }]])
  && await role('coach2') === 'coach' && await role('kantoku') === 'assist' && (await get(`${T}/settings/roles`)).kantoku === C2.uid);
chk('引き継いだ前の監督は、もう監督を指名できない',
  !(await commit(K, [[uPath(K), { role: 'coach' }, ['role']], [`${T}/settings/roles`, { kantoku: K.uid }]])));
chk('管理者は監督を指定できる（いまの監督は同じ書き込みでコーチに）',
  await commit(A, [[uPath(K), { role: 'coach' }, ['role']], [uPath(C2), { role: 'assist' }, ['role']], [`${T}/settings/roles`, { kantoku: K.uid }]])
  && await role('kantoku') === 'coach' && await role('coach2') === 'assist');
chk('管理者でも、いまの監督を監督のまま残して別の人を指定はできない',
  !(await commit(A, [[uPath(C2), { role: 'coach' }, ['role']], [`${T}/settings/roles`, { kantoku: C2.uid }]])));
chk('監督を外せるのは管理者だけ（コーチは監督を外せない）', !(await patch(C1, uPath(K), { role: 'assist' })) && await role('kantoku') === 'coach');

// ---------- 管理者に対する操作 ----------
chk('管理者以外は、管理者の役割・承認・名前を変えられない',
  !(await patch(K, uPath(A), { role: 'parent' })) && !(await patch(O1, uPath(A), { status: 'rejected' })) && !(await patch(C1, uPath(A), { name: '別の名前' })));

// ---------- 承認 ----------
chk('役員は申請を保護者として承認できる（承認の権限の初期値）', await patch(O1, uPath(N), { status: 'approved' }) && (await get(uPath(N))).status === 'approved');
await put(uPath(N), { name: '新人 さん', role: 'parent', status: 'pending', email: 'newbie@perm.example.com' });
chk('役員は申請をコーチとして承認できない', !(await patch(O1, uPath(N), { status: 'approved', role: 'assist' })));
chk('コーチは申請をコーチとして承認できる', await patch(C1, uPath(N), { status: 'approved', role: 'assist' }) && await role('newbie') === 'assist');
chk('却下（承認の取り消し）も、その人の役割を外せる人だけ（役員はコーチを、コーチは監督を却下にできない）',
  !(await patch(O1, uPath(N), { status: 'rejected' })) && !(await patch(C1, uPath(K), { status: 'rejected' }))
  && (await get(uPath(N))).status === 'approved' && (await get(uPath(K))).status === 'approved');

// ---------- ログ ----------
await put(`${T}/logs/l1`, { datetime: new Date().toISOString(), type: 'members', action: 'メンバー追加', details: 'x', user: 'x' });
await put(`${T}/logs/l2`, { datetime: new Date().toISOString(), type: 'members', action: 'メンバー追加', details: 'y', user: 'y' });
chk('ログを見られるのは操作ログの権限がある人（役員は見られる・保護者は見られない）', await read(O1, `${T}/logs/l1`) && !(await read(P1, `${T}/logs/l1`)));
chk('ログを消せるのは管理者だけ（監督・コーチ・役員は消せない）',
  !(await remove(K, `${T}/logs/l1`)) && !(await remove(C1, `${T}/logs/l1`)) && !(await remove(O1, `${T}/logs/l1`)) && await remove(A, `${T}/logs/l1`) && !(await get(`${T}/logs/l1`)));

// ---------- 権限の設定（自分より下の欄だけ）----------
const PERM = `${T}/settings/permissions`;
chk('初期値: 保護者は予定を作れる', await create(P1, `${T}/events/e1`, { title: 'x', date: '2026-12-01', type: 'game' }));
chk('役員は保護者の欄を変えられる（予定を外す）', await patch(O1, PERM, { parent: { events: false } }));
chk('役員は自分の欄・上の役割の欄・管理者の欄は変えられない',
  !(await patch(O1, PERM, { officer: { members: false } })) && !(await patch(O1, PERM, { assist: { members: false } })) && !(await patch(O1, PERM, { admin: { members: false } })));
chk('保護者には管理タブの機能（承認）を付けられない', !(await patch(A, PERM, { parent: { events: false, approve: true } })));
chk('決まった機能・true/false 以外は書けない', !(await patch(A, PERM, { parent: { events: 'yes' } })) && !(await patch(A, PERM, { parent: { hack: true } })));
chk('設定どおり、保護者は予定を作れない（学年外の選手の追加はできる）',
  !(await create(P1, `${T}/events/e2`, { title: 'y', date: '2026-12-02', type: 'game' }))
  && await patch(P1, `${T}/events/e1`, { extraPlayers: ['だれか'] }) && !(await patch(P1, `${T}/events/e1`, { title: '書き換え' })));
await put(uPath(N), { name: '新人 さん', role: 'parent', status: 'pending', email: 'newbie@perm.example.com' });
chk('コーチは役員の欄を変えられる（承認を外すと役員は申請を承認・却下できなくなる）',
  await patch(C1, PERM, { officer: { approve: false } }) && !(await patch(O1, uPath(N), { status: 'rejected' })) && !(await patch(O1, uPath(N), { status: 'approved' })));
await patch(A, PERM, { assist: { duty: false }, officer: { duty: false } });
chk('自分が使えない機能は下の役割に付けられない（当番を外されたコーチは役員に当番を付けられない）',
  !(await patch(C1, PERM, { officer: { duty: true } })) && await patch(K, PERM, { officer: { duty: true } }));
chk('設定どおり、当番を外されたコーチは当番グループを書けない・監督は書ける',
  !(await create(C1, `${T}/dutyGroups/g1`, { name: '青', memberIds: [] })) && await create(K, `${T}/dutyGroups/g1`, { name: '青', memberIds: [] }));
await patch(A, PERM, { parent: { events: false, members: true } });
chk('保護者に名簿の権限を付けると、名簿を書ける', await create(P1, `${T}/members/m9`, { name: '新しい人', role: 'father' }));

// ---------- 指導者の都合 ----------
await put(`${T}/members/mc1`, { name: '鈴木 コーチ', role: 'assist' });
await put(`${T}/members/mc2`, { name: '田中 コーチ', role: 'assist' });
await patch(A, PERM, { assist: { duty: false, coach_plan: false } });
chk('指導者の予定・担当を外されたコーチも、自分の都合は書ける・ほかの人の都合は書けない',
  await create(C1, `${T}/coachAvailability/mc1`, { name: '鈴木 コーチ', answers: {} }) && !(await create(C1, `${T}/coachAvailability/mc2`, { name: '田中 コーチ', answers: {} })));
chk('指導者の予定・担当を外されたコーチは担当を決められない', !(await create(C1, `${T}/coachAssignments/e1`, { memberIds: ['mc1'] })) && await create(K, `${T}/coachAssignments/e1`, { memberIds: ['mc1'] }));

// ---------- 連絡事項の削除 ----------
await create(P1, `${T}/notifications/n-p1`, { date: '2026/10/23 08:00', text: '保護者の連絡', user: P1.name, uid: P1.uid });
chk('連絡に他人の uid・管理者の印を付けて書くことはできない',
  !(await create(P1, `${T}/notifications/n-fake`, { date: '2026/10/23 08:00', text: 'なりすまし', user: '管理 太郎', uid: A.uid }))
  && !(await create(P1, `${T}/notifications/n-fake2`, { date: '2026/10/23 08:00', text: '消されない連絡', user: P1.name, uid: P1.uid, byAdmin: true })));
await create(A, `${T}/notifications/n-a`, { date: '2026/10/23 08:00', text: '管理者の連絡', user: A.name, uid: A.uid, byAdmin: true });
await put(`${T}/notifications/n-old`, { date: '2026/10/01 08:00', text: '以前の連絡', user: P1.name });
chk('ほかの保護者の連絡は消せない（保護者）', !(await remove(P2, `${T}/notifications/n-p1`)) && !(await remove(P2, `${T}/notifications/n-old`)));
chk('管理者が書いた連絡は、ほかの人の連絡を消せる役員・監督でも消せない', !(await remove(O1, `${T}/notifications/n-a`)) && !(await remove(K, `${T}/notifications/n-a`)) && await remove(A, `${T}/notifications/n-a`));
chk('自分の連絡は消せる（uid のない以前の連絡は名前で本人と分かる）', await remove(P1, `${T}/notifications/n-old`) && await remove(P1, `${T}/notifications/n-p1`));
await create(P2, `${T}/notifications/n-p2`, { date: '2026/10/23 09:00', text: '保護者二の連絡', user: P2.name, uid: P2.uid });
chk('ほかの人の連絡の削除の権限がある役員は、保護者の連絡を消せる', await remove(O1, `${T}/notifications/n-p2`));

// ---------- 権限の設定の読み書きの入口 ----------
chk('権限の設定は承認済みなら読める・保護者は書けない', await read(P1, PERM) && !(await patch(P1, PERM, { parent: { events: true } })));
chk('監督の記録は管理者といまの監督以外は書けない', !(await patch(O1, `${T}/settings/roles`, { kantoku: O1.uid })) && !(await patch(C1, `${T}/settings/roles`, { kantoku: '' })));

process.exit(summary() ? 1 : 0);
