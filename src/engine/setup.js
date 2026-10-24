// COMPANY · src/engine/setup.js
// Starting a battle: trenches, forces, spawning, reinforcements, scenario setup, and newGame (which also resets the HUD).
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
const inZone=(x,y)=>x>8&&x<W-8&&y>8&&y<M.ry(x)+ZONE;
function autoTrenches(strength){const T=[],o=M.objs;
  const push=c=>{if(c.length>2)T.push(c);};
  const arc=(cx,cy,rad,a0,a1,jit)=>{let cur=[];const n=Math.max(6,Math.round(rad*(a1-a0)/14));
    for(let k=0;k<=n;k++){const a=a0+(a1-a0)*k/n,rr=rad+Math.sin(k*1.7+cx)*jit,x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;
      if(x<5||y<5||x>W-5||y>H-5||M.water(x,y)){push(cur);cur=[];continue;}cur.push({x,y});}push(cur);};
  const line=(x0,x1,yf)=>{let cur=[];for(let x=x0;x<=x1;x+=14){const y=yf(x);if(x<5||x>W-5||y<5||y>H-5||M.water(x,y)){push(cur);cur=[];continue;}cur.push({x,y});}push(cur);};
  arc(o[0].x,o[0].y,125,Math.PI/2-1.15,Math.PI/2+1.15,6);
  arc(o[1].x,o[1].y,95,Math.PI/2-1.3,Math.PI/2+1.3,5);
  arc(o[2].x,o[2].y,70,-Math.PI/2+.5,Math.PI*1.5-.5,4);
  if(strength!=='light')line(o[1].x-420,o[1].x+420,x=>M.ry(x)-M.rw(x)/2-26+Math.sin(x/37)*4);
  if(strength==='heavy')line(o[0].x-320,o[0].x+320,x=>M.ry(x)+M.rw(x)/2+230+Math.sin(x/41)*10);
  return T;}
function rebuildTrenchMask(){M.trench.fill(0);for(const t of G.trenches)for(let k=0;k<t.length-1;k++){const a=t[k],b=t[k+1],n=Math.max(1,Math.ceil(dist(a,b)/3));
  for(let s=0;s<=n;s++){const x=a.x+(b.x-a.x)*s/n,y=a.y+(b.y-a.y)*s/n,cx=Math.floor(x/C),cy=Math.floor(y/C);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=cx+dx,ny=cy+dy;if(nx>=0&&ny>=0&&nx<GW&&ny<GH)M.trench[ny*GW+nx]=1;}}}}
// A side's force: the base table, the battlefield's changes, then difficulty if the computer plays that side.
// o: a setup {mode, scen, player, diff}; the running game's by default (the New game screen passes the chosen options)
function forceFor(side,base,o){o=o||{mode:M.mode,scen:G.scen,player:G.player,diff:G.diff,mp:!!G.mp};const sc=SCENARIOS[o.scen]||SCENARIOS.standard,f={...base},dm=(MAP_MODES[o.mode].forces||{})[side]||{};
  for(const k in dm)f[k]=Math.max(k==='inf'?3:0,(f[k]||0)+dm[k]);
  const sf=(sc.forces||{})[side]||{};for(const k in sf)f[k]=Math.max(k==='inf'?3:0,(f[k]||0)+sf[k]);
  if(side!==o.player&&!o.mp){const k=DIFFICULTY[o.diff].force;for(const t of ['inf','tank','art'])if(f[t])f[t]=Math.max(1,Math.round(f[t]*k));}
  return f;}
const airFor=(side,o)=>{o=o||{mode:M.mode,scen:G.scen,player:G.player,diff:G.diff,mp:!!G.mp};const sc=SCENARIOS[o.scen]||SCENARIOS.standard;
  return sc.noAir?0:Math.max(0,AIR.count+(MAP_MODES[o.mode].air||0)+((sc.air||{})[side]||0)+(side!==o.player&&!o.mp?DIFFICULTY[o.diff].air:0));};
