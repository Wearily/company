// COMPANY · src/engine/crossings.js
// Bridges, pontoons, road damage and repair, air strikes.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
const crossings=()=>[...G.bridges.filter(b=>!b.down),...G.pontoons];
// only intact bridges and finished pontoons can be targeted or destroyed from the air; an unbuilt site has nothing to hit yet
const strikable=()=>[...G.bridges.filter(b=>!b.down),...G.pontoons.filter(p=>p.done)];
function crossingEnds(c){if(c.a)return[c.a,c.b];const dx=Math.cos(c.ang)*c.len/2,dy=Math.sin(c.ang)*c.len/2;return[{x:c.x-dx,y:c.y-dy},{x:c.x+dx,y:c.y+dy}];}
function segDist(p,a,b){const vx=b.x-a.x,vy=b.y-a.y,L=vx*vx+vy*vy||1,t=clamp(((p.x-a.x)*vx+(p.y-a.y)*vy)/L,0,1);return Math.hypot(p.x-a.x-vx*t,p.y-a.y-vy*t);}
const crossingName=c=>c.a?'pontoon bridge near '+placeName(c):dist(c,G.objs[0])<40?G.objs[0].name:'the bridge near '+placeName(c);
// Rebuild M.road from the untouched grid plus this game's fallen bridges and finished pontoons (road flag 4).
function applyCrossings(){M.road.set(M.road0);for(const b of G.bridges)if(b.down)for(const i of b.cells)M.road[i]=0;
  for(const p of G.pontoons)if(p.done)for(const i of p.cells)if(!M.road[i])M.road[i]=4;fieldCache.clear();}
// After crossings fall: units standing on them are thrown to the bank and hurt (25%), and routes over them are replanned.
function crossingsFell(cut){applyCrossings();G.acc.sup=0;const lost={A:0,D:0};
  const crosses=u=>{let a=u;for(const b of u.path){const n=Math.ceil(dist(a,b)/4);for(let k=1;k<=n;k++)if(cut.has(cellOf(a.x+(b.x-a.x)*k/n,a.y+(b.y-a.y)*k/n)))return true;a=b;}return false;};
  for(const u of G.units){if(cut.has(cellOf(u.x,u.y))){const p=cc(nearestPassable(u.type,u.x,u.y));u.x=p.x;u.y=p.y;hit(u,u.max*.25);}
    if(!u.path.length||!crosses(u))continue;const e=u.path[u.path.length-1];
    if(!route(u,e.x,e.y,u.mode==='hold'||u.mode==='idle'?'move':u.mode)){u.path=[];u.mode='idle';lost[u.side]++;}}
  tell(r=>lost[r]?[`${lost[r]} unit${lost[r]>1?'s':''} lost their route across the river`,'a']:null);}
