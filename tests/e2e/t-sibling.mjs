// 兄弟児（保護者に紐づけておき、車提供の登録で呼び出す）
import { put, get, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T } from './lib.mjs';
await wipe();
await put(`${T}/members/p5`, { name: '五十嵐 結衣', role: 'player', grade: '4' });
await put(`${T}/members/p7`, { name: '武者小路 實篤', role: 'player', grade: '3' });
await put(`${T}/members/f5`, { name: '五十嵐 健', role: 'father', childrenIds: ['p5'] });
await put(`${T}/members/m5`, { name: '五十嵐 真理子', role: 'mother', childrenIds: ['p5'] });
await put(`${T}/members/m7`, { name: '武者小路 千代子', role: 'mother', childrenIds: ['p7'], siblings: [{ name: '武者小路 妹', note: '' }] });
const EV = '1900000030001';
await put(`${T}/events/${EV}`, { title: '練習試合', date: '2026-11-28', type: 'game', target: ['3', '4'] });
await put(`${T}/eventData/${EV}`, { attendance: [{ name: '五十嵐 結衣', status: 'present', notes: '' }] });
await makeUser('sibadmin@example.com', '管理者', 'admin');
await makeUser('sibmom@example.com', '五十嵐 真理子', 'parent', { childrenIds: ['p5'] });

// 1) 管理者がメンバー編集で父に兄弟児を登録（父の家庭の兄弟児）
{
  const ctx = await context({ email: 'sibadmin@example.com', name: '管理者', device: null });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  await page.goto(BASE + '/hub/index.html');
  await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => FCOjima.Hub.Members.openAddMemberModal('f5'));
  const shown = await page.evaluate(() => document.getElementById('siblings-group').style.display !== 'none');
  await page.click('#add-sibling-row');
  await page.fill('#siblings-editor .sibling-row:nth-child(1) .sibling-name', '五十嵐 さくら');
  await page.fill('#siblings-editor .sibling-row:nth-child(1) .sibling-note', '3歳・チャイルドシート');
  await page.click('#add-sibling-row');
  await page.fill('#siblings-editor .sibling-row:nth-child(2) .sibling-name', '五十嵐 大地');
  await page.evaluate(() => FCOjima.Hub.Members.saveMember());
  await page.waitForTimeout(2000);
  const f5 = await get(`${T}/members/f5`);
  chk('メンバー編集で保護者に兄弟児（名前・メモ）を登録できる', shown && JSON.stringify(f5.siblings) === JSON.stringify([{ name: '五十嵐 さくら', note: '3歳・チャイルドシート' }, { name: '五十嵐 大地', note: '' }]), JSON.stringify(f5.siblings));
  const card = await page.evaluate(() => [...document.querySelectorAll('.member-card')].find(c => /五十嵐 健/.test(c.textContent)).textContent);
  chk('メンバーのカードに兄弟児が表示される', /兄弟児: 五十嵐 さくら（3歳・チャイルドシート）、五十嵐 大地/.test(card), card.slice(0, 80));
  // 役割が選手のメンバーには兄弟児の欄を出さない
  await page.evaluate(() => FCOjima.Hub.Members.openAddMemberModal('p5'));
  const hiddenForPlayer = await page.evaluate(() => document.getElementById('siblings-group').style.display === 'none');
  chk('選手のメンバー編集には兄弟児の欄が出ない', hiddenForPlayer, '');
  await page.evaluate(() => FCOjima.UI.closeModal('member-modal'));
  // 他の項目を編集して保存しても兄弟児が消えない
  await page.evaluate(() => FCOjima.Hub.Members.openAddMemberModal('f5'));
  await page.fill('#member-notes', '土日のみ送迎可');
  await page.evaluate(() => FCOjima.Hub.Members.saveMember());
  await page.waitForTimeout(1500);
  const f5b = await get(`${T}/members/f5`);
  chk('ほかの項目を編集して保存しても兄弟児は残る', (f5b.siblings || []).length === 2 && f5b.notes === '土日のみ送迎可', JSON.stringify(f5b.siblings));
  await ctx.close();
}

