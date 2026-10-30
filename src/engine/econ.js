// COMPANY · src/engine/econ.js
// Company Command: manpower and fuel, the depot's production queue, victory points, and the computer's buying.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
// Only the Company Command scenario (SCENARIOS.command, econ: true) uses any of this: newGame calls econInit, step calls
// econStep, checkEnd hands over to checkVP, and runCmd's build / cancel / rally commands come here. G.econ is null in
// every other scenario, so nothing here runs (and nothing here draws random numbers) outside the mode.
// The numbers live in ECON (constants.js).

// Each side gets a home objective: B stays on the north half, and C moves to a matching spot on the south half (the
// best district or village near B's mirror image through A, or the high ground there), so the race for the middle (A)
// starts even. Only the battle's objectives change; the map itself is untouched.
function econObjectives(){const o=G.objs,A=o[0],B=o[1],south=(x,y)=>M.side(x,y)>0;
  const mx=clamp(2*A.x-B.x,120,W-120),my=clamp(2*A.y-B.y,M.ry(mx)+M.rw(mx)/2+110,H-220),m={x:mx,y:my};
  const far=p=>dist(p,M.depA)>260&&dist(p,A)>230&&p.y<H-180;
  let best=null,bd=300;
  for(const d of M.D||[]){const p={x:d.cx,y:d.cy};if(!d.name||!south(p.x,p.y)||!far(p))continue;const dd=dist(p,m);if(dd<bd){bd=dd;best={x:p.x,y:p.y,name:d.name,kind:d.village?'village':'town'};}}
  if(!best){let bh=-1,bi=-1;const c0=cellOf(m.x,m.y),cx=c0%GW,cy=Math.floor(c0/GW),r=Math.round(220/C);
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const nx=cx+dx,ny=cy+dy;if(nx<2||ny<2||nx>=GW-2||ny>=GH-2||dx*dx+dy*dy>r*r)continue;
      const i=ny*GW+nx,q=cc(i);if(!south(q.x,q.y)||!far(q)||!mult('tank',i))continue;if(M.hgt[i]>bh){bh=M.hgt[i];bi=i;}}
    const q=bi>=0?cc(bi):cc(nearestPassable('tank',m.x,m.y));best={x:q.x,y:q.y,name:'Hill '+M.elev(bh>=0?bh:M.hgt[cellOf(q.x,q.y)]),kind:'hill'};}
  Object.assign(o[2],best);}

function econInit(){econObjectives();
  // the land on each half, for territory income: land on your own half pays a little, taken ground on the enemy's in full
  const half=new Int8Array(N);let land=0;for(let i=0;i<N;i++){if(M.cls[i]===WATER&&!M.road[i])continue;const q=cc(i);half[i]=M.side(q.x,q.y)<0?-1:1;land++;}
  const side=s=>{const dep=G.depot[s],dir=s==='A'?-1:1,r=cc(nearestPassable('tank',dep.x,clamp(dep.y+dir*ECON.rallyOff,30,H-30)));
    return{mp:ECON.mp0,fuel:ECON.fuel0,q:[],rally:r,vp:ECON.vp0,rate:{mp:0,fuel:0,gross:0,up:0,base:0,obj:0,terr:0},pop:0,raid:false,spent:{mp:0,fuel:0},built:0,n:0};};
  G.econ={A:side('A'),D:side('D'),half,land:land/2,acc:0};}

// population: units in the field plus units in the queue
const econPop=s=>G.units.reduce((a,u)=>a+(u.side===s?ECON.cost[u.type].pop:0),0)+G.econ[s].q.reduce((a,q)=>a+ECON.cost[q.type].pop,0);
// the computer's income is scaled by difficulty (not in multiplayer, where both sides are people)
const econMul=s=>s!==G.player&&!G.mp?(DIFFICULTY[G.diff].econ||1):1;

// Income, upkeep, population, the depot raid check and the victory-point drain, once a second of game time.
function econTick(){const E=G.econ;
  for(const s of ['A','D']){const e=E[s],own=G.objs.filter(o=>o.owner===s).length,cov=G.cov[s],home=s==='A'?1:-1;
    let t=0;if(cov)for(let i=0;i<N;i++)if(cov[i]&&E.half[i])t+=(E.half[i]===home?ECON.terr.own:1)*cov[i]/100;
    const share=Math.min(1,t/E.land),k=econMul(s);
    const base=ECON.inc.mp*k,obj=own*ECON.obj.mp*k,terr=ECON.terr.mp*share*k,gross=base+obj+terr;
    const up=G.units.reduce((a,u)=>a+(u.side===s?ECON.upkeep[u.type]:0),0),net=Math.max(gross*ECON.minNet,gross-up);
    const fuel=(ECON.inc.fuel+own*ECON.obj.fuel+ECON.terr.fuel*share)*k;
    e.rate={mp:net,fuel,gross,up,base,obj,terr};e.mp+=net/60;e.fuel+=fuel/60;e.pop=econPop(s);
    // an enemy unit near the depot slows production
    const dep=G.depot[s],raid=G.units.some(u=>u.side!==s&&dist(u,dep)<ECON.depotR);
    if(raid!==e.raid){e.raid=raid;if(G.phase==='play')tellTo(s,raid?'Your depot is under attack: production slowed':'Production is back to full speed',raid?'a':'d');}}
  // Victory points: after the grace period, the side holding fewer objectives loses points every second.
  if(G.time>=ECON.vpGrace){const a=G.objs.filter(o=>o.owner==='A').length,d=G.objs.filter(o=>o.owner==='D').length,gap=Math.min(3,Math.abs(a-d));
    if(gap){const lo=a<d?'A':'D',e=E[lo],was=e.vp;e.vp=Math.max(0,e.vp-ECON.vpRate[gap]);
      for(const mark of [250,100])if(was>mark&&e.vp<=mark)tell(r=>r===lo?[`Victory points down to ${mark}: take back objectives`,'a']:[`The enemy is down to ${mark} victory points`,'d']);}}}

