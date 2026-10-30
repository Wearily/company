// COMPANY · src/ui/replay.js
// Watching, saving and opening replays: playback, the replay bar and timeline.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
// The replay swaps G for a view built from the recording (RP.RV), so the normal map drawing and HUD show it: both sides,
// no fog of war. Units are interpolated between snapshots, firing flickers between shooter and target, and shells,
// bombs, planes, craters, road damage, bridges, pontoons and objectives follow their recorded times.
let RP=null;
function startReplay(){const real=G;if(!real||!real.rec||real.rec.frames.length<2)return;const R=real.rec;
  const RV={player:real.player,scen:real.scen,limit:real.limit,mode:real.mode,climate:real.climate,seed:real.seed,diff:real.diff,strength:real.strength,
    depot:real.depot,trenches:real.trenches,phase:'over',paused:true,fog:false,orderMode:'move',tool:null,showSup:false,sup:real.sup,cov:real.cov,
    units:[],vis:{A:new Set(),D:new Set()},objs:real.objs.map(o=>({...o})),bridges:real.bridges.map(b=>({...b,down:false})),pontoons:[],
    dmg:new Uint8Array(N),dmgList:[],dmgSpots:[],dmgLines:[],craters:[],booms:[],shells:[],tracers:[],strikes:[],marks:[],ghosts:new Map(),
    frontSeg:[],frontSegP:[],frontSegE:[],ctrl:null,log:[],logDirty:true,stats:{lost:{A:0,D:0}},air:{...real.air},holdA:0,reinfDone:real.reinfDone,
    acc:{},time:0,speed:1,over:real.over,undo:[],replay:true,code:real.code,gen2:real.gen2};
  RP={real,R,RV,t:0,end:R.frames[R.frames.length-1].t,playing:true,speed:4,uc:new Map(),dmgIdx:-2,logN:-1,drag:false};G=RV;
  closePops();document.body.classList.add('replaying');$('replayBar').hidden=false;$('endModal').hidden=true;
  // the HUD is hidden behind the end sheet; show it before the timeline measures its width
  document.body.classList.remove('endopen');rpSpeedUI();buildTimeline();fit();replayView(0);updateHUD(true);}
function exitReplay(){if(!RP)return;const loaded=RP.real.loaded;G=RP.real;RP=null;document.body.classList.remove('replaying');$('replayBar').hidden=true;
  // a replay opened from a file goes back to the New game screen
  if(loaded){G=null;$('optResume').hidden=$('ngClose').hidden=true;$('startModal').hidden=false;preview();updateHUD(true);return;}
  G.logDirty=true;updateHUD(true);$('endModal').hidden=false;}
/* Shared replays: a battle's recording as a file (company-replay JSON, gzipped). It carries the game code (so the map is
   rebuilt exactly), every half-second snapshot, the events and log, any trenches dug, and the AI's reasoning (recAI).
   It can be opened again from Settings, and read outside the game. */
const REPLAY_FMT='company-replay';
function replayData(g){const R=g.rec;
  return{format:REPLAY_FMT,version:1,saved:new Date().toISOString(),code:g.code,
    opts:{scen:g.scen,mode:g.mode,climate:g.climate,side:g.player,strength:g.strength,diff:g.diff,seed:g.seed,gen2:genV(g.gen2)},
    over:g.over,time:g.time,plan:g.plan?{name:g.plan.name,key:g.plan.key}:null,trenches:g.trenches,
    names:{objs:g.objs.map(o=>({key:o.key,name:o.name,kind:o.kind||'',x:o.x,y:o.y})),bridges:g.bridges.map(b=>({id:b.id,x:Math.round(b.x),y:Math.round(b.y)}))},
    rec:{frames:R.frames.map(f=>({t:Math.round(f.t*100)/100,id:[...f.id],x:[...f.x],y:[...f.y],hp:[...f.hp],fl:[...f.fl],fire:f.fire,obj:f.obj,bh:f.bh,air:f.air,holdA:f.holdA,pont:f.pont,vp:f.vp})),
      meta:[...R.meta].map(([id,m])=>[id,m.side,m.type,m.max,m.died===Infinity?-1:m.died]),
      booms:R.booms,shells:R.shells,strikes:R.strikes,log:R.log,dmg:R.dmg.map(d=>({t:d.t,list:[...d.list]})),downs:R.downs,events:R.events,ai:R.ai||[]}};}
