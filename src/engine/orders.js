// COMPANY · src/engine/orders.js
// Orders given to units: move, attack-move, hold, queues, fire missions, deployment, undo.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
const mine=()=>G?G.units.filter(u=>u.side===G.player):[];
const selected=()=>mine().filter(u=>u.sel);
// The nearest point on any trench to (x, y), within maxD: {t: trench, s: distance along it, d}. With a side, only
// stretches that side knows of count (an attacker's order doesn't snap to a trench it hasn't seen).
function trenchNear(x,y,maxD,side){let best=null;for(const t of G.trenches){let s0=0;for(let k=0;k<t.length-1;k++){const a=t[k],b=t[k+1],L=dist(a,b);
  if(L>0&&(!side||trenchKnown(side,a,b))){const f=clamp(((x-a.x)*(b.x-a.x)+(y-a.y)*(b.y-a.y))/(L*L),0,1),px=a.x+(b.x-a.x)*f,py=a.y+(b.y-a.y)*f,d=Math.hypot(px-x,py-y);
    if(d<=maxD&&(!best||d<best.d))best={t,s:s0+f*L,d};}s0+=L;}}return best;}
function trenchAt(t,s){for(let k=0;k<t.length-1;k++){const a=t[k],b=t[k+1],L=dist(a,b);if(s<=L||k===t.length-2){const f=L?clamp(s/L,0,1):0;return{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};}s-=L;}return t[0];}
// Spots along a trench for n units, TRENCH.gap apart, centred on the point clicked and kept within the trench's ends
// (closer together if the trench is short). Units are matched to spots in order along the trench, so they don't cross.
function trenchSpots(units,hit){const t=hit.t,L=polyLen(t),n=units.length,gap=Math.min(TRENCH.gap,L/Math.max(1,n)),span=gap*(n-1);
  const s0=clamp(hit.s-span/2,0,Math.max(0,L-span)),a=trenchAt(t,0),b=trenchAt(t,L),ux=b.x-a.x,uy=b.y-a.y;
  const ord=units.slice().sort((p,q)=>(p.x*ux+p.y*uy)-(q.x*ux+q.y*uy)),out=new Map();ord.forEach((u,k)=>out.set(u,trenchAt(t,s0+gap*k)));return out;}
function order(units,x,y,mode,direct){if(!units.length)return;x=clamp(x,4,W-4);y=clamp(y,4,H-4);const me=units[0].side;
  if(G.phase==='deploy')return deployMove(units,x,y);
  if(G.phase!=='play')return;
  if(mode==='fire'){const arts=units.filter(u=>u.type==='art');if(!arts.length){tellTo(me,'Select artillery to call a fire mission','a');return false;}
    for(const a of arts){a.fireAt={x,y};a.queue=null;const d=dist(a,a.fireAt),R=TYPES.art.range;
      if(d>rangeOf(a)*.97){const k=(d-R*.85)/d;route(a,a.x+(x-a.x)*k,a.y+(y-a.y)*k,'move');tellTo(me,'Artillery moving into range for the fire mission',me==='A'?'':'d');}
      else if(d<TYPES.art.minRange){tellTo(me,'Too close for artillery to fire','a');a.fireAt=null;}
      else{a.path=[];a.mode='idle';}}
    return true;}
  if(mode==='repair'){const engs=units.filter(u=>u.type==='eng');if(!engs.length){tellTo(me,'Select engineers to repair a road','a');return false;}
    if(G.bridges.some(b=>b.down&&Math.hypot(b.x-x,b.y-y)<60)){tellTo(me,'Bridges can\'t be repaired. Build a pontoon instead (P)','a');return false;}
    if(!G.dmgList.some(i=>{const c=cc(i);return Math.hypot(c.x-x,c.y-y)<=90;})){tellTo(me,'No cratered road there','a');return false;}
    for(const u of engs){startRepair(u,x,y);const i=nearestDamage(u);if(i>=0){const c=cc(i);route(u,c.x,c.y,'move');}}return true;}
  if(mode==='bridge'){const engs=units.filter(u=>u.type==='eng');if(!engs.length){tellTo(me,'Select engineers to build a pontoon bridge','a');return false;}
    const site=startPontoon(engs[0].side,x,y);if(!site)return false;let ok=0;for(const u of engs)if(assignBuild(u,site))ok++;
    if(!ok&&!site.progress)G.pontoons.splice(G.pontoons.indexOf(site),1);return ok>0;}
  const cx=units.reduce((s,u)=>s+u.x,0)/units.length,cy=units.reduce((s,u)=>s+u.y,0)/units.length;
  let fail=0;const th=trenchNear(x,y,TRENCH.snap,me),spots=th?trenchSpots(units,th):null;
  for(const type of UNIT_TYPES){const grp=units.filter(u=>u.type===type);if(!grp.length)continue;
    const ti=nearestPassable(type,x,y),fd=flowField(type,ti,direct);
    for(const u of grp){let ox=u.x-cx,oy=u.y-cy;const L=Math.hypot(ox,oy),lim=Math.min(L*.6,70);if(L>0){ox=ox/L*lim;oy=oy/L*lim;}
      const sp=spots&&spots.get(u),dx=sp?sp.x:clamp(x+ox,4,W-4),dy=sp?sp.y:clamp(y+oy,4,H-4),p=direct?descendDirect(type,fd,u.x,u.y):descend(type,fd,u.x,u.y);if(!p){fail++;continue;}
      u.path=finish(type,p,u,dx,dy,ti);u.mode=mode;u.direct=!!direct;u.build=null;u.repair=null;u.queue=null;if(type==='art')u.fireAt=null;}}
  if(fail)tellTo(me,'No route there for some units','a');return true;}
