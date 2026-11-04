const status=document.getElementById('status'),refresh=document.getElementById('refresh');
const form=document.getElementById('credit-form'),select=document.getElementById('guide'),save=document.getElementById('save'),feedback=document.getElementById('credit-status');
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Indiana/Indianapolis'}).format(new Date());
const dateInput=document.getElementById('credit-date');
dateInput.value=today;dateInput.max=today;
let busy=false,saving=false,current=null,retry=null;
function el(tag,text,cls){
 const node=document.createElement(tag);
 if(text!==undefined)node.textContent=text;
 if(cls)node.className=cls;
 return node;
}
function familyColor(name){
 const key=String(name||'').trim().toLowerCase();
 const colors=new Map([['norah','violet'],['hailey','teal'],['nancy','blue'],['logann','amber'],['gabe','rose']]);
 if(colors.has(key))return colors.get(key);
 return [...colors.values()][Array.from(key).reduce((hash,c)=>(hash*31+c.codePointAt(0))>>>0,0)%colors.size];
}
function render(data){
 document.getElementById('semester').textContent=data.semester+' · live standings';
 current=data;
 const selected=select.value;
 select.replaceChildren(new Option('Choose a guide',''),...data.roster.map(g=>new Option(g.name+' · '+g.family,g.id)));
 if(data.roster.some(g=>g.id===selected))select.value=selected;
 save.disabled=data.stale||saving;
 const cards=[],lists=[];
 data.groups.forEach((group,i)=>{
  const id='family-'+i,card=el('a',undefined,'card');
  card.href='#'+id;
  card.dataset.color=familyColor(group.name);
  card.append(el('p','#'+group.rank,'place'),el('h3',group.name),el('p',String(group.points),'points'),el('p',group.pickups+' pickups · '+group.specialRequests+' special requests','count'));
  cards.push(card);
  const panel=el('article',undefined,'card'),list=el('ol');
  panel.id=id;
  panel.dataset.color=familyColor(group.name);
  panel.append(el('h3',group.name));
  let rank=0,previous;
  group.leaders.forEach((guide,index)=>{
   if(guide.pickups!==previous)rank=index+1;
   previous=guide.pickups;
   const row=el('li');
   row.append(el('span',guide.pickups?String(rank):'–','place'),el('span',guide.name),el('strong',guide.pickups+' P · '+guide.specialRequests+' SR'));
   list.append(row);
  });
  panel.append(el('p','P = pickups · SR = special requests','count'),group.leaders.length?list:el('p','No activity recorded.'));
  lists.push(panel);
 });
 document.getElementById('standings').replaceChildren(...cards);
 document.getElementById('leaders').replaceChildren(...lists);
 const feed=document.getElementById('feed');
 feed.replaceChildren(...data.feed.map(entry=>{
  const item=el('li',undefined,'card');
  item.dataset.color=familyColor(entry.family);
  item.append(el('strong',entry.name+' · '+entry.family),el('p',entry.units+' special request'+(entry.units===1?'':'s')+' · +'+entry.units*4+' points'),el('p',(entry.date||'Date unverified')+' · '+entry.source+(entry.note?' · '+entry.note:''),'count'));
  return item;
 }));
 if(!data.feed.length)feed.append(el('li','No special requests recorded.','card'));
 const skipped=data.unmatched+data.unassigned;
 const time=new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Indiana/Indianapolis'}).format(new Date(data.checkedAt));
 status.textContent=(data.stale?'Live source unavailable. Last verified ':'Updated ')+time+' ET'+(skipped?' · '+skipped+' pickup'+(skipped===1?' was':'s were')+' left out because the guide or active family could not be matched.':'');
 status.dataset.warning=String(data.stale);
}
async function load(force=false){
 if(busy||saving)return;
 busy=true;
 refresh.disabled=true;
 try{
  const response=await fetch('/api/standings'+(force?'?refresh=1':'')),data=await response.json();
  if(!response.ok)throw Error(data.error);
  render(data);
 }catch{
  status.textContent='Could not refresh the live standings. Any displayed totals are from the last successful check.';
  status.dataset.warning='true';
 }finally{
  busy=false;
  refresh.disabled=false;
 }
}
form.onsubmit=async event=>{
 event.preventDefault();
 if(saving||busy||!current||current.stale)return;
 saving=true;save.disabled=true;
 const values=Object.fromEntries(new FormData(form));
 const entry={...values,units:Number(values.units),semester:current.semester};
 const signature=JSON.stringify(entry);
 if(retry?.signature!==signature)retry={signature,id:crypto.randomUUID()};
 feedback.textContent='Saving…';
 try{
  const response=await fetch('/api/special-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...entry,requestId:retry.id})});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Could not save.');
  render(data);
  form.elements.units.value=1;form.elements.note.value='';
  retry=null;feedback.textContent='Saved · +'+entry.units*4+' family points.';
 }catch(error){feedback.textContent=error.message||'Could not save. Try again.';}
 finally{saving=false;save.disabled=!current||current.stale;}
};
refresh.onclick=()=>load(true);
setInterval(()=>{if(document.visibilityState==='visible')load();},60000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load();});
load();
