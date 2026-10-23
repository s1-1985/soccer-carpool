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
// 前のテストのデータ（監督・コーチなど）が残っていると、ドックの先頭が別の人になるため最初に消す
await fetch('http://127.0.0.1:8080/emulator/v1/projects/fc-ojimajr-hub/databases/(default)/documents', { method: 'DELETE' });
await fetch('http://127.0.0.1:9099/emulator/v1/projects/fc-ojimajr-hub/accounts', { method: 'DELETE' });
const EVENT_ID = '1900000000401';
await put(`${T}/members/d0`, { id:'d0', name:'ドラッグ太郎', role:'player', grade:'2', gender:'male' });
await put(`${T}/events/${EVENT_ID}`, { id:EVENT_ID, title:'ドラッグ確認', date:'2026-10-20', type:'game', target:['2'], venue:'尾島グラウンド', startTime:'09:00' });
await put(`${T}/eventData/${EVENT_ID}`, {
  carRegistrations: [ { parent:'曽根父', canDrive:'both', frontSeat:1, middleSeat:2, backSeat:3, notes:'' } ],
  attendance: [ { name:'ドラッグ太郎', memberId:'d0', status:'present' } ]
});

const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
const ctx=await browser.newContext({...devices['iPhone 13'], hasTouch:true, ignoreHTTPSErrors:true});
await ctx.addInitScript(`
  localStorage.setItem('fcojima_use_emulator','1');
  sessionStorage.setItem('fcojima_selectedEvent', ${JSON.stringify(JSON.stringify({ id: EVENT_ID, title:'ドラッグ確認', date:'2026-10-20', type:'game', target:['2'], venue:'尾島グラウンド', startTime:'09:00' }))});
`);
await ctx.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:fs.readFileSync(`${VENDOR}/${r.request().url().split('/').pop()}`,'utf8'),contentType:'text/javascript'}));
await ctx.route('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/**',r=>r.fulfill({body:fs.readFileSync(`${VENDOR}/html2canvas.min.js`,'utf8'),contentType:'text/javascript'}));
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
await ctx.route('https://fonts.gstatic.com/**',r=>r.fulfill({status:404,body:''}));

const page = await ctx.newPage();
const email='dragtest@example.com';
const uid = await idp(email,'ドラッグテスト');
await fetch(`http://127.0.0.1:8080/v1/projects/fc-ojimajr-hub/databases/(default)/documents/teams/fc-ojima/users/${uid}`,{method:'PATCH',headers:{'Authorization':'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:{name:{stringValue:'ドラッグテスト'},role:{stringValue:'admin'},status:{stringValue:'approved'}}})});
await page.goto(BASE+'/hub/login.html');
await page.waitForFunction(()=>window.FCOjimaFirebase&&window.FCOjimaFirebase.auth);
const tokRes = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=k',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({postBody:'id_token='+encodeURIComponent(JSON.stringify({sub:'sub-'+email,email,email_verified:true,name:'ドラッグテスト'}))+'&providerId=google.com',requestUri:'http://127.0.0.1',returnSecureToken:true})});
const tok = await tokRes.json();
await page.evaluate(async (idToken)=>{
  const cred = window.firebase.auth.GoogleAuthProvider.credential(idToken);
  await window.FCOjimaFirebase.auth.signInWithCredential(cred);
}, tok.idToken).catch(e=>console.log('signin-note', e.message));
await page.waitForTimeout(2000);

await page.goto(BASE+'/carpool/assignments.html');
await page.waitForFunction(()=>document.querySelector('.car-top-view'),null,{timeout:25000}).catch(()=>{});
await page.waitForTimeout(1000);
const fullscreenBtn = await page.$('text=全画面で作業');
await fullscreenBtn.click();
await page.waitForTimeout(1500);

const client = await ctx.newCDPSession(page);
const memberBox = await page.evaluate(()=>{
  const el = document.querySelector('#canvas-members-dock .member-item');
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width/2, y: r.y + r.height/2 };
});
const seatBox = await page.evaluate(()=>{
  const el = document.querySelector('.seat[data-seat-type="中列"][data-seat-index="0"]');
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width/2, y: r.y + r.height/2 };
});
console.log('memberBox', JSON.stringify(memberBox), 'seatBox', JSON.stringify(seatBox));

async function touchSwipe(startX, startY, endX, endY, steps=12) {
  await client.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:startX,y:startY}] });
  for (let i=1;i<=steps;i++) {
    const x = startX + (endX-startX)*i/steps;
    const y = startY + (endY-startY)*i/steps;
    await client.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[{x,y}] });
    await page.waitForTimeout(16);
  }
  await client.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
}

// 縦（上方向）主体のドラッグでメンバーを座席へ
await touchSwipe(memberBox.x, memberBox.y, seatBox.x, seatBox.y, 15);
await page.waitForTimeout(800);

const result = await page.evaluate(()=>{
  const seat = document.querySelector('.seat[data-seat-type="中列"][data-seat-index="0"]');
  return { person: seat ? seat.dataset.person : null };
});
console.log('result:', JSON.stringify(result));
chk('縦方向優位のドラッグでメンバーが座席に配置される（回帰確認）', result.person === 'ドラッグ太郎', JSON.stringify(result));

console.log(`\n${R.length}項目 FAIL ${R.filter(x=>!x).length}件`);
await browser.close();