function deployMove(units,x,y){const cx=units.reduce((s,u)=>s+u.x,0)/units.length,cy=units.reduce((s,u)=>s+u.y,0)/units.length;let bad=0;
  const th=trenchNear(x,y,TRENCH.snap),spots=th?trenchSpots(units,th):null;
  for(const u of units){let ox=u.x-cx,oy=u.y-cy;const L=Math.hypot(ox,oy),lim=Math.min(L,22+units.length*4);if(L>0){ox=ox/L*lim;oy=oy/L*lim;}
    const sp=spots&&spots.get(u),p=sp&&mult(u.type,cellOf(sp.x,sp.y))>0?{x:sp.x,y:sp.y}:cc(nearestPassable(u.type,x+ox,y+oy));if(!inZone(p.x,p.y)){bad++;continue;}u.x=p.x;u.y=p.y;u.path=[];if(u.post)u.post={x:u.x,y:u.y};if(u.home)u.home={x:u.x,y:u.y};}
  // supply is otherwise only worked out while the battle runs, so recheck it now (outlines update as units are placed)
  computeSupply('A');computeSupply('D');
  if(bad)tellTo(units[0].side,'Units can only deploy north of the dashed line','a');return true;}
function hold(units){if(!units.length)return;pushUndo(units);for(const u of units){u.path=[];u.mode='hold';u.queue=null;}}
// Shift-click queues a move or attack-move after each unit's current orders (as in Hearts of Iron). An idle unit starts
// at once. The formation is kept by offsetting each unit's point from the centre of where the units' orders end.
function queueOrder(units,x,y,mode,direct){x=clamp(x,4,W-4);y=clamp(y,4,H-4);
  const ends=units.map(u=>u.queue&&u.queue.length?u.queue[u.queue.length-1]:u.path.length?u.path[u.path.length-1]:u);
  const cx=ends.reduce((s,e)=>s+e.x,0)/ends.length,cy=ends.reduce((s,e)=>s+e.y,0)/ends.length;
  units.forEach((u,k)=>{let ox=ends[k].x-cx,oy=ends[k].y-cy;const L=Math.hypot(ox,oy),lim=Math.min(L*.6,70);if(L>0){ox=ox/L*lim;oy=oy/L*lim;}
    const leg={x:clamp(x+ox,4,W-4),y:clamp(y+oy,4,H-4),fx:x,fy:y,mode,direct:!!direct};
    if(!u.path.length&&!(u.queue&&u.queue.length)){u.build=null;u.repair=null;if(u.type==='art')u.fireAt=null;route(u,leg.x,leg.y,mode,x,y,direct);}
    else(u.queue=u.queue||[]).push(leg);});
  return true;}
// Player actions push an undo entry: a snapshot of the units an order touched, or a trench and the budget it spent.
// Undoing an order restores each unit's route and mode (and its position during deployment, where orders teleport).
function pushUndo(units){G.undo.push({side:units[0]&&units[0].side,units:units.map(u=>({u,x:u.x,y:u.y,path:u.path.slice(),queue:u.queue?u.queue.slice():null,mode:u.mode,fireAt:u.fireAt,post:u.post,home:u.home,build:u.build,buildEnd:u.buildEnd,buildFrom:u.buildFrom,repair:u.repair}))});
  if(G.undo.length>50)G.undo.shift();}
// (each side undoes only its own orders: in multiplayer both players' orders share the stack)
function undo(side){let k=G.undo.length-1;while(k>=0&&G.undo[k].side&&G.undo[k].side!==side)k--;const e=k>=0?G.undo.splice(k,1)[0]:null;if(!e){tellTo(side,'Nothing to undo','a');return;}
  if(e.trench){for(const t of e.trench){G.trenches.splice(G.trenches.indexOf(t),1);G.userTrench.splice(G.userTrench.indexOf(t),1);}
    G.budget+=e.spent;rebuildTrenchMask();updateBudget();return;}
  for(const s of e.units){const u=s.u;if(!G.units.includes(u))continue;u.path=s.path;u.queue=s.queue;u.mode=s.mode;u.fireAt=s.fireAt;u.build=s.build;u.buildEnd=s.buildEnd;u.buildFrom=s.buildFrom;u.repair=s.repair;
    if(G.phase==='deploy'){u.x=s.x;u.y=s.y;u.post=s.post;u.home=s.home;}}
  // a pontoon site that nobody has started and nobody is assigned to goes away with the order that made it
  G.pontoons=G.pontoons.filter(p=>p.done||p.progress>0||G.units.some(u=>u.build===p.id));}