// A pontoon runs along the river's normal from bank to bank. Returns null where the river is too wide or a crossing is close.
function pontoonSite(x){if(!M.wet)return{err:'There is no river to bridge on this map'};x=clamp(x,30,W-30);const cy=M.ry(x),t=(M.ry(x+8)-M.ry(x-8))/16,L=Math.hypot(1,t),nx=-t/L,ny=1/L;
  const bank=s=>{let k=0;while(k<300&&M.water(x+nx*k*s,cy+ny*k*s))k+=2;return{x:x+nx*(k+8)*s,y:cy+ny*(k+8)*s};};
  const a=bank(-1),b=bank(1),c={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  if(dist(a,b)>PONTOON.maxLen)return{err:'The river is too wide to bridge there'};
  if([a,b].some(q=>q.x<4||q.x>W-4||!mult('inf',cellOf(q.x,q.y))))return{err:'No landing on the far bank there'};
  if(crossings().some(o=>dist(o,c)<35))return{err:'Too close to another crossing'};
  // two lanes, each a 4-connected cell chain (diagonal steps can't cut corners), so columns don't jam on the deck
  const set=new Set(),n=Math.ceil(dist(a,b)/2),L2=dist(a,b),px=-(b.y-a.y)/L2,py=(b.x-a.x)/L2;
  for(const off of [-4,4]){let prev=-1;for(let k=0;k<=n;k++){const i=cellOf(a.x+(b.x-a.x)*k/n+px*off,a.y+(b.y-a.y)*k/n+py*off);if(i===prev)continue;
    if(prev>=0&&i%GW!==prev%GW&&Math.floor(i/GW)!==Math.floor(prev/GW))set.add(Math.floor(prev/GW)*GW+i%GW);set.add(i);prev=i;}}
  const cells=[...set];
  return{x:c.x,y:c.y,a,b,cells,progress:0,done:false,from:null};}
// Start a pontoon at a river point, or join an unfinished one of the same side close by.
function startPontoon(side,x,y,quiet){if(!M.wet){if(!quiet)tellTo(side,'There is no river to bridge on this map','a');return null;}if(Math.abs(y-M.ry(x))>M.rw(x)/2+60){if(!quiet)tellTo(side,'Click on the river to place a pontoon bridge','a');return null;}
  // a click anywhere along an unfinished site of ours (its dashed outline) joins it
  const near=G.pontoons.find(p=>p.side===side&&!p.done&&segDist({x,y},p.a,p.b)<30);if(near)return near;
  const s=pontoonSite(x);if(s.err){if(!quiet)tellTo(side,s.err,'a');return null;}
  s.id=++G.pid;s.side=side;s.hp=s.max=CROSSING_HP.pontoon;G.pontoons.push(s);return s;}
// Send an engineer to the site's bank on its own side of the river (or the far bank if that's the only one it can reach).
function assignBuild(u,site){u.repair=null;const ends=M.side(u.x,u.y)<0?['a','b']:['b','a'];
  for(const k of ends){const e=site[k];if(dist(u,e)<PONTOON.reach||route(u,e.x,e.y,'move')){if(dist(u,e)<PONTOON.reach){u.path=[];u.mode='idle';}u.build=site.id;u.buildEnd=e;u.buildFrom=k;return true;}}
  u.build=null;tellTo(u.side,'Engineers can\'t reach that crossing','a');return false;}
// An idle engineer standing at the bank end of one of its side's unfinished pontoons picks the job back up,
// so walking engineers away and back with a plain move order doesn't strand the site.
function resumeBuild(u){for(const p of G.pontoons){if(p.done||p.side!==u.side)continue;
  for(const k of ['a','b'])if(dist(u,p[k])<PONTOON.reach){u.build=p.id;u.buildEnd=p[k];u.buildFrom=k;return;}}}
function buildStep(u,dt){const p=G.pontoons.find(q=>q.id===u.build);if(!p||p.done){u.build=null;return;}
  if(u.moving||dist(u,u.buildEnd)>=PONTOON.reach)return;p.from=p.from||u.buildFrom;
  p.progress+=dt*(.6+.4*supF(u))/PONTOON.time;if(p.progress<1)return;
  p.progress=1;p.done=true;applyCrossings();G.acc.sup=0;for(const e of G.units)if(e.build===p.id)e.build=null;
  tell(r=>p.side===r?[`Pontoon bridge complete near ${placeName(p)}`,'d']:[`The enemy has bridged the river near ${placeName(p)}`,'a']);}
// Damaged cells are also grouped into stretches (8-connected, then merged when within 40 px), each marked with one red X.
function roadDamageChanged(){G.acc.sup=0;G.dmgList=[];for(let i=0;i<N;i++)if(G.dmg[i])G.dmgList.push(i);fieldCache.clear();
  const seen=new Set();G.dmgSpots=[];
  for(const s0 of G.dmgList){if(seen.has(s0))continue;const comp=[s0];seen.add(s0);
    for(let k=0;k<comp.length;k++){const i=comp[k],x=i%GW,y=Math.floor(i/GW);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=GW||ny>=GH)continue;const j=ny*GW+nx;if(G.dmg[j]&&!seen.has(j)){seen.add(j);comp.push(j);}}}
    G.dmgSpots.push(comp.map(cc));}
  // holes within 40 px of each other read as one stretch, so they share one X
  for(let merged=true;merged;){merged=false;
    for(let a=0;a<G.dmgSpots.length&&!merged;a++)for(let b=a+1;b<G.dmgSpots.length;b++)
      if(G.dmgSpots[a].some(p=>G.dmgSpots[b].some(q=>Math.hypot(p.x-q.x,p.y-q.y)<40))){G.dmgSpots[a].push(...G.dmgSpots.splice(b,1)[0]);merged=true;break;}}
  G.dmgSpots=G.dmgSpots.map(pts=>{const cx=pts.reduce((a,p)=>a+p.x,0)/pts.length,cy=pts.reduce((a,p)=>a+p.y,0)/pts.length;
    return pts.reduce((b,p)=>Math.hypot(p.x-cx,p.y-cy)<Math.hypot(b.x-cx,b.y-cy)?p:b);});
  // the road and street lines that pass through damage, with the width of their white casing on the map
  const hit=pts=>pts.some(q=>G.dmgList.some(i=>{const c=cc(i);return Math.abs(c.x-q.x)<30&&Math.abs(c.y-q.y)<30;}));
  G.dmgLines=G.dmgList.length?[...M.roads.filter(r=>r.kind===1||r.kind===2).filter(r=>hit(r.pts)).map(r=>({pts:r.pts,w:r.kind===2?11:6})),
    ...M.streets.filter(hit).map(pts=>({pts,w:4}))]:[];}
