import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE='http://127.0.0.1:5000', VENDOR=process.cwd()+'/vendor';
const R=[]; const chk=(n,ok,x='')=>{R.push(ok);console.log(`${ok?'PASS':'FAIL'} ${n}${x?' — '+x:''}`);};

const BASE_FS='http://127.0.0.1:8080/v1/projects/fc-ojimajr-hub/databases/(default)/documents';
function fv(v){if(v===null)return{nullValue:null};if(typeof v==='string')return{stringValue:v};if(typeof v==='number')return{integerValue:String(v)};if(typeof v==='boolean')return{booleanValue:v};if(Array.isArray(v))return{arrayValue:{values:v.map(fv)}};return{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,fv(x)]))}};}
async function put(p,d){const r=await fetch(`${BASE_FS}/${p}`,{method:'PATCH',headers:{'Authorization':'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:Object.fromEntries(Object.entries(d).map(([k,v])=>[k,fv(v)]))})});if(!r.ok)throw new Error(p+':'+r.status+' '+await r.text());console.log('seed',p);}
async function idp(email,name){const t=JSON.stringify({sub:'sub-'+email,email,email_verified:true,name});
  const r=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=k',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({postBody:'id_token='+encodeURIComponent(t)+'&providerId=google.com',requestUri:'http://127.0.0.1',returnSecureToken:true})});return (await r.json()).localId;}

const T='teams/fc-ojima';
const EVENT_ID = '1900000000400';
// たくさんメンバーを用意してドックを横スクロール可能にする
const names = ['颯','セナ','ジュリ','陸太','ガリ','ミナ','ユウ','レン','カイ','ソラ'];
for (let i=0;i<names.length;i++) {
  await put(`${T}/members/m${i}`, { id:'m'+i, name:names[i], role:'player', grade:'2', gender:'male' });
}
await put(`${T}/events/${EVENT_ID}`, { id:EVENT_ID, title:'横スクロール確認', date:'2026-10-20', type:'game', target:['2'], venue:'尾島グラウンド', startTime:'09:00' });
await put(`${T}/eventData/${EVENT_ID}`, {
  carRegistrations: [ { parent:'曽根父', canDrive:'both', frontSeat:1, middleSeat:2, backSeat:3, notes:'' } ],
  attendance: names.map((n,i)=>({ name:n, memberId:'m'+i, status:'present' }))
});

const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
const ctx=await browser.newContext({...devices['iPhone 13'], hasTouch:true, ignoreHTTPSErrors:true});
await ctx.addInitScript(`
  localStorage.setItem('fcojima_use_emulator','1');
  sessionStorage.setItem('fcojima_selectedEvent', ${JSON.stringify(JSON.stringify({ id: EVENT_ID, title:'横スクロール確認', date:'2026-10-20', type:'game', target:['2'], venue:'尾島グラウンド', startTime:'09:00' }))});
`);
await ctx.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:fs.readFileSync(`${VENDOR}/${r.request().url().split('/').pop()}`,'utf8'),contentType:'text/javascript'}));
await ctx.route('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/**',r=>r.fulfill({body:fs.readFileSync(`${VENDOR}/html2canvas.min.js`,'utf8'),contentType:'text/javascript'}));
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
await ctx.route('https://fonts.gstatic.com/**',r=>r.fulfill({status:404,body:''}));

const page = await ctx.newPage();
const pageErrors=[];
page.on('pageerror', e=>pageErrors.push(String(e)));

const email='scrolltest@example.com';
const uid = await idp(email,'スクロールテスト');
await fetch(`http://127.0.0.1:8080/v1/projects/fc-ojimajr-hub/databases/(default)/documents/teams/fc-ojima/users/${uid}`,{method:'PATCH',headers:{'Authorization':'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:{name:{stringValue:'スクロールテスト'},role:{stringValue:'admin'},status:{stringValue:'approved'}}})});
await page.goto(BASE+'/hub/login.html');
await page.waitForFunction(()=>window.FCOjimaFirebase&&window.FCOjimaFirebase.auth);
const tokRes = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=k',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({postBody:'id_token='+encodeURIComponent(JSON.stringify({sub:'sub-'+email,email,email_verified:true,name:'スクロールテスト'}))+'&providerId=google.com',requestUri:'http://127.0.0.1',returnSecureToken:true})});
const tok = await tokRes.json();
await page.evaluate(async (idToken)=>{
  const cred = window.firebase.auth.GoogleAuthProvider.credential(idToken);
  await window.FCOjimaFirebase.auth.signInWithCredential(cred);
}, tok.idToken).catch(e=>console.log('signin-note', e.message));
await page.waitForTimeout(2000);

await page.goto(BASE+'/carpool/assignments.html');
await page.waitForFunction(()=>document.querySelector('.car-top-view'),null,{timeout:25000}).catch(()=>{});
await page.waitForTimeout(1000);

// 全画面（キャンバス）モードへ
const fullscreenBtn = await page.$('text=全画面で作業');
await fullscreenBtn.click();
await page.waitForTimeout(1500);
await page.screenshot({path:'dock-scrollbar-visual.png'});

const dockInfo = await page.evaluate(()=>{
  const dock = document.querySelector('#canvas-members-dock .members-scroll-area');
  return dock ? { scrollWidth: dock.scrollWidth, clientWidth: dock.clientWidth, scrollLeft: dock.scrollLeft } : null;
});
console.log('dock before scroll:', JSON.stringify(dockInfo));
chk('ドックが横スクロール可能な状態になっている（scrollWidth > clientWidth）', dockInfo && dockInfo.scrollWidth > dockInfo.clientWidth, JSON.stringify(dockInfo));

// CDP経由で実タッチイベントを使って横スワイプ
const client = await ctx.newCDPSession(page);
const dockBox = await page.evaluate(()=>{
  const dock = document.querySelector('#canvas-members-dock .members-scroll-area');
  const r = dock.getBoundingClientRect();
  return { x: r.x + r.width/2, y: r.y + r.height/2 };
});

async function touchSwipe(startX, startY, endX, endY, steps=10) {
  await client.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:startX,y:startY}] });
  for (let i=1;i<=steps;i++) {
    const x = startX + (endX-startX)*i/steps;
    const y = startY + (endY-startY)*i/steps;
    await client.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[{x,y}] });
    await page.waitForTimeout(16);
  }
  await client.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
}