async function downloadReplay(g){g=g||(RP?RP.real:G);if(!g||!g.rec||g.rec.frames.length<2){addLog('No replay recorded yet');return;}
  let blob=new Blob([JSON.stringify(replayData(g))],{type:'application/json'}),ext='.json';
  try{if(window.CompressionStream){blob=await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob();ext='.json.gz';}}catch(e){}
  const a=document.createElement('a'),d=new Date(),p=n=>String(n).padStart(2,'0');
  a.href=URL.createObjectURL(blob);a.download=`company-replay-${g.code||'battle'}-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${ext}`;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);}
async function openReplayFile(file){try{let buf=await file.arrayBuffer();const b=new Uint8Array(buf);
    if(b[0]===0x1f&&b[1]===0x8b)buf=await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    const d=JSON.parse(new TextDecoder().decode(buf));if(d.format!==REPLAY_FMT)throw new Error('not a COMPANY replay');loadReplay(d);}
  catch(e){$('codeMsg').textContent='That file couldn’t be opened as a replay ('+e.message+').';}}
function loadReplay(d){const o=d.opts,sc=SCENARIOS[o.scen]||SCENARIOS.standard;closePops();if(RP)exitReplay();
  M=makeMap(o.seed,o.mode,o.gen2);setClimate(o.climate);fieldCache.clear();
  const R={...d.rec,meta:new Map(d.rec.meta.map(([id,side,type,max,died])=>[id,{side,type,max,died:died<0?Infinity:died}])),
    frames:d.rec.frames.map(f=>({...f,id:Uint16Array.from(f.id),x:Int16Array.from(f.x),y:Int16Array.from(f.y),hp:Uint8Array.from(f.hp),fl:Uint8Array.from(f.fl)})),
    dmg:d.rec.dmg.map(q=>({t:q.t,list:Int32Array.from(q.list)}))};
  G={player:o.side,strength:o.strength,seed:o.seed,mode:o.mode,gen2:o.gen2,diff:o.diff,climate:o.climate,scen:o.scen,limit:sc.limit,code:d.code,loaded:true,
    depot:{A:M.depA,D:M.depD},trenches:d.trenches||[],sup:{A:new Uint8Array(N),D:new Uint8Array(N)},cov:{A:new Uint8Array(N),D:new Uint8Array(N)},
    objs:M.objs.map((q,k)=>({...q,...((d.names&&d.names.objs&&d.names.objs[k])||{}),owner:'D',p:1,contested:false})),bridges:M.spans.map((b,id)=>({id,x:b.sym.x,y:b.sym.y,ang:b.sym.ang,len:b.sym.len,kind:b.sym.kind,cells:b.cells,down:false,hp:CROSSING_HP.bridge,max:CROSSING_HP.bridge})),
    air:{A:0,D:0},reinfDone:new Set(),over:d.over,rec:R,plan:d.plan,dmg:new Uint8Array(N),dmgList:[],pontoons:[],units:[],acc:{}};
  M.dmg=G.dmg;rebuildTrenchMask();applyCrossings();settings.style=settings.style||'satellite';renderTerrain();
  $('startModal').hidden=true;$('startModal').classList.remove('showmap');$('endModal').hidden=true;startReplay();}