// every step: the queue at each depot, then the once-a-second tick
function econStep(dt){const E=G.econ;
  for(const s of ['A','D']){const e=E[s],q=e.q[0];if(!q)continue;q.t+=dt*(e.raid?ECON.raidMul:1);
    if(q.t>=q.T){e.q.shift();econSpawn(s,q.type);}}
  if((E.acc-=dt)<=0){E.acc=1;econTick();}}

// A finished unit appears in front of the depot and walks to the rally point, taking its place in a loose line there.
function econSpawn(s,type){const e=G.econ[s],dep=G.depot[s],dir=s==='A'?-1:1,n=e.n++;
  const u=addUnit(s,type,dep.x+((n%5)-2)*24,clamp(dep.y+dir*ECON.spawnOff,12,H-12));e.built++;
  const r=e.rally,sp=slotPos(r,n%7,7,0,dir,type);route(u,sp.x,sp.y,'move',r.x,r.y);
  tellTo(s,`${TYPES[type].name} ready at the depot`,'d');
  if(s!==G.player&&!G.mp)aiNewUnit(u);return u;}

// Commands (validated here, on the battle's own copy: a client never decides what something costs).
function econBuild(s,type){const E=G.econ;if(!E||G.phase!=='play'||!ECON.cost[type])return null;const e=E[s],c=ECON.cost[type];
  const no=e.q.length>=ECON.queue?'The depot’s queue is full':e.mp<c.mp?'Not enough manpower':e.fuel<c.fuel?'Not enough fuel':econPop(s)+c.pop>ECON.popCap?'Population cap reached':null;
  if(no){tellTo(s,no,'a');return null;}
  e.mp-=c.mp;e.fuel-=c.fuel;e.spent.mp+=c.mp;e.spent.fuel+=c.fuel;e.q.push({type,t:0,T:c.t});e.pop=econPop(s);return true;}
function econCancel(s,i){const E=G.econ;if(!E||G.phase!=='play')return null;const e=E[s],q=e.q[i|0];if(!q)return null;const c=ECON.cost[q.type];
  e.q.splice(i|0,1);e.mp+=c.mp;e.fuel+=c.fuel;e.spent.mp-=c.mp;e.spent.fuel-=c.fuel;e.pop=econPop(s);return true;}
function econRally(s,x,y){const E=G.econ;if(!E||G.phase==='over')return null;const p=cc(nearestPassable('tank',clamp(+x||0,8,W-8),clamp(+y||0,8,H-8)));E[s].rally=p;return p;}

// The win check in this mode: a side out of victory points, or wiped out (no units, nothing coming, and not enough
// manpower for even one infantry), loses; at the time limit, more victory points wins.
function checkVP(){const E=G.econ,gone=s=>!G.units.some(u=>u.side===s)&&!E[s].q.length&&E[s].mp<ECON.cost.inf.mp;
  if(gone('D'))return end('A','The defending company has been destroyed.');
  if(gone('A'))return end('D','The attacking company has been destroyed.');
  if(E.A.vp<=0)return end('D','The attacker ran out of victory points.');
  if(E.D.vp<=0)return end('A','The defender ran out of victory points.');
  if(G.time>=G.limit){const a=Math.ceil(E.A.vp),d=Math.ceil(E.D.vp);
    return a>d?end('A',`The attacker had ${a} victory points to ${d} when time ran out.`):d>a?end('D',`The defender had ${d} victory points to ${a} when time ran out.`):end(null,`Both sides had ${a} victory points when time ran out.`);}}

