export function supabaseLedger(env,fetcher=fetch){
 const origin=env.SUPABASE_URL,key=env.SUPABASE_SECRET_KEY;
 if(!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(origin||'')||!/^sb_secret_[A-Za-z0-9_-]+$/.test(key||''))return null;
 const endpoint=new URL('/rest/v1/tgis_family_dashboard_credits',origin);
 async function request(query,entry){
  const url=new URL(endpoint);
  url.search=new URLSearchParams(query);
  const response=await fetcher(url,{
   method:entry?'POST':'GET',
   headers:{apikey:key,Accept:'application/json',...(entry?{'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=representation'}:{})},
   ...(entry?{body:JSON.stringify(entry)}:{}),
   redirect:'error',
   signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)throw Error('Credit storage unavailable');
  const rows=await response.json();
  if(!Array.isArray(rows))throw Error('Unexpected credit storage response');
  return rows;
 }
 return {
  async list(semester){
   const result=[];
   let cursor;
   for(let page=0;page<100;page++){
    const rows=await request({semester:'eq.'+semester,select:'*',order:'id.asc',limit:'500',...(cursor?{id:'gt.'+cursor}:{})});
    if(!rows.length)return result;
    const last=rows.at(-1).id;
    if(typeof last!=='string'||last===cursor)throw Error('Credit storage pagination failed');
    result.push(...rows);
    cursor=last;
   }
   throw Error('Too many credits for one semester');
  },
  async get(id){return (await request({id:'eq.'+id,limit:'1'}))[0]||null;},
  async add(entry){return (await request({on_conflict:'id'},entry)).length===1;}
 };
}