const frameIndex=f=>f._ix||(f._ix=new Map(Array.from(f.id,(id,k)=>[id,k])));
function replayView(t){const {R,RV}=RP,F=R.frames;let lo=0,hi=F.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(F[m].t<=t)lo=m;else hi=m-1;}
  const f=F[lo],g=F[Math.min(lo+1,F.length-1)],a=g===f?0:clamp((t-f.t)/(g.t-f.t),0,1),gi=frameIndex(g);RV.time=t;
  const us=[];
  for(let k=0;k<f.id.length;k++){const id=f.id[k],m=R.meta.get(id);let u=RP.uc.get(id);
    if(!u){u={id,side:m.side,type:m.type,max:m.max,hp:m.max,x:0,y:0,path:[],queue:null,mode:'idle',sel:false,flash:0,moving:false,deployT:3,sup:true,fireAt:null,tgt:null};RP.uc.set(id,u);}
    const j=gi.get(id),x1=j!==undefined?g.x[j]:f.x[k],y1=j!==undefined?g.y[j]:f.y[k],h1=j!==undefined?g.hp[j]:f.hp[k];
    u.x=f.x[k]+(x1-f.x[k])*a;u.y=f.y[k]+(y1-f.y[k])*a;u.hp=Math.max(1,m.max*(f.hp[k]+(h1-f.hp[k])*a)/255);
    u.moving=Math.hypot(x1-f.x[k],y1-f.y[k])>1;u.sup=!(f.fl[k]&1);u.mode=f.fl[k]&2?'hold':'idle';u.deployT=f.fl[k]&4?3:0;u.wounded=!!(f.fl[k]&8);u.flash=0;us.push(u);}
  RV.units=us;const byId=new Map(us.map(u=>[u.id,u]));
  // direct fire: a tracer flickers along each shooter's line of fire
  RV.tracers=[];for(let k=0;k<f.fire.length;k+=2){const sh=byId.get(f.fire[k]),e=byId.get(f.fire[k+1]);if(!sh||!e)continue;
    const ph=(t*2.6+sh.id*.371)%1;if(ph<.45){RV.tracers.push({x1:sh.x,y1:sh.y,x2:e.x,y2:e.y,t:.2*(1-ph/.45),side:sh.side,heavy:sh.type==='tank'});if(ph<.1)sh.flash=.12;}}
  RV.objs.forEach((o,k)=>{o.owner=f.obj[k][0];o.p=f.obj[k][1]+(g.obj[k][1]-f.obj[k][1])*a;o.contested=f.obj[k][2];});
  RV.bridges.forEach((b,k)=>{b.down=R.downs.some(d=>d.id===b.id&&d.t<=t);b.hp=f.bh[k];});
  RV.pontoons=f.pont;RV.air=f.air;RV.holdA=f.holdA;
  let di=-1;for(let k=0;k<R.dmg.length&&R.dmg[k].t<=t;k++)di=k;
  if(di!==RP.dmgIdx){RP.dmgIdx=di;RV.dmg.fill(0);if(di>=0)for(const i of R.dmg[di].list)RV.dmg[i]=1;roadDamageChanged();}
  const B=R.booms;RV.booms=[];const cr=[];for(let k=0;k<B.length;k+=4){if(B[k]>t)continue;cr.push({x:B[k+1],y:B[k+2]});if(t-B[k]<.9)RV.booms.push({x:B[k+1],y:B[k+2],r:B[k+3],t:t-B[k]});}
  RV.craters=cr.length>400?cr.slice(-400):cr;
  RV.shells=R.shells.filter(q=>q.t<=t&&t<q.t+q.T).map(q=>({...q,t:t-q.t}));
  RV.strikes=R.strikes.filter(q=>t>=q.t-AIR.delay&&t<=q.t+1.5).map(q=>({...q,done:t>=q.t}));
  RV.stats.lost.A=RV.stats.lost.D=0;for(const m of R.meta.values())if(m.died<=t)RV.stats.lost[m.side]++;
  let n=0;while(n<R.log.length&&R.log[n].t<=t)n++;if(n!==RP.logN){RP.logN=n;RV.log=R.log.slice(Math.max(0,n-40),n).reverse();RV.logDirty=true;}
  for(const sd of ['A','D'])RV.vis[sd]=new Set(us.filter(u=>u.side!==sd).map(u=>u.id));}
