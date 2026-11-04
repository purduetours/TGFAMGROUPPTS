import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {onRequest} from './functions/_middleware.js';

test('Pages credits use Supabase privately, preserve retries and refresh the feed',async t=>{
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Indiana/Indianapolis'}).format(new Date()),month=Number(today.slice(5,7)),semester=(month<6?'Spring':month<9?'Summer':'Fall')+' '+today.slice(0,4);
 const csv={
  TourGuides:'username,DisplayName,full_name,family_group,profile_status\na,Alex A,Alex A,Gold,Tour Guide',
  Tours:'ƒ,Guide,Type,Direction,TGIT,Subrequest\n10/20,Alex A,9DV,CW,,Alex A+`',
  Tracker:'Name,A,B,Earlier,'+semester+',TOTAL\nAlex A,,,1,2,3',
  SpecialRequests:'Date,Guide,Type,Count\n'+today+',Alex A,Group,1'
 };
 const env={TGIS_WORKBOOK_ID:'synthetic_workbook_id_1234',FAMILY_PASSWORD:'synthetic-test-password',SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_synthetic'};
 const original=globalThis.fetch,rows=new Map();
 let requests=0,fail=false;
 globalThis.fetch=async (value,opts)=>{
  const url=new URL(value);
  if(url.hostname==='docs.google.com'){
   assert.equal(opts.headers?.apikey,undefined);
   return new Response(csv[url.searchParams.get('sheet')],{headers:{'content-type':'text/csv'}});
  }
  assert.equal(url.origin,env.SUPABASE_URL);
  assert.equal(url.pathname,'/rest/v1/tgis_family_dashboard_credits');
  assert.equal(opts.headers.apikey,env.SUPABASE_SECRET_KEY);
  assert.equal(opts.headers.Authorization,undefined);
  requests++;
  if(fail)return Response.json({detail:'internal'}, {status:503});
  if(opts.method==='POST'){
   assert.match(opts.headers.Prefer,/resolution=ignore-duplicates/);
   const e=JSON.parse(opts.body);
   if(rows.has(e.id))return Response.json([]);
   rows.set(e.id,e);
   return Response.json([e],{status:201});
  }
  const id=url.searchParams.get('id');
  return Response.json([...rows.values()].filter(e=>id?.startsWith('eq.')?e.id===id.slice(3):e.semester===url.searchParams.get('semester')?.slice(3)&&(!id||e.id>id.slice(3))));
 };
 t.after(()=>{globalThis.fetch=original;});
 const origin='https://dashboard.example.invalid',authorization='Basic '+btoa('leadership:'+env.FAMILY_PASSWORD);
 const request=(path,payload,auth=true,postOrigin=origin)=>onRequest({env,next:()=>new Response('dashboard'),request:new Request(origin+path,{method:payload?'POST':'GET',headers:{...(auth?{authorization}:{}),...(payload?{origin:postOrigin,'content-type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{})})});
 assert.equal((await request('/',null,false)).status,401);
 assert.equal(await (await request('/')).text(),'dashboard');
 assert.equal(requests,0);
 const before=await (await request('/api/standings')).json();
 assert.equal(before.groups[0].points,6);
 const entry={requestId:randomUUID(),guideId:before.roster[0].id,date:today,semester,units:2,note:'Group visit'};
 assert.equal((await request('/api/special-requests',entry,false)).status,401);
 assert.equal((await request('/api/special-requests',entry,true,'https://another.example.invalid')).status,403);
 assert.equal(rows.size,0);
 const saved=await request('/api/special-requests',entry);
 assert.equal(saved.status,201);
 const after=await saved.json();
 assert.equal(after.groups[0].points,14);
 assert.equal(after.groups[0].specialRequests,3);
 assert(after.feed.some(e=>e.source==='Dashboard'&&e.note===entry.note));
 assert(!JSON.stringify(after).includes(env.SUPABASE_SECRET_KEY));
 assert.equal((await request('/api/special-requests',entry)).status,200);
 assert.equal((await request('/api/special-requests',{...entry,units:3})).status,409);
 assert.equal(rows.size,1);
 assert.equal((await (await request('/api/standings')).json()).groups[0].points,14);
 fail=true;
 const error=await request('/api/standings');
 assert.equal(error.status,503);
 assert(!JSON.stringify(await error.json()).includes('internal'));
});
