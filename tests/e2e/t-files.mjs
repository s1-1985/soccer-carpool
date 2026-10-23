import { makeUser, context, chk, summary, closeBrowser, BASE } from './lib.mjs';
await makeUser('r3admin@example.com', '管理者', 'admin');
const ctx = await context({ email: 'r3admin@example.com', name: '管理者', device: null });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());
await page.goto(BASE + '/hub/index.html');
await page.waitForFunction(() => window.FCOjima && FCOjima.EventFiles && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
const res = await page.evaluate(async () => {
  const id = 'filetest' + Date.now();
  const mk = (txt) => new File([txt], '案内.pdf', { type: 'application/pdf' });
  await FCOjima.EventFiles.upload(id, [mk('one')], null);
  await FCOjima.EventFiles.upload(id, [mk('two')], null);
  await FCOjima.EventFiles.upload(id, [mk('three'), new File(['x'], 'memo.txt')], null);
  return (await FCOjima.EventFiles.listNames(id)).sort();
});
chk('同じ名前のファイルを添付しても上書きされず、名前をずらして保存される', JSON.stringify(res) === JSON.stringify(['memo.txt', '案内 (2).pdf', '案内 (3).pdf', '案内.pdf']), JSON.stringify(res));
await closeBrowser();
process.exit(summary() ? 1 : 0);