// The timeline: each side's fighting strength over the battle, who held each objective (three thin bands), and markers
// for captures, air strikes, bridges falling, pontoons finished and reinforcements. The playhead is drawn on top each frame.
function buildTimeline(){const cvs=$('rpLine'),w=Math.max(200,cvs.clientWidth||0),h=92,k=Math.min(2,window.devicePixelRatio||1);
  cvs.width=w*k;cvs.height=h*k;const img=document.createElement('canvas');img.width=w*k;img.height=h*k;const c=img.getContext('2d');c.scale(k,k);
  const cs=getComputedStyle(document.documentElement),v=n=>cs.getPropertyValue(n).trim();
  const {R}=RP,F=R.frames,T=RP.end||1,L=22,X=t=>L+t/T*(w-L),gy=14,gh=44,by=64;
  const col={A:v('--atk-ring'),D:v('--defender-ring'),N:v('--neutral')};
  const str=F.map(f=>{const sum={A:0,D:0};for(let i=0;i<f.id.length;i++){const m=R.meta.get(f.id[i]);sum[m.side]+=W8[m.type]*f.hp[i]/255;}return sum;});
  const mx=Math.max(1,...str.map(q=>Math.max(q.A,q.D)));
  c.strokeStyle=v('--hairline');c.lineWidth=1;c.beginPath();c.moveTo(L,gy+gh/2);c.lineTo(w,gy+gh/2);c.stroke();
  // (Company Command: victory points are the lines that matter; strength is drawn faint behind them)
  const vpOn=!!F[0].vp;
  c.lineJoin='round';for(const sd of ['A','D']){c.strokeStyle=col[sd];c.lineWidth=2;c.globalAlpha=vpOn?.3:1;c.beginPath();F.forEach((f,i)=>{const x=X(f.t),y=gy+gh-2-str[i][sd]/mx*(gh-4);i?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();c.globalAlpha=1;
    if(vpOn){const k=sd==='A'?0:1;c.lineWidth=2.5;c.setLineDash([5,3]);c.beginPath();F.forEach((f,i)=>{const x=X(f.t),y=gy+gh-2-(f.vp?f.vp[k]:0)/ECON.vp0*(gh-4);i?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();c.setLineDash([]);}}
  // who held A, B and C: one rounded band each, orange while contested
  c.font=`700 10px ${v('--font')}`;c.textAlign='center';c.textBaseline='middle';
  for(let o=0;o<3;o++){const y=by+o*10;c.fillStyle=v('--ink-2');c.fillText('ABC'[o],7,y+4);
    c.save();c.beginPath();if(c.roundRect)c.roundRect(L,y,w-L,7,3.5);else c.rect(L,y,w-L,7);c.clip();
    F.forEach((f,i)=>{const x0=X(f.t),x1=F[i+1]?X(F[i+1].t):w;c.fillStyle=f.obj[o][2]?v('--contested'):col[f.obj[o][0]]||col.N;c.fillRect(x0,y,Math.max(1,x1-x0+.5),7);});c.restore();}
  // event markers along the top: captures in the taker's colour, air strikes, bridges down, pontoons, reinforcements
  const mk={air:v('--accent'),bridge:v('--danger'),pont:v('--ok'),reinf:v('--neutral')},ring=v('--badge-ring');
  for(const e of R.events){const x=X(e.t);c.beginPath();c.arc(x,7,5,0,Math.PI*2);c.fillStyle=e.k==='cap'?col[e.side]||col.N:mk[e.k]||col.N;c.fill();c.lineWidth=2;c.strokeStyle=ring;c.stroke();}
  RP.tl={img,w,h,k,L,acc:v('--accent'),ring};}
// (the timeline is redrawn whenever its on-screen width no longer matches the width it was drawn at)
function drawTimelineHead(){const cw=$('rpLine').clientWidth;if(cw&&Math.abs(Math.max(200,cw)-RP.tl.w)>1)buildTimeline();const tl=RP.tl,c=$('rpLine').getContext('2d');c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,tl.w*tl.k,tl.h*tl.k);c.drawImage(tl.img,0,0);c.setTransform(tl.k,0,0,tl.k,0,0);
  const x=tl.L+RP.t/(RP.end||1)*(tl.w-tl.L);c.fillStyle=tl.acc;c.fillRect(x-1,0,2,tl.h);c.beginPath();c.arc(x,7,6,0,Math.PI*2);c.fill();c.lineWidth=2;c.strokeStyle=tl.ring;c.stroke();
  setH($('rpTime'),`${fmt(RP.t)} <span>/ ${fmt(RP.end)}</span>`);setH($('rpPlay'),RP.playing?ICON.pause:ICON.play);$('rpPlay').setAttribute('aria-label',(RP.playing?'Pause':RP.t>=RP.end?'Replay':'Play')+' (Space)');}
function rpSeek(t){RP.t=clamp(t,0,RP.end);replayView(RP.t);}
function rpToggle(){if(RP.t>=RP.end){RP.t=0;RP.playing=true;}else RP.playing=!RP.playing;}
const RP_SPEEDS=[1,2,4,8,16];
function rpSpeedUI(){document.querySelectorAll('#rpSpeed button').forEach(b=>b.classList.toggle('on',+b.dataset.sp===RP.speed));}
function rpSpeedStep(d){const i=RP_SPEEDS.indexOf(RP.speed);RP.speed=RP_SPEEDS[clamp(i+d,0,RP_SPEEDS.length-1)];rpSpeedUI();}
// (wired up at startup, once the HUD helpers exist)
function initReplayUI(){
$('rpPlay').onclick=()=>RP&&rpToggle();$('rpRestart').onclick=()=>RP&&rpSeek(0);$('rpBack').onclick=()=>RP&&rpSeek(RP.t-15);$('rpFwd').onclick=()=>RP&&rpSeek(RP.t+15);
$('rpExit').onclick=exitReplay;$('rpSave').onclick=()=>downloadReplay();
$('endSave').onclick=()=>downloadReplay();$('setSaveReplay').onclick=()=>downloadReplay();
$('setOpenReplay').onclick=$('ngOpenReplay').onclick=()=>$('replayFile').click();
$('replayFile').onchange=e=>{const fl=e.target.files[0];e.target.value='';if(fl)openReplayFile(fl);};$('endWatch').onclick=startReplay;
document.querySelectorAll('#rpSpeed button').forEach(b=>b.onclick=()=>{if(!RP)return;RP.speed=+b.dataset.sp;rpSpeedUI();});
// clicking or dragging on the timeline seeks; a click right on a marker jumps to 3 s before that moment
{const cvs=$('rpLine'),at=e=>{const r=cvs.getBoundingClientRect(),L=RP.tl.L;return clamp((e.clientX-r.left-L)/(r.width-L),0,1)*RP.end;};
  cvs.addEventListener('pointerdown',e=>{if(!RP)return;cvs.setPointerCapture(e.pointerId);RP.drag=true;let t=at(e);
    const px=RP.end/(RP.tl.w-RP.tl.L)*6,ev=RP.R.events.reduce((b,q)=>Math.abs(q.t-t)<(b?Math.abs(b.t-t):px)?q:b,null);if(ev)t=Math.max(0,ev.t-3);rpSeek(t);});
  cvs.addEventListener('pointermove',e=>{if(RP&&RP.drag)rpSeek(at(e));});
  const up=()=>{if(RP)RP.drag=false;};cvs.addEventListener('pointerup',up);cvs.addEventListener('pointercancel',up);}
addEventListener('resize',()=>{if(RP)buildTimeline();});}