/* --- the computer's side --- */
// What to buy, every AI turn: aim for a mix (more armour when it has seen enemy tanks), keep a few guns and engineers,
// and when a tank or gun is waiting on fuel, fill in with infantry only if there's manpower to spare for it.
function aiCommander(s){const e=G.econ[s],P=ECON.ai;if(e.q.length>=P.queue)return;
  const cnt={inf:0,tank:0,art:0,eng:0},seen={inf:0,tank:0,art:0,eng:0};
  for(const u of G.units)if(u.side===s)cnt[u.type]++;for(const q of e.q)cnt[q.type]++;for(const x of aiSee(s))seen[x.type]++;
  const mix={...P.mix};if(seen.tank>=2){mix.tank+=.1;mix.inf-=.1;}if(seen.art>=2)mix.tank+=.05;if(seen.inf>=6&&seen.tank<2)mix.art+=.05;
  const tot=cnt.inf+cnt.tank+cnt.art+cnt.eng+1;let want=null,bd=-1e9;
  for(const t of UNIT_TYPES){if((t==='eng'&&cnt.eng>=P.engMax)||(t==='art'&&cnt.art>=P.artMax))continue;const d=mix[t]*tot-cnt[t];if(d>bd){bd=d;want=t;}}
  if(!want)return;const c=ECON.cost[want],can=t=>{const k=ECON.cost[t];return e.mp>=k.mp&&e.fuel>=k.fuel&&econPop(s)+k.pop<=ECON.popCap;};
  if(can(want))econBuild(s,want);
  else if(e.fuel<c.fuel&&want!=='inf'&&can('inf')&&e.mp>=c.mp+ECON.cost.inf.mp)econBuild(s,'inf');}
// A new unit of the computer's: guns and engineers go straight to work; infantry and tanks wait at the rally point
// (attacker: u.pool) or head for the reserve's staging area (defender: role 'muster') and join up from there, so units
// still on the road never count toward a group's strength.
function aiNewUnit(u){if(u.type==='art'){if(u.side==='A')u.obj=-1;else u.role='art';return;}
  if(u.type==='eng'){u.role='eng';return;}
  if(u.side==='A')u.pool=true;else u.role='muster';}
// Every AI turn: fold arrived newcomers into the plan.
function aiMuster(s){const o=G.objs,mine=G.units.filter(u=>u.side===s),e=G.econ[s];
  if(s==='A'){const P=G.plan;if(!P)return;
    const arrived=mine.filter(u=>u.pool&&(!u.path.length||dist(u,e.rally)<120));if(!arrived.length)return;
    // a lone captured objective gets a garrison of two
    for(const ob of o){if(ob.owner!=='A'||mine.some(u=>!u.pool&&u.type!=='art'&&dist(u,ob)<120))continue;
      const g=arrived.filter(u=>u.pool&&u.type==='inf').slice(0,2);for(const u of g){u.pool=false;u.holdAt=coverNear(ob,60,'inf',0);}}
    const left=arrived.filter(u=>u.pool);if(!left.length)return;
    // join a group that's still gathering (sized by its live members), or form a new assault once there are enough
    const asm=P.groups.filter(g=>g.state==='assemble'&&g.stance!=='pin').sort((a,b)=>mine.filter(u=>u.grp===b.i).length-mine.filter(u=>u.grp===a.i).length)[0];
    if(asm){for(const u of left){u.pool=false;u.grp=asm.i;u.via=null;u.viaFor=null;}
      mine.filter(u=>u.grp===asm.i).forEach((u,k)=>{u.slot=k;});asm.size=mine.filter(u=>u.grp===asm.i).length;return;}
    if(left.reduce((a,u)=>a+W8[u.type],0)>=ECON.ai.wave){const ks=Object.keys(P.axes);econGroup(P,ks[Math.random()*ks.length|0],left);}
    return;}
  // defender: the reserve's staging area is the rally point; there, infantry take a post at the objective with the
  // fewest line units, and tanks join the reserve
  if(!G.dai)return;e.rally=G.dai.stage;const stage=G.dai.stage,line=mine.filter(u=>u.role==='line');
  for(const u of mine){if(u.role!=='muster')continue;
    if(dist(u,stage)>150){if(!u.path.length)route(u,stage.x,stage.y,'move');continue;}
    if(u.type==='tank'){u.role='reserve';u.home={x:u.x,y:u.y};continue;}
    const k=[0,1,2].sort((a,b)=>line.filter(v=>v.sector===a).length-line.filter(v=>v.sector===b).length)[0];
    u.role='line';u.post=coverNear(defendSpot(o[k]),70,'inf',0);u.sector=k;line.push(u);route(u,u.post.x,u.post.y,'amove');}}
// a new assault group for the attacker's plan, from units waiting at the rally point
function econGroup(P,axis,us){const o=G.objs,pt=P.axes[axis].via||o[0],objs=[0,1,2].sort((a,b)=>dist(pt,o[a])-dist(pt,o[b]));
  const x=clamp(P.axes[axis].x,40,W-40),g={i:P.groups.length,axis,stance:'assault',start:G.time+10,state:'assemble',probe:false,objs,asm:P.asm(axis),
    pinPt:cc(nearestPassable('tank',x,M.ry(x)+M.rw(x)/2+70)),pinUntil:0,size:us.length,waves:2};
  us.forEach((u,k)=>{u.pool=false;u.grp=g.i;u.slot=k;u.via=null;u.viaFor=null;});P.groups.push(g);return g;}
