// COMPANY · src/net/sync.js
// The battle in multiplayer: the host's browser runs the only simulation and streams it; the guest's screen mirrors it.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
// The host sends a frame MP.snapHz times a second (message type 'f'): every unit, objectives, crossings, air strikes left,
// what the guest's side can see, new shells, bursts and strikes, and the deployment clock. Things that change rarely
// (the guest's own units' routes, trenches, road damage, pontoon sites, supply coverage) go only when they change, and
// all of them again every MP.fullEvery s so a lost message heals itself. The guest never calls step(): it shows the
// stream about one frame behind, moving units smoothly between the last two frames, as the replay does.
// Nothing here runs in a single-player game (main.js calls mpFrame only when G.mp is set).
const MP_MODES=['idle','move','amove','hold'];
const r1=v=>Math.round(v*10)/10;
// run-length code for a 0/1 cell grid: lengths of alternating runs, starting with 0s
function rle(a){const out=[];let v=0,n=0;for(let i=0;i<a.length;i++){const b=a[i]?1:0;if(b===v)n++;else{out.push(n);v=b;n=1;}}out.push(n);return out;}
function unrle(r,a){let i=0,v=0;for(const n of r){a.fill(v,i,i+n);i+=n;v^=1;}return a;}

// (only while this battle's session lasts: after leaving it, a finished battle on screen sends and shows nothing)
function mpFrame(dt){if(!L.inGame||G.mp.room!==L.room)return;if(G.mp.role==='host')mpHostFrame(dt);else mpGuestFrame(dt);}
// both screens: tidy the deployment tools away when the battle begins
function mpPhaseUI(){if(G.phase!=='deploy'){setTool(null);$('deployTools').hidden=true;G.undo=[];updateHUD(true);}}

/* --- host --- */
function mpHostFrame(dt){const S=G.mpS||(G.mpS={acc:0,full:0,vis:0,own:new Map(),dmg:null,tr:'',pk:'',bd:'',cov:null,rf:-1,ph:G.phase});
  // the defender's deployment is timed: when the clock runs out, the battle begins as if they had pressed Begin.
  // (the sim isn't running yet, so what each side can see is refreshed here, as the defender places units)
  if(G.phase==='deploy'&&!G.mpHold){G.mpDeploy=Math.max(0,(G.mpDeploy??MP.deployTime)-dt);if((S.vis-=dt)<=0){S.vis=.5;computeVis();}if(G.mpDeploy<=0)runCmd('D',{k:'begin'});}
  if(S.ph!==G.phase){S.ph=G.phase;mpPhaseUI();}
  if((S.acc-=dt)>0||!L.peer)return;S.acc=1/MP.snapHz;
  if((S.full-=1/MP.snapHz)<=0){S.full=MP.fullEvery;S.own.clear();S.dmg=null;S.tr=S.pk=S.bd='';S.cov=null;S.rf=-1;}
  mpSend('f',{to:L.peer,f:mpSnap(S)});}
