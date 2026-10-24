// COMPANY · src/engine/record.js
// Recording the battle for the replay (recInit, recScan, recFrame, and recAI for the computer's reasoning).
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
// Every REC_DT s of game time the whole battle is snapshotted: each unit's position, health, flags and target, objective
// control, pontoons, bridge health and air strikes left. Events in between (shell launches, impacts, air strikes, the log,
// road damage, bridges falling, captures) are kept with their times. The replay plays this back without fog of war.
const REC_DT=.5;
function recInit(){const log=G.rec?G.rec.log:[];G.rec={frames:[],meta:new Map(),booms:[],shells:[],strikes:[],log,dmg:[],downs:[],events:[],ai:[],aiLast:new Map(),next:REC_DT,lastDmg:null};recFrame();}
// What the computer was thinking, every AI turn (2 s), for shared replays: the defender's reserve mode, focus objective
// and threat per objective; the attacker's plan and each group's stance, state and objective order; and, for each of the
// computer's units whose orders changed since the last turn, [id, role, group, mode, goal, retake, sector, falling,
// destination x, y, target id, hp %]. Only kept in the recording; the game never reads it.
function recAI(){const R=G.rec;if(!R||!R.ai)return;const side=G.player==='A'?'D':'A',e={t:Math.round(G.time*10)/10,side};
  if(G.dai)e.def={mode:G.dai.mode,ti:G.dai.ti,threat:G.dai.threat};
  if(G.plan){const P=G.plan;e.att={plan:P.name,commitAt:P.commitAt,groups:P.groups.map(g=>{const us=G.units.filter(u=>u.side==='A'&&u.grp===g.i);
    return[g.i,g.axis,g.stance,g.state,(g.objs||[]).join(''),us.length,g.size];})};}
  const ch=[];for(const u of G.units){if(u.side!==side)continue;const p=u.path&&u.path.length?u.path[u.path.length-1]:null;
    const v=[u.id,u.role||'',u.grp??-1,u.mode,u.goal||'',u.retake??-1,u.sector??-1,u.falling?1:0,p?Math.round(p.x):-1,p?Math.round(p.y):-1,u.tgt?u.tgt.id:-1,Math.round(u.hp/u.max*100)];
    const key=v.slice(0,10).join(',');if(R.aiLast.get(u.id)!==key){R.aiLast.set(u.id,key);ch.push(v);}}
  e.units=ch;R.ai.push(e);}
function recScan(){const R=G.rec;if(!R)return;
  for(const b of G.booms)if(!b._r){b._r=1;R.booms.push(G.time-b.t,b.x,b.y,b.r);}
  for(const s2 of G.shells)if(!s2._r){s2._r=1;R.shells.push({t:G.time-s2.t,x0:s2.x0,y0:s2.y0,x1:s2.x1,y1:s2.y1,T:s2.T,side:s2.side});}
  for(const s2 of G.strikes)if(!s2._r){s2._r=1;R.strikes.push({t:s2.t,x:s2.x,y:s2.y,ang:s2.ang,side:s2.side});R.events.push({t:s2.t,k:'air',side:s2.side});}
  if(G.time>=R.next){R.next=G.time+REC_DT;recFrame();}}
function recFrame(){const R=G.rec,us=G.units,n=us.length;
  const f={t:G.time,id:new Uint16Array(n),x:new Int16Array(n),y:new Int16Array(n),hp:new Uint8Array(n),fl:new Uint8Array(n),fire:[],
    obj:G.objs.map(o=>[o.owner,o.p,o.contested]),bh:G.bridges.map(b=>b.hp),air:{...G.air},holdA:G.holdA,
    pont:G.pontoons.map(p=>({id:p.id,side:p.side,a:p.a,b:p.b,x:p.x,y:p.y,progress:p.progress,done:p.done,from:p.from,hp:p.hp,max:p.max}))};
  us.forEach((u,k)=>{f.id[k]=u.id;f.x[k]=Math.round(u.x);f.y[k]=Math.round(u.y);f.hp[k]=Math.round(clamp(u.hp/u.max,0,1)*255);
    f.fl[k]=(u.sup?0:1)|(u.mode==='hold'?2:0)|(u.type==='art'&&u.deployT>=3&&!u.moving?4:0);
    if(!R.meta.has(u.id))R.meta.set(u.id,{side:u.side,type:u.type,max:u.max,died:Infinity});
    if(u.tgt&&u.type!=='art')f.fire.push(u.id,u.tgt.id);});
  recAdd(f);}
// (a finished snapshot: deaths, captures, pontoons, bridges down and road damage since the last one; a multiplayer
// guest builds its snapshots from the host's stream and adds them here too)
function recAdd(f){const R=G.rec,prev=R.frames[R.frames.length-1];
  if(prev){const now=new Set(f.id);for(const id of prev.id)if(!now.has(id))R.meta.get(id).died=f.t;
    f.obj.forEach((o,k)=>{if(o[0]!==prev.obj[k][0])R.events.push({t:f.t,k:'cap',side:o[0],key:G.objs[k].key});});
    for(const p of f.pont)if(p.done&&!prev.pont.some(q=>q.id===p.id&&q.done))R.events.push({t:f.t,k:'pont',side:p.side});}
  for(const b of G.bridges)if(b.down&&!R.downs.some(d=>d.id===b.id)){R.downs.push({id:b.id,t:f.t});R.events.push({t:f.t,k:'bridge'});}
  if(G.dmgList!==R.lastDmg){R.lastDmg=G.dmgList;R.dmg.push({t:f.t,list:Int32Array.from(G.dmgList)});}
  R.frames.push(f);}

