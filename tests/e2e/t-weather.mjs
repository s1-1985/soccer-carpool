// 会場の天気: 活動する時間帯（出発・開始〜終了、未設定なら日中）の天気・降水確率で表示する
import fs from 'fs';
import { put, wipe, makeUser, context, chk, summary, closeBrowser, BASE, T, watchErrors } from './lib.mjs';
const WX = new URL('./wx/', import.meta.url).pathname;
await wipe();
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const fc = JSON.parse(fs.readFileSync(WX + 'forecast.json', 'utf8'));
const EV = '1900000050001';
await put(`${T}/venues/v1`, { name: '笠懸球技場', address: '群馬県みどり市笠懸町鹿' });
await put(`${T}/events/${EV}`, { title: '笠懸', date: '2026-10-24', type: 'game', target: ['年長', '1', '2'], departureTime: '07:30', meetingPlace: '尾島小学校', venue: '笠懸球技場' });
await makeUser('wx@example.com', '天気管理者', 'admin');
const mob = { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const ctx = await context({ email: 'wx@example.com', name: '天気管理者', device: mob });
const page = await ctx.newPage();
const errs = watchErrors(page);
const reqs = [];
await page.route('https://msearch.gsi.go.jp/**', r => r.fulfill({ body: fs.readFileSync(WX + 'gsi.json', 'utf8'), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } }));
await page.route('https://api.open-meteo.com/**', r => { reqs.push(r.request().url()); r.fulfill({ body: JSON.stringify(fc), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } }); });
await page.goto(BASE + '/hub/index.html');
await page.waitForFunction(() => window.FCOjima && FCOjima.Hub && FCOjima.Hub._eventsUnsub, null, { timeout: 30000 });
await page.waitForTimeout(800);
await page.evaluate(id => FCOjima.Hub.Calendar.showEventDetails(id), EV);
await page.waitForSelector('.weather-widget .weather-day', { timeout: 10000 });
const w = await page.evaluate(() => ({
  days: [...document.querySelectorAll('.weather-widget .weather-day')].map(d => d.querySelector('.wd-date').textContent + ' ' + d.querySelector('.wd-emoji').textContent + ' ' + d.title + ' ' + d.querySelector('.wd-pop').textContent),
  foot: document.querySelector('.weather-precision').textContent
}));
console.log(JSON.stringify(w, null, 1));
// 予報データは 2026-10-17 に取得したもの。表示は予報データの日付で決まるため、今日の日付には依らない
console.log('today', today);
chk('時間別の予報も取得している', reqs.some(u => /hourly=weather_code,precipitation_probability/.test(u)), reqs[0]);
const by = md => w.days.find(d => d.startsWith(md)) || '';
chk('夜だけ雨の日は雨マークにならない（10/19 晴れ・10/20 曇り・10/21 晴れ）', /🌤️ 晴れ/.test(by('10/19')) && /☁️ 曇り/.test(by('10/20')) && /🌤️ 晴れ/.test(by('10/21')) && /🌤️ 晴れ/.test(by('10/22')), JSON.stringify(w.days));
chk('降水確率も活動時間帯の値（10/21 は 15%・10/22 は 4%）', /💧15%/.test(by('10/21')) && /💧4%/.test(by('10/22')), '');
chk('日中も雨の当日は雨', /🌧️ 弱い雨/.test(by('10/24')), by('10/24'));
chk('どの時間帯の予報か表示される（出発 7:30 → 7〜18時）', w.foot === '📍 会場周辺・7〜18時の予報', w.foot);
const ov = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const foot = document.querySelector('.weather-widget-foot');
  return [...foot.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > vw).length + (foot.scrollWidth > foot.clientWidth + 1 ? 1 : 0);
});
chk('360px で天気の欄がはみ出さない', ov === 0, String(ov));
await page.locator('.weather-widget').screenshot({ path: 'wx-widget.png' });
const bad = errs.filter(e => !/favicon|ERR_|Failed to load resource|storage/i.test(e));
chk('ページエラーなし', bad.length === 0, JSON.stringify(bad.slice(0, 3)));
await closeBrowser();
process.exit(summary() ? 1 : 0);