function mpSnap(S){const gs=otherSide(G.player),f={t:r1(G.time),ph:G.phase},u=[],own={};
  if(G.phase==='deploy'){f.dl=Math.ceil(G.mpDeploy??MP.deployTime);f.bud=Math.round(G.budget);}
  // each unit: id, x, y, hp, flags (supplied, moving, guns set up, revealed, mode, side, type, wounded, stocks in 16ths), target id, and for the
  // guest's own units how many waypoints are left
  for(const v of G.units){const fl=(v.sup?1:0)|(v.moving?2:0)|(v.type==='art'&&v.deployT>=3?4:0)|(v.rev>0?8:0)|(MP_MODES.indexOf(v.mode)<<4)|(v.side==='D'?64:0)|(UNIT_TYPES.indexOf(v.type)<<7)|(v.wounded?512:0)|(Math.round(clamp(v.sp??1,0,1)*15)<<10);
    u.push(v.id,r1(v.x),r1(v.y),r1(v.hp),fl,v.tgt?v.tgt.id:0,v.side===gs?v.path.length:-1);
    if(v.side!==gs)continue;const k=S.own.get(v.id),now=[v.path,v.queue,v.fireAt,v.build,v.repair];
    if(!k||now.some((x,j)=>x!==k[j])){S.own.set(v.id,now);
      own[v.id]={p:v.path.map(q=>({x:r1(q.x),y:r1(q.y)})),q:v.queue||null,fa:v.fireAt||null,b:v.build||null,r:v.repair||null,d:!!v.direct};}}
  f.u=u;if(Object.keys(own).length)f.own=own;
  f.o=G.objs.map(o=>[o.owner,Math.round(o.p*1000)/1000,o.contested?1:0]);f.air=G.air;f.ha=r1(G.holdA);f.lost=G.stats.lost;
  f.vis=[...G.vis[gs]];
  // Company Command: the guest's own depot (resources, rates, queue, rally point) and both sides' victory points
  if(G.econ){const e=G.econ[gs];f.ec={mp:e.mp,fuel:e.fuel,rate:e.rate,pop:e.pop,raid:e.raid,rally:e.rally,q:e.q,spent:e.spent};
    f.vp=[G.econ.A.vp,G.econ.D.vp];f.bt=[G.econ.A.built,G.econ.D.built];}
  if(G.reinfDone.size!==S.rf){S.rf=G.reinfDone.size;f.rf=[...G.reinfDone];}
  const bd=G.bridges.map(b=>b.down?1:0).join('');f.bh=G.bridges.map(b=>Math.round(b.hp));if(bd!==S.bd){S.bd=bd;f.bd=bd;}
  const pk=G.pontoons.map(p=>p.id+(p.done?'d':'')).join();
  if(pk!==S.pk){S.pk=pk;f.pf=G.pontoons;}else f.pn=G.pontoons.map(p=>[p.id,Math.round(p.progress*1000)/1000,Math.round(p.hp)]);
  if(G.dmgList!==S.dmg){S.dmg=G.dmgList;f.dmg=G.dmgList;}
  const tr=G.trenches.map(t=>t.length).join()+'/'+G.userTrench.length;if(tr!==S.tr){S.tr=tr;f.tr=G.trenches;f.ut=G.userTrench.map(t=>G.trenches.indexOf(t));}
  if(G.cov[gs]!==S.cov){S.cov=G.cov[gs];f.cov=rle(G.cov[gs]);f.sup=rle(G.sup[gs]);}
  // shells, bursts and air strikes since the last frame, with the game time each began
  const ev=[];for(const s of G.shells)if(!s._n){s._n=1;ev.push(['s',r1(G.time-s.t),r1(s.x0),r1(s.y0),r1(s.x1),r1(s.y1),s.T,s.side]);}
  for(const b of G.booms)if(!b._n){b._n=1;ev.push(['b',r1(G.time-b.t),r1(b.x),r1(b.y),b.r]);}
  for(const s of G.strikes)if(!s._n){s._n=1;ev.push(['a',s.t,r1(s.x),r1(s.y),s.ang,s.side]);}
  if(ev.length)f.ev=ev;
  if(G.mp.hostTime){f.pa=G.paused?1:0;f.sp=G.speed;}
  if(G.over)f.over=G.over;
  return f;}

// A host whose tab is in the background gets no animation frames, so the keep-alive timer (about once a second)
// steps the battle and sends a frame instead; the guest's screen moves less smoothly meanwhile, but the battle goes on.
let mpBgT=0;
function mpBgStep(){const now=performance.now();if(!document.hidden||!G||!G.mp){mpBgT=0;return;}const dt=mpBgT?Math.min(2,(now-mpBgT)/1000):0;mpBgT=now;if(!dt)return;
  if(G.phase==='play'&&!G.paused&&!G.mpHold){const n=Math.round(dt*G.speed/STEP);for(let i=0;i<n&&G.phase==='play';i++)step(STEP);}
  mpFrame(dt);}