// 2) 母（保護者）が車提供で自分を運転者にすると、家庭（父に登録した分も）の兄弟児をチェックで選べる
{
  const ctx = await context({ email: 'sibmom@example.com', name: '五十嵐 真理子', device: 'iPhone 13' });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  await page.goto(BASE + '/carpool/cars.html?event=' + EV);
  await page.waitForFunction(() => document.getElementById('parentName') && FCOjima.Carpool._base, null, { timeout: 25000 });
  await page.waitForTimeout(500);
  // 運転者には最初から自分（ログインしている人）が入っているので、家庭の兄弟児がすぐ選べる
  const pre = await page.evaluate(() => ({ name: document.getElementById('parentName').value, shown: document.getElementById('sibling-group').style.display }));
  await page.fill('#parentName', '');
  await page.dispatchEvent('#parentName', 'input');
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => document.getElementById('sibling-group').style.display);
  await page.fill('#parentName', '五十嵐 真理子');
  await page.waitForTimeout(300);
  const opts = await page.evaluate(() => [...document.querySelectorAll('#sibling-options .sibling-check')].map(c => c.value));
  chk('運転者は最初から自分で家庭の兄弟児が選べる。運転者を空にすると兄弟児の欄は出ず、自分にすると選べる（父に登録した分も）', pre.name === '五十嵐 真理子' && pre.shown !== 'none' && before === 'none' && JSON.stringify(opts) === JSON.stringify(['五十嵐 さくら', '五十嵐 大地']), JSON.stringify({ pre, before, opts }));
  await page.locator('#sibling-options label', { hasText: '五十嵐 さくら' }).locator('input').check();
  await page.click('#register-car');
  await page.evaluate(() => FCOjima.Carpool.whenSaved());
  const d = await get(`${T}/eventData/${EV}`);
  const car = (d.carRegistrations || []).find(c => c.parent === '五十嵐 真理子');
  chk('チェックした兄弟児が空いている席（中列1）でメンバー外乗員として車に登録される（チェックしない兄弟児は入らない）', car && JSON.stringify(car.extraPassengers) === JSON.stringify([{ name: '五十嵐 さくら', seatType: '中列', seatIndex: 0 }]), JSON.stringify(car));

  // 3) 保護者本人が車提供の画面から兄弟児を登録できる（自分の家庭の分）
  await page.fill('#parentName', '五十嵐 真理子');
  await page.waitForTimeout(200);
  await page.click('#sibling-add-toggle');
  await page.fill('#sibling-add-name', '五十嵐 はな');
  await page.fill('#sibling-add-note', '1歳');
  await page.click('#sibling-add-save');
  await page.waitForTimeout(1500);
  const m5 = await get(`${T}/members/m5`);
  const opts2 = await page.evaluate(() => [...document.querySelectorAll('#sibling-options .sibling-check')].map(c => ({ v: c.value, on: c.checked })));
  chk('保護者本人が車提供の画面から自分の家庭の兄弟児を登録でき、すぐ選べる（チェック済み）', JSON.stringify(m5.siblings) === JSON.stringify([{ name: '五十嵐 はな', note: '1歳' }]) && opts2.some(o => o.v === '五十嵐 はな' && o.on), JSON.stringify({ s: m5.siblings, opts2 }));

  // 4) 他の家庭の保護者を運転者にして兄弟児を登録しようとしても登録できない
  await page.fill('#parentName', '武者小路 千代子');
  await page.waitForTimeout(200);
  const otherOpts = await page.evaluate(() => [...document.querySelectorAll('#sibling-options .sibling-check')].map(c => c.value));
  await page.click('#sibling-add-toggle');
  await page.fill('#sibling-add-name', '勝手に追加');
  await page.click('#sibling-add-save');
  await page.waitForTimeout(1500);
  const m7 = await get(`${T}/members/m7`);
  const toast = await page.evaluate(() => (document.querySelector('.toast-notification') || {}).textContent || '');
  chk('他の家庭の保護者の兄弟児は、保護者からは登録できない（案内が出る）', JSON.stringify(m7.siblings) === JSON.stringify([{ name: '武者小路 妹', note: '' }]) && /登録できませんでした/.test(toast) && JSON.stringify(otherOpts) === JSON.stringify(['武者小路 妹']), JSON.stringify({ s: m7.siblings, toast }));

  // 5) 権限: 保護者は自分の家庭のメンバーでも、兄弟児以外の項目は変更できない
  const r = await page.evaluate(async () => {
    const ref = FCOjimaFirebase.Collections.members();
    const out = {};
    try { await ref.doc('m5').update({ notes: '書き換え' }); out.notes = 'ok'; } catch (e) { out.notes = e.code; }
    try { await ref.doc('m5').update({ siblings: [], role: 'officer' }); out.mixed = 'ok'; } catch (e) { out.mixed = e.code; }
    try { await ref.doc('m7').update({ siblings: [] }); out.other = 'ok'; } catch (e) { out.other = e.code; }
    try { await ref.doc('p5').update({ siblings: [{ name: 'x', note: '' }] }); out.player = 'ok'; } catch (e) { out.player = e.code; }
    // 同じ子供に紐づく配偶者（父）のメンバーの兄弟児は変更できる
    try { await ref.doc('f5').update({ siblings: firebase.firestore.FieldValue.arrayUnion({ name: '五十嵐 そら', note: '' }) }); out.spouse = 'ok'; } catch (e) { out.spouse = e.code; }
    return out;
  });
  chk('保護者は兄弟児以外の項目・他の家庭・選手のメンバー情報は変更できない（同じ子供の配偶者の兄弟児は変更できる）', r.notes === 'permission-denied' && r.mixed === 'permission-denied' && r.other === 'permission-denied' && r.player === 'permission-denied' && r.spouse === 'ok', JSON.stringify(r));

  await page.fill('#parentName', '五十嵐 真理子');
  await page.waitForTimeout(300);
  await page.locator('#sibling-group').screenshot({ path: 'sib-cars.png' });
  // 6) 自分の家庭の兄弟児は削除できる
  await page.fill('#parentName', '五十嵐 真理子');
  await page.waitForTimeout(200);
  await page.locator('#sibling-options div', { hasText: '五十嵐 はな' }).locator('.sibling-remove').click();
  await page.waitForTimeout(1500);
  const m5b = await get(`${T}/members/m5`);
  chk('保護者本人が自分の家庭の兄弟児の登録を削除できる', (m5b.siblings || []).length === 0, JSON.stringify(m5b.siblings));
  await ctx.close();
}
await closeBrowser();
process.exit(summary() ? 1 : 0);
