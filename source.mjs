const norm=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
const header=value=>norm(value).replace(/[^a-z0-9]/g,'');
const clean=value=>String(value||'').replace(/[*+`~]/g,'').trim();
const positiveCount=value=>{const s=String(value||'').replace(/,/g,'').trim(),n=Number(s);return s&&Number.isSafeInteger(n)&&n>=0?n:1;};
export function csv(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}
  else if(c==='"'&&!cell)quoted=true;
  else if(c===','){row.push(cell);cell='';}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 if(quoted)throw Error('Invalid CSV');
 row.push(cell);if(row.some(Boolean))rows.push(row);
 return rows;
}
const specs={TourGuides:['A1:E10002','A,B,C,D,E'],Tours:['A1:F10002'],Tracker:['A1:AZ10002'],SpecialRequests:['A1:D10002']};
const types=new Set(["9DV","0DV","0GV","1DV","2DV","2GV","8PA","1PA","2PA","1PF","EPF"]);
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
async function read(id,tab,fetcher){
 const [range,select]=specs[tab],url=new URL('https://docs.google.com/spreadsheets/d/'+id+'/gviz/tq');
 url.search=new URLSearchParams({tqx:'out:csv',sheet:tab,range,headers:'1',...(select?{tq:'select '+select}:{})});
 const res=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(!res.ok||!res.headers.get('content-type')?.includes('text/csv'))throw Error('Source unavailable');
 let size=0,text='';const decoder=new TextDecoder();
 for await(const bytes of res.body){size+=bytes.length;if(size>3000000)throw Error('Source too large');text+=decoder.decode(bytes,{stream:true});}
 const rows=csv((text+decoder.decode()).replace(/^\uFEFF/,''));
 if(!rows.length||rows.length>10001)throw Error('Invalid source rows');
 return rows;
}
function verifiedDate(value){
 const text=String(value||'').trim();
 const iso=/^\d{4}-\d{2}-\d{2}$/.test(text)?text:null;
 const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
 const date=iso||(m?m[3]+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0'):null);
 return date&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date?date:null;
}
export async function loadSource(id,fetcher=fetch){
 if(!/^[\w-]{20,128}$/.test(id||''))throw Error('Source is not configured');
 const [guideTable,tours,tracker,special]=await Promise.all(Object.keys(specs).map(tab=>read(id,tab,fetcher)));
 const h=guideTable[0].map(header),th=tours[0].map(header),sh=special[0].map(header),total=tracker[0].findIndex(x=>norm(x)==='total'),semester=String(tracker[0][total-1]||'').trim();
 const official=['date','tourdate'].includes(th[0])||tours[0][0]?.trim()==='ƒ';
 const separate=official&&th[3]==='direction'&&['tgit','tgitusername'].includes(th[4])&&th[5]==='subrequest';
 if(!['username','user','tgitusername'].includes(h[0])||!['displayname','guidename','name'].includes(h[1])||!['family','familygroup'].includes(h[3])||!['date','tourdate'].includes(sh[0])||(!separate&&!['date','tourdate'].includes(th[0]))||!['guide','guidename','name'].includes(th[1])||!['type','tourtype'].includes(th[2])||total<4||!semester)throw Error('Source headers could not be verified');
 const guides=await Promise.all(guideTable.slice(1).filter(r=>r[0]&&r[1]).map(async r=>({id:await digest(id+'\0'+norm(r[0])+'\0'+norm(r[1])),username:r[0],displayName:r[1],name:(r[2]||r[1]).trim(),family:(r[3]||'').trim(),active:norm(r[4])!=='retired',pickups:0,specialRequests:0})));
 const match=name=>guides.filter(g=>[g.username,g.displayName,g.name].some(x=>norm(x)===norm(clean(name))));
 let unmatched=0,unassigned=0;
 const feed=[];
 for(const row of tours.slice(1)){
  const guide=(separate&&row[5]?.trim())||row[1];
  if(!row[0]||!types.has(row[2]?.trim())||!guide?.includes('+'))continue;
  const matches=match(guide);
  if(matches.length!==1){unmatched++;continue;}
  const person=matches[0];
  if(!person.active||!person.family){unassigned++;continue;}
  person.pickups++;
 }
 for(const row of special.slice(1)){
  const matches=match(row[1]);
  if(matches.length!==1)continue;
  const person=matches[0];
  if(!person.active||!person.family||norm(person.displayName)!==norm(row[1]))continue;
  const units=positiveCount(row[3]);
  person.specialRequests+=units;
  feed.push({name:person.name,family:person.family,date:verifiedDate(row[0]),units,note:row[2]||'',source:'TGIS sheet'});
 }
 const groups=new Map(),roster=[];
 for(const g of guides.filter(g=>g.active&&g.family)){
  roster.push({id:g.id,name:g.name,family:g.family});
  const key=norm(g.family);
  if(!groups.has(key))groups.set(key,{name:g.family,points:0,pickups:0,specialRequests:0,leaders:[]});
  const family=groups.get(key);
  family.pickups+=g.pickups;
  family.specialRequests+=g.specialRequests;
  family.points+=g.pickups*2+g.specialRequests*4;
  family.leaders.push({id:g.id,name:g.name,pickups:g.pickups,specialRequests:g.specialRequests});
 }
 return {semester,checkedAt:new Date().toISOString(),groups:[...groups.values()],roster:roster.sort((a,b)=>a.name.localeCompare(b.name)),feed,unmatched,unassigned};
}