/* --- guest --- */
function mpGuestState(){return G.mpN||(G.mpN={prev:null,cur:null,units:new Map(G.units.map(u=>[u.id,u])),shells:[],booms:[],strikes:[],rf:new Set(),front:0,over:false});}
function mpOnFrame(f){const N2=mpGuestState(),me=G.player;N2.prev=N2.cur;N2.cur={f,at:performance.now()};
  // units: the same objects stay from frame to frame (so the selection holds); new ones (reinforcements) are made here
  const ids=new Set();
  for(let k=0;k<f.u.length;k+=7){const id=f.u[k],fl=f.u[k+4],side=fl&64?'D':'A',type=UNIT_TYPES[(fl>>7)&3];ids.add(id);let u=N2.units.get(id);
    if(!u||u.side!==side||u.type!==type){const T=TYPES[type];u={id,side,type,x:f.u[k+1],y:f.u[k+2],hp:T.hp,max:T.hp,path:[],queue:null,mode:'idle',tgt:null,rev:0,sup:true,lastHit:-99,
      sel:false,build:null,buildEnd:null,cd:0,deployT:3,fx:0,fireAt:null,role:null,obj:-1,via:null,flash:0,moving:false};N2.units.set(id,u);}
    u.sup=!!(fl&1);u.moving=!!(fl&2);u.deployT=type==='art'?(fl&4?3:0):3;u.rev=fl&8?1:0;u.mode=MP_MODES[(fl>>4)&3];u.wounded=!!(fl&512);u.sp=((fl>>10)&15)/15;if(G.cov[me])u.supR=G.cov[me][cellOf(u.x,u.y)]/100;
    const pl=f.u[k+6];if(pl>=0&&u.path.length>pl)u.path=u.path.slice(u.path.length-pl);}
  if(me==='A')trenchSight();
  for(const id of [...N2.units.keys()])if(!ids.has(id)){N2.units.delete(id);G.ghosts.delete(id);}
  if(f.own)for(const id in f.own){const u=N2.units.get(+id),o=f.own[id];if(!u)continue;u.path=o.p;u.queue=o.q;u.fireAt=o.fa;u.build=o.b;u.repair=o.r;u.direct=o.d;}
  // what our side sees, with ghost markers where enemies drop out of sight
  const prev=G.vis[me],now=new Set(f.vis);
  for(const u of N2.units.values()){if(u.side===me)continue;if(now.has(u.id))G.ghosts.delete(u.id);else if(prev.has(u.id))G.ghosts.set(u.id,{x:u.x,y:u.y,type:u.type,t:G.time});}
  for(const [id,g] of G.ghosts)if(G.time-g.t>30)G.ghosts.delete(id);G.vis[me]=now;
  f.o.forEach((q,k)=>{const o=G.objs[k];o.owner=q[0];o.contested=!!q[2];});
  if(f.sp){G.paused=!!f.pa;G.speed=f.sp;}
  if(f.ec&&G.econ){const e=G.econ[me],r=e.rally,keep=e.rallyT&&performance.now()-e.rallyT<1500;Object.assign(e,f.ec);if(keep)e.rally=r;
    G.econ.A.vp=f.vp[0];G.econ.D.vp=f.vp[1];G.econ.A.built=f.bt[0];G.econ.D.built=f.bt[1];}
  G.air=f.air;G.holdA=f.ha;G.stats.lost=f.lost;if(f.rf)G.reinfDone=new Set(f.rf);
  if(f.dl!=null)G.mpDeploy=f.dl;if(f.bud!=null&&!tdraw){G.budget=f.bud;updateBudget();}
  // crossings: bridge health every frame; bridges down and pontoon sites when they change
  let roads=false;f.bh.forEach((h,k)=>{G.bridges[k].hp=h;});
  if(f.bd)G.bridges.forEach((b,k)=>{const d=f.bd[k]==='1';if(d!==b.down){b.down=d;roads=true;}});
  if(f.pf){G.pontoons=f.pf;roads=true;}
  else if(f.pn)for(const [id,pr,hp] of f.pn){const p=G.pontoons.find(q=>q.id===id);if(p){p.progress=pr;p.hp=hp;}}
  if(roads)applyCrossings();
  if(f.dmg){G.dmg.fill(0);for(const i of f.dmg)G.dmg[i]=1;roadDamageChanged();}
  if(f.tr){G.trenches=f.tr;G.userTrench=(f.ut||[]).map(i=>G.trenches[i]).filter(Boolean);rebuildTrenchMask();}
  if(f.cov){unrle(f.cov,G.cov[me]);unrle(f.sup,G.sup[me]);covCv._src=null;}
  const R=G.rec,rec=R&&f.ph!=='deploy';
  if(f.ev)for(const e of f.ev){if(e[0]==='s'){const s={t:e[1],x0:e[2],y0:e[3],x1:e[4],y1:e[5],T:e[6],side:e[7]};N2.shells.push(s);if(rec)R.shells.push(s);}
    else if(e[0]==='b'){N2.booms.push({t:e[1],x:e[2],y:e[3],r:e[4]});if(rec)R.booms.push(e[1],e[2],e[3],e[4]);}
    else{const s={t:e[1],x:e[2],y:e[3],ang:e[4],side:e[5]};N2.strikes.push(s);if(rec){R.strikes.push(s);R.events.push({t:s.t,k:'air',side:s.side});}}}
  if(f.rf&&rec)for(const k of f.rf)if(!N2.rf.has(k)){N2.rf.add(k);const r=(SC().reinf||[])[k];if(r)R.events.push({t:f.t,k:'reinf',side:r.side});}
  // (the recording starts again when the battle begins, as the host's does)
  if(f.ph!==G.phase&&G.phase!=='over'&&f.ph!=='over'){G.phase=f.ph;if(f.ph==='play')recInit();mpPhaseUI();}
  if(f.over&&!N2.over){N2.over=true;G.phase='over';G.over=f.over;G.time=f.t;mpRec(f,true);const g=G;setTimeout(()=>{if(!RP&&G===g)showEnd(f.over.winner,f.over.reason);},900);}
  else if(rec&&!N2.over)mpRec(f);}