// Engineers repair cratered road around a work point: walk to the nearest damaged cell within 90 px of it (a whole bomb line),
// clear it, move on, and stop when the area is clean. Bridges can't be repaired, only replaced with a pontoon.
function startRepair(u,x,y){u.repair={x,y};u.rp=0;u.build=null;u.path=[];u.mode='idle';}
function nearestDamage(u){const w=u.repair;let best=-1,bd=1e9;for(const i of G.dmgList){const c=cc(i);if(Math.hypot(c.x-w.x,c.y-w.y)>90)continue;const d=Math.hypot(c.x-u.x,c.y-u.y);if(d<bd){bd=d;best=i;}}return best;}
function repairStep(u,dt){if(u.moving)return;const i=nearestDamage(u);
  if(i<0){u.repair=null;tellTo(u.side,`Road repaired near ${placeName(u)}`,'d');return;}
  const c=cc(i);if(Math.hypot(c.x-u.x,c.y-u.y)>ROAD_DMG.reach){if(!u.path.length&&!route(u,c.x,c.y,'move'))u.repair=null;return;}
  u.rp+=dt*(.6+.4*supF(u));if(u.rp<ROAD_DMG.cellTime)return;u.rp=0;G.dmg[i]=0;roadDamageChanged();}
// AI engineers with nothing else to do repair cratered road on their own bank, away from visible enemies.
// The attacker also leaves alone craters within reach of defenders it remembers (dug in and quiet, say).
function aiRepair(u){if(u.repair)return true;const foe=u.side==='A'?'D':'A',bank=M.side(u.x,u.y);let best=-1,bd=600;
  const dz=u.side==='A'&&G.plan&&G.plan.danger?[...G.plan.danger.values()].filter(s=>s.type!=='art'):[];
  for(const i of G.dmgList){const c=cc(i);if(M.side(c.x,c.y)!==bank)continue;const d=Math.hypot(c.x-u.x,c.y-u.y);
    if(d<bd&&!G.units.some(e=>e.side===foe&&G.vis[u.side].has(e.id)&&dist(e,c)<150)&&!dz.some(s=>dist(s,c)<TYPES[s.type].range+60)){bd=d;best=i;}}
  if(best<0)return false;const c=cc(best);startRepair(u,c.x,c.y);return true;}
function callAir(side,x,y){G.air[side]--;G.airT[side]=G.time;G.strikes.push({side,x,y,t:G.time+AIR.delay,ang:Math.random()*Math.PI*2,done:false});
  tellTo(side,`Air strike inbound near ${placeName({x,y})}, ${AIR.delay} s out`,'d');}