// 右から左へ横スワイプ（スクロールして右側のメンバーを見る動作）
await touchSwipe(dockBox.x + 100, dockBox.y, dockBox.x - 150, dockBox.y, 12);
await page.waitForTimeout(500);

const dockAfter = await page.evaluate(()=>{
  const dock = document.querySelector('#canvas-members-dock .members-scroll-area');
  return dock ? dock.scrollLeft : null;
});
console.log('dock scrollLeft after swipe:', dockAfter);
chk('横スワイプでドックが実際にスクロールする（scrollLeftが変化）', dockAfter > 20, 'scrollLeft=' + dockAfter);

// ドラッグゴースト要素が残っていないか（誤ってドラッグ扱いされていないか）
const ghostExists = await page.evaluate(()=>!!document.querySelector('body > div[style*="position:fixed"][style*="opacity:0.75"]'));
chk('横スクロール操作がドラッグゴーストを生成していない', !ghostExists);

// 座席に誤配置されていないか確認
const anySeatFilled = await page.evaluate(()=>document.querySelectorAll('.seat.filled, .driver-seat[data-person]').length > 0 ? Array.from(document.querySelectorAll('.seat.filled')).map(s=>s.dataset.person) : []);
console.log('filled seats after swipe (should be empty, driver excluded):', JSON.stringify(anySeatFilled));
chk('横スクロール操作で誤って座席に配置されていない', anySeatFilled.length === 0, JSON.stringify(anySeatFilled));

console.log('pageerrors:', JSON.stringify(pageErrors.slice(0,10)));
console.log(`\n${R.length}項目 FAIL ${R.filter(x=>!x).length}件`);
await browser.close();