// The guest records the battle from the stream, in the host's format (a snapshot every REC_DT s of game time), so it
// can watch the replay and download it too.
function mpRec(f,last){const R=G.rec;if(!R||(!last&&f.t<R.next))return;R.next=f.t+REC_DT;const n=f.u.length/7;
  const r={t:f.t,id:new Uint16Array(n),x:new Int16Array(n),y:new Int16Array(n),hp:new Uint8Array(n),fl:new Uint8Array(n),fire:[],
    obj:f.o.map(q=>[q[0],q[1],!!q[2]]),bh:f.bh.slice(),air:{...f.air},holdA:f.ha,vp:f.vp,
    pont:G.pontoons.map(p=>({id:p.id,side:p.side,a:p.a,b:p.b,x:p.x,y:p.y,progress:p.progress,done:p.done,from:p.from,hp:p.hp,max:p.max}))};
  for(let k=0,j=0;j<n;j++,k+=7){const id=f.u[k],fl=f.u[k+4],type=UNIT_TYPES[(fl>>7)&3],max=TYPES[type].hp;
    r.id[j]=id;r.x[j]=Math.round(f.u[k+1]);r.y[j]=Math.round(f.u[k+2]);r.hp[j]=Math.round(clamp(f.u[k+3]/max,0,1)*255);
    r.fl[j]=(fl&1?0:1)|(MP_MODES[(fl>>4)&3]==='hold'?2:0)|(fl&4?4:0)|(fl&512?8:0);
    if(!R.meta.has(id))R.meta.set(id,{side:fl&64?'D':'A',type,max,died:Infinity});if(f.u[k+5]&&type!=='art')r.fire.push(id,f.u[k+5]);}
  recAdd(r);}
// every screen frame: place everything between the last two frames
function mpGuestFrame(){const N2=G.mpN;if(!N2||!N2.cur)return;const c=N2.cur.f,p=N2.prev?N2.prev.f:c;
  const a=N2.prev?clamp((performance.now()-N2.cur.at)/Math.max(1,N2.cur.at-N2.prev.at),0,1):1;
  const pi=new Map();for(let k=0;k<p.u.length;k+=7)pi.set(p.u[k],k);
  const t=p.t+(c.t-p.t)*a;if(!N2.over)G.time=t;const us=[];
  for(let k=0;k<c.u.length;k+=7){const u=N2.units.get(c.u[k]);if(!u)continue;const j=pi.get(c.u[k]);
    if(j===undefined){u.x=c.u[k+1];u.y=c.u[k+2];u.hp=c.u[k+3];}
    else{u.x=p.u[j+1]+(c.u[k+1]-p.u[j+1])*a;u.y=p.u[j+2]+(c.u[k+2]-p.u[j+2])*a;u.hp=p.u[j+3]+(c.u[k+3]-p.u[j+3])*a;}
    u.hp=Math.max(1,u.hp);us.push(u);}
  G.units=us;const by=N2.units;
  for(let k=0;k<c.u.length;k+=7){const u=by.get(c.u[k]);if(u)u.tgt=c.u[k+5]?by.get(c.u[k+5])||null:null;}
  // direct fire flickers along each shooter's line of fire, as in the replay
  G.tracers=[];for(const u of us){u.flash=Math.max(0,u.flash-.016);const e=u.tgt;if(!e||u.type==='art')continue;
    const ph=(t*2.6+u.id*.371)%1;if(ph<.45){G.tracers.push({x1:u.x,y1:u.y,x2:e.x,y2:e.y,t:.2*(1-ph/.45),side:u.side,heavy:u.type==='tank'});if(ph<.1)u.flash=.12;}}
  G.objs.forEach((o,k)=>{const q0=p.o[k],q1=c.o[k];o.p=q0[1]+(q1[1]-q0[1])*a;});
  // shells in flight, bursts, craters and air strikes, from the times the host gave them
  G.shells=N2.shells.filter(s=>s.t<=t&&t<s.t+s.T).map(s=>({...s,t:t-s.t}));N2.shells=N2.shells.filter(s=>t<s.t+s.T+2);
  G.booms=[];for(const b of N2.booms){if(b.t>t)continue;if(!b.c){b.c=1;G.craters.push({x:b.x,y:b.y});}if(t-b.t<.9)G.booms.push({...b,t:t-b.t});}
  N2.booms=N2.booms.filter(b=>t-b.t<2);if(G.craters.length>400)G.craters.splice(0,G.craters.length-400);
  G.strikes=N2.strikes.filter(s=>t>=s.t-AIR.delay-1&&t<=s.t+1.5).map(s=>({...s,done:t>=s.t}));N2.strikes=N2.strikes.filter(s=>t<=s.t+2);
  // the line of control is worked out on this screen, from what this side can see
  if(G.phase==='play'&&t-N2.front>=.5){N2.front=t;updateFront();}}