// Four bombs fall in a line along the run-in heading. They hurt every unit in the blast, either side,
// and drop any bridge or pontoon a bomb lands on.
function resolveStrike(s){s.done=true;const dx=Math.cos(s.ang),dy=Math.sin(s.ang);
  const bombs=[-36,-12,12,36].map(o=>({x:s.x+dx*o+(Math.random()-.5)*12,y:s.y+dy*o+(Math.random()-.5)*12}));
  for(const b of bombs){G.booms.push({x:b.x,y:b.y,t:0,r:42});G.craters.push(b);
    for(const e of G.units){const d=dist(e,b);if(d>=AIR.radius)continue;const ci=cellOf(e.x,e.y);
      let k=1;if(dugIn(e))k=TRENCH.air;else if(M.cls[ci]===URBAN)k=.65;else if(M.cls[ci]===FOREST)k=.75;else if(iceAt(ci))k=ICE.exposed;if(e.type==='tank')k*=.6;hit(e,AIR.dmg*(1-d/AIR.radius)*k);}}
  // bombs crater ordinary roads and highways (bridges are handled below): still a supply route, but slow going
  let cratered=0;for(const b of bombs){const cx=Math.floor(b.x/C),cy=Math.floor(b.y/C),r=Math.ceil(ROAD_DMG.radius/C);
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=GW||ny>=GH)continue;const i=ny*GW+nx,c=cc(i);
      if((M.road[i]===1||M.road[i]===2)&&!G.dmg[i]&&Math.hypot(c.x-b.x,c.y-b.y)<=ROAD_DMG.radius){G.dmg[i]=1;cratered++;}}}
  if(cratered){roadDamageChanged();tell(r=>[`Road cratered near ${placeName(s)}`,s.side===r?'d':'a']);}
  tell(r=>s.side!==r?[`Enemy air strike near ${placeName(s)}`,'a']:null);
  const cut=new Set();
  for(const c of strikable()){const [a,b]=crossingEnds(c);if(bombs.some(p=>segDist(p,a,b)<AIR.bridgeHit))destroyCrossing(c,s.side,cut);}
  if(cut.size)crossingsFell(cut);}
function destroyCrossing(c,side,cut){
  if(c.a){G.pontoons.splice(G.pontoons.indexOf(c),1);for(const i of c.cells)if(M.road[i]===4)cut.add(i);}
  else{c.down=true;for(const i of c.cells)cut.add(i);}
  tell(r=>[`${crossingName(c).replace(/^./,m=>m.toUpperCase())} destroyed`,side===r?'d':'a']);}
// A fire-mission shell wears down a bridge or finished pontoon it lands on, and sometimes craters the road it hits.
// Much weaker than a bomb: about ten shells drop a bridge, four a pontoon.
function shellOnInfrastructure(s){const p={x:s.x1,y:s.y1},cut=new Set();
  for(const c of strikable()){const [a,b]=crossingEnds(c);if(segDist(p,a,b)>=SHELL_VS.hit)continue;
    c.hp-=c.a?SHELL_VS.pontoon:SHELL_VS.bridge;if(c.hp<=0)destroyCrossing(c,s.side,cut);}
  if(cut.size)crossingsFell(cut);
  const i=cellOf(p.x,p.y);if((M.road[i]===1||M.road[i]===2)&&!G.dmg[i]&&Math.random()<SHELL_VS.crater){G.dmg[i]=1;roadDamageChanged();}}
// Where a strike aimed at (x, y) lands: a point within 40 px of a bridge or pontoon snaps to its middle.
function airAim(x,y){let best=null,bd=40;for(const c of strikable()){const [a,b]=crossingEnds(c),d=segDist({x,y},a,b);if(d<bd){bd=d;best=c;}}
  return best?{x:best.x,y:best.y,crossing:best}:{x,y,crossing:null};}
// A side calls an air strike at (x, y) (snapped to a crossing it would hit). Returns the aim point, or null if it has none left.
function sideAir(side,x,y){if(G.air[side]<=0){tellTo(side,'No air strikes left','a');return null;}
  ({x,y}=airAim(x,y));callAir(side,x,y);return{x,y};}