function spawn(){const f=forceFor('D',FORCES[G.strength]),atk=forceFor('A',ATK),o=M.objs;let id=0;
  const mk=(side,type,x,y)=>{const p=cc(nearestPassable(type,clamp(x,6,W-6),clamp(y,6,H-6)));const T=TYPES[type];
    const u={id:++id,side,type,x:p.x+(Math.random()-.5)*3,y:p.y+(Math.random()-.5)*3,hp:T.hp,max:T.hp,path:[],mode:'idle',tgt:null,rev:0,sup:true,lastHit:-99,
      sel:false,build:null,buildEnd:null,cd:Math.random()*3,deployT:3,fx:0,fireAt:null,role:null,obj:-1,via:null,flash:0,moving:false};G.units.push(u);return u;};
  const reserveInf=f.inf>=11?3:2,nLine=f.inf-reserveInf;
  const segs=[];let total=0;for(const t of G.trenches)for(let k=0;k<t.length-1;k++){const L=dist(t[k],t[k+1]);segs.push({a:t[k],b:t[k+1],s0:total,L});total+=L;}
  for(let k=0;k<nLine;k++){let x,y;
    if(total>0){const s=total*(k+.5)/nLine,sg=segs.find(g=>s<=g.s0+g.L)||segs[segs.length-1],t=clamp((s-sg.s0)/sg.L,0,1);x=sg.a.x+(sg.b.x-sg.a.x)*t;y=sg.a.y+(sg.b.y-sg.a.y)*t;}
    else{const ob=o[k%3];x=ob.x+(k-4)*12;y=ob.y+40;}
    const u=mk('D','inf',x,y);u.role='line';u.post={x:u.x,y:u.y};}
  const home={x:o[1].x,y:clamp(o[1].y-120,40,H)};
  for(let k=0;k<reserveInf;k++){const u=mk('D','inf',home.x+(k-(reserveInf-1)/2)*22,home.y+18);u.role='reserve';u.home={x:u.x,y:u.y};}
  for(let k=0;k<f.tank;k++){const u=mk('D','tank',home.x+(k-(f.tank-1)/2)*26,home.y-14);u.role='reserve';u.home={x:u.x,y:u.y};}
  const ap={x:(o[1].x+o[2].x)/2,y:clamp(Math.min(o[1].y,o[2].y)-140,40,H)};
  for(let k=0;k<f.art;k++){const u=mk('D','art',ap.x+(k-(f.art-1)/2)*30,ap.y);u.role='art';}
  for(let k=0;k<f.eng;k++){const u=mk('D','eng',home.x+50+k*22,home.y+30);u.role='eng';}
  const dep=M.depA,list=[...Array(atk.tank).fill('tank'),...Array(atk.inf).fill('inf'),...Array(atk.art).fill('art'),...Array(atk.eng).fill('eng')];
  const flank=[M.viaW,M.viaE].filter(Boolean);
  list.forEach((type,k)=>{const row=Math.floor(k/8),col=k%8;const u=mk('A',type,dep.x+(col-3.5)*30,H-150+row*30);
    if(type==='art'){u.obj=k%3;}
    else if(type==='eng'){u.obj=0;u.role='eng';}
    else{const g=k%4;if(g<2||!flank.length){u.obj=0;}else{const v=flank[(g-2)%flank.length];u.via=v;
      u.obj=dist(v,o[1])<dist(v,o[2])?1:2;}}});G.nextId=id+1;}
// a unit added after the start (reinforcements)
function addUnit(side,type,x,y){const p=cc(nearestPassable(type,clamp(x,6,W-6),clamp(y,6,H-6))),T=TYPES[type];
  const u={id:G.nextId++,side,type,x:p.x,y:p.y,hp:T.hp,max:T.hp,path:[],mode:'idle',tgt:null,rev:0,sup:true,lastHit:-99,
    sel:false,build:null,buildEnd:null,cd:Math.random()*3,deployT:3,fx:0,fireAt:null,role:null,obj:-1,via:null,flash:0,moving:false};G.units.push(u);return u;}
// Scheduled reinforcements reach their side's depot. The computer's units join its reserve (defender) or its biggest
// attacking group (attacker); the player's wait at the depot.
function reinforce(){(SC().reinf||[]).forEach((r,k)=>{if(G.reinfDone.has(k)||G.time<r.t)return;G.reinfDone.add(k);
  const dep=G.depot[r.side],dir=r.side==='A'?-1:1,list=[];for(const t in r.units)for(let n=0;n<r.units[t];n++)list.push(t);
  const us=list.map((t,n)=>addUnit(r.side,t,dep.x+((n%6)-2.5)*26,dep.y+dir*(40+Math.floor(n/6)*28)));
  if(r.side!==G.player){if(r.side==='D')for(const u of us){u.role='reserve';u.home={x:u.x,y:u.y};}
    else if(G.plan){const g=G.plan.groups.filter(g=>g.stance!=='pin').sort((a,b)=>b.size-a.size)[0];if(g)for(const u of us)if(u.type==='inf'||u.type==='tank'){u.grp=g.i;u.slot=g.size++;}}}
  if(G.rec)G.rec.events.push({t:G.time,k:'reinf',side:r.side});
  tell(q=>r.side===q?[`Reinforcements have reached your depot: ${list.length} units`,'d']:['Enemy reinforcements are reported at their depot','a']);});}
