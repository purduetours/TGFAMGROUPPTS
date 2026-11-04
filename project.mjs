export function project(base,entries){
 const view=structuredClone(base);
 for(const entry of entries.filter(e=>e.semester===base.semester)){
  let group=view.groups.find(g=>g.name.toLowerCase()===entry.family.toLowerCase());
  if(!group){group={name:entry.family,points:0,pickups:0,specialRequests:0,leaders:[]};view.groups.push(group);}
  let guide=group.leaders.find(g=>g.id===entry.guideId);
  if(!guide){guide={id:entry.guideId,name:entry.name,pickups:0,specialRequests:0};group.leaders.push(guide);}
  guide.specialRequests+=entry.units;
  group.specialRequests+=entry.units;
  group.points+=entry.units*4;
  view.feed.push({...entry,source:'Dashboard'});
 }
 view.groups.sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name));
 view.groups.forEach((group,i)=>{
  group.rank=i&&group.points===view.groups[i-1].points?view.groups[i-1].rank:i+1;
  group.leaders=group.leaders.filter(g=>g.pickups||g.specialRequests).sort((a,b)=>b.pickups-a.pickups||b.specialRequests-a.specialRequests||a.name.localeCompare(b.name));
 });
 view.feed.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.createdAt||'').localeCompare(a.createdAt||''));
 view.feed=view.feed.slice(0,100);
 return view;
}

