import {loadSource} from './source.mjs';
import {project} from './project.mjs';

const secure={'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json=(value,status=200)=>Response.json(value,{status,headers:secure});
const hash=async v=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
let cache={id:null,last:null,attempt:0,pending:null,stale:false};
async function base(id,force=false){
 if(cache.id!==id)cache={id,last:null,attempt:0,pending:null,stale:false};
 const slot=cache;
 if(!slot.pending&&Date.now()-slot.attempt>=(force?5000:60000)){
  slot.attempt=Date.now();
  slot.pending=loadSource(id).then(data=>{slot.last=data;slot.stale=false;},()=>{slot.stale=true;}).finally(()=>{slot.pending=null;});
 }
 if(slot.pending)await slot.pending;
 return {data:slot.last,stale:slot.stale};
}
async function input(req){
 const reader=req.body?.getReader();
 if(!reader)return null;
 let size=0,text='';const decoder=new TextDecoder();
 try{
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();return null;}text+=decoder.decode(value,{stream:true});}
  return JSON.parse(text+decoder.decode());
 }catch{return null;}
 finally{reader.releaseLock();}
}
async function output(ledger,data,stale,status=200){
 return json({...project(data,await ledger.list(data.semester)),stale},status);
}
export async function handle(req,env,ledger){
  const url=new URL(req.url);
  if(!env.FAMILY_PASSWORD||env.FAMILY_PASSWORD.length<16||!env.TGIS_WORKBOOK_ID||!ledger)return json({error:'Dashboard setup is incomplete.'},503);
  const [expected,actual]=await Promise.all([hash('Basic '+btoa('leadership:'+env.FAMILY_PASSWORD)),hash(req.headers.get('authorization')||'')]);
  let diff=0;for(let i=0;i<expected.length;i++)diff|=expected[i]^actual[i];
  if(diff)return new Response('Sign in required',{status:401,headers:{...secure,'WWW-Authenticate':'Basic realm="Family Points", charset="UTF-8"'}});
  if(req.headers.get('sec-fetch-site')==='cross-site')return json({error:'Request not allowed.'},403);
  try{
   if(req.method==='GET'&&url.pathname==='/api/standings'){
    const {data,stale}=await base(env.TGIS_WORKBOOK_ID,url.searchParams.get('refresh')==='1');
    return data?await output(ledger,data,stale):json({error:'The live TGIS source is unavailable. Try again shortly.'},503);
   }
   if(req.method==='POST'&&url.pathname==='/api/special-requests'){
    if(req.headers.get('origin')!==url.origin||!/^application\/json(?:;|$)/i.test(req.headers.get('content-type')||''))return json({error:'Request not allowed.'},403);
    const entry=await input(req),{data,stale}=await base(env.TGIS_WORKBOOK_ID);
    if(!data||stale)return json({error:'Refresh the live roster before adding a request.'},409);
    const guide=data.roster.find(g=>g.id===entry?.guideId),date=entry?.date,units=entry?.units,note=typeof entry?.note==='string'?entry.note.trim():null;
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Indiana/Indianapolis'}).format(new Date());
    const term=/^(Fall|Spring|Summer) (\d{4})$/i.exec(data.semester),ranges={fall:[7,12],spring:[1,5],summer:[5,8]};
    if(!guide||entry?.semester!==data.semester||!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>today||!Number.isInteger(units)||units<1||units>20||note===null||note.length>200||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(entry?.requestId||''))return json({error:'Choose a current guide, a valid past or current date, and 1–20 completed requests.'},400);
    const month=Number(date.slice(5,7));
    if(!term||date.slice(0,4)!==term[2]||month<ranges[term[1].toLowerCase()][0]||month>ranges[term[1].toLowerCase()][1])return json({error:'Choose a date within the current semester.'},400);
    const inserted=await ledger.add({id:entry.requestId,semester:data.semester,guideId:guide.id,name:guide.name,family:guide.family,date,units,note,createdAt:new Date().toISOString()});
    if(!inserted){
     const old=await ledger.get(entry.requestId);
     if(!old||old.guideId!==guide.id||old.semester!==data.semester||old.date!==date||old.units!==units||old.note!==note)return json({error:'That request was already used for a different entry.'},409);
    }
    return await output(ledger,data,false,inserted?201:200);
   }
   if(req.method!=='GET')return json({error:'Method not allowed.'},405);
   if(!['/','/index.html','/dashboard.css','/dashboard.js'].includes(url.pathname))return json({error:'Not found.'},404);
   const asset=await env.ASSETS.fetch(req),headers=new Headers(asset.headers);
   for(const [key,value] of Object.entries(secure))headers.set(key,value);
   return new Response(asset.body,{status:asset.status,headers});
  }catch{return json({error:'The dashboard could not complete the request. Try again shortly.'},503);}
}

export default {
 fetch(req,env){
  const db=env.DB;
  const ledger=db?{
   async list(semester){return (await db.prepare('SELECT * FROM special_requests WHERE semester = ?').bind(semester).all()).results;},
   get(id){return db.prepare('SELECT * FROM special_requests WHERE id = ?').bind(id).first();},
   async add(e){return !!(await db.prepare('INSERT INTO special_requests (id,semester,guideId,name,family,date,units,note,createdAt) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(e.id,e.semester,e.guideId,e.name,e.family,e.date,e.units,e.note,e.createdAt).run()).meta.changes;}
  }:null;
  return handle(req,env,ledger);
 }
};