// Starting positions the scenario changes.
function scenarioSetup(){const sc=SC(),o=G.objs,A=G.units.filter(u=>u.side==='A'),D=G.units.filter(u=>u.side==='D');
  const place=(us,c,fy)=>us.forEach((u,k)=>{const p=slotPos(c,k,us.length,0,fy,u.type);u.x=p.x;u.y=p.y;u.path=[];});
  if(sc.counter){
    // the attacker already holds the crossing and the town: all its infantry and half its armour are there, holding
    o[0].owner=o[1].owner='A';o[0].p=o[1].p=-1;const tanks=A.filter(u=>u.type==='tank'),fwd=[...A.filter(u=>u.type==='inf'),...tanks.slice(0,Math.ceil(tanks.length/2))];
    const nA=Math.round(fwd.length*.4),atA=fwd.slice(0,nA),atB=fwd.slice(nA);
    place(atA,coverNear(defendSpot(o[0]),60,'tank',0),-1);place(atB,coverNear(o[1],60,'tank',0),-1);for(const u of fwd)u.holdAt={x:u.x,y:u.y};
    // the defender has been pushed back north of the town; its line units still try to get back to their old posts
    const back=D.filter(u=>dist(u,o[0])<380||dist(u,o[1])<380);place(back,{x:o[1].x,y:clamp(o[1].y-300,40,H-40)},1);
    for(const u of back)if(u.home)u.home={x:u.x,y:u.y};}
  if(sc.neutral){
    // both sides start at their depots; the defender's line units head for the objectives
    place(D,{x:G.depot.D.x,y:clamp(G.depot.D.y+110,40,H-40)},1);
    D.forEach((u,k)=>{if(u.role==='line')u.post=coverNear(defendSpot(o[k%3]),70,'inf',0);if(u.home)u.home={x:u.x,y:u.y};});}}
function newGame(opts){
  if(RP){RP=null;document.body.classList.remove('replaying');$('replayBar').hidden=true;}
  opts.mode=MAP_MODES[opts.mode]?opts.mode:'river';opts.diff=DIFFICULTY[opts.diff]?opts.diff:'normal';
  opts.climate=CLIMATES[opts.climate]?opts.climate:'temperate';opts.scen=SCENARIOS[opts.scen]?opts.scen:'standard';const sc=SCENARIOS[opts.scen];
  opts.gen2=!!opts.gen2;const fresh=!M||M.seed!==opts.seed||M.mode!==opts.mode||!!M.gen2!==opts.gen2;if(fresh)M=makeMap(opts.seed,opts.mode,opts.gen2);
  if(fresh||M.climate!==opts.climate){setClimate(opts.climate);renderTerrain();}fieldCache.clear();
  G={player:opts.side,strength:opts.strength,seed:opts.seed,mode:opts.mode,gen2:opts.gen2,diff:opts.diff,climate:opts.climate,scen:opts.scen,limit:sc.limit,holdA:0,reinfDone:new Set(),nextId:1,units:[],trenches:[],userTrench:[],undo:[],time:0,paused:!opts.mp,speed:opts.mp?1:G?G.speed:1,mp:opts.mp||null,
    phase:(opts.side==='D'||opts.mp)&&sc.deploy!==false?'deploy':'play',fog:opts.mp?true:settings.fog,orderMode:'move',tool:null,budget:BUDGET[opts.strength]*MAP_MODES[opts.mode].budget,
    objs:M.objs.map(o=>({...o,owner:sc.neutral?'N':'D',p:sc.neutral?0:1,contested:false})),depot:{A:M.depA,D:M.depD},
    vis:{A:new Set(),D:new Set()},sup:{A:new Uint8Array(N),D:new Uint8Array(N)},cov:{A:new Uint8Array(N),D:new Uint8Array(N)},claim:{A:new Uint8Array(N),D:new Uint8Array(N)},acc:{vis:0,sup:0,ai:0,cap:0,front:0},ctrl:null,ctrlS:null,frontSeg:[],frontSegP:[],frontSegE:[],
    bridges:M.spans.map((b,id)=>({id,x:b.sym.x,y:b.sym.y,ang:b.sym.ang,len:b.sym.len,kind:b.sym.kind,cells:b.cells,down:false,hp:CROSSING_HP.bridge,max:CROSSING_HP.bridge})),
    pontoons:[],pid:0,dmg:new Uint8Array(N),dmgList:[],dmgSpots:[],dmgLines:[],air:{A:0,D:0},airT:{A:-99,D:-99},strikes:[],
    seen:{A:new Map(),D:new Map()},dai:null,shells:[],tracers:[],booms:[],craters:[],ghosts:new Map(),marks:[],log:[],stats:{lost:{A:0,D:0}},showSup:false,over:null};
  M.dmg=G.dmg;G.air={A:airFor('A'),D:airFor('D')};applyCrossings();G.trenches=sc.trenches===false?[]:autoTrenches(opts.strength);rebuildTrenchMask();spawn();scenarioSetup();G.plan=G.player==='D'&&!opts.mp?planAttack():null;computeVis();computeSupply('A');computeSupply('D');
  $('startModal').hidden=true;$('endModal').hidden=true;$('startModal').classList.remove('showmap');$('ngShowMapT').textContent='Show Map';closePops();ui.panel='folded';ui.modsG=false;
  $('deployTools').hidden=G.phase!=='deploy'||G.player!=='D';updateBudget();setMode('move');setTool(null);
  G.code=encodeGame(opts);G.budget0=G.budget;
  recInit();addLog(sc.goal[G.player],G.player);
  updateFront();if(settings.front)frontShape(true);
  fit();updateHUD(true);
}

