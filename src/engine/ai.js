// COMPANY · src/engine/ai.js
// The computer players: aiDefender, planAttack, aiAttacker, engineers.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
// rough fighting weight of each unit type, for weighing up forces
const W8={inf:1,tank:2,art:.6,eng:.6};
// Each AI side remembers where it last saw each enemy unit (G.seen) and plans from that, never from units it hasn't seen.
// Memories older than a minute, or of units that are gone, are dropped.
function aiSee(side){const m=G.seen[side],alive=new Set(G.units.map(u=>u.id));
  for(const e of G.units)if(e.side!==side&&G.vis[side].has(e.id))m.set(e.id,{id:e.id,x:e.x,y:e.y,type:e.type,t:G.time});
  for(const [id,s] of m)if(!alive.has(id)||G.time-s.t>60)m.delete(id);
  return [...m.values()];}
// The best covered spot within r of p that `type` can stand on (trench, then town, then forest, then the nearest
// open ground), optionally only on one bank (side -1 north, 1 south).
function coverNear(p,r,type,side){let best=null,bs=-1e9;const rc=Math.ceil(r/C),c0=cellOf(p.x,p.y),cx=c0%GW,cy=Math.floor(c0/GW);
  for(let dy=-rc;dy<=rc;dy++)for(let dx=-rc;dx<=rc;dx++){const nx=cx+dx,ny=cy+dy;if(nx<1||ny<1||nx>=GW-1||ny>=GH-1)continue;
    const i=ny*GW+nx,d=Math.hypot(dx,dy)*C;if(d>r||!mult(type,i))continue;const q=cc(i);if(side&&M.wet&&M.side(q.x,q.y)!==side)continue;
    const cv=M.trench[i]?3:M.cls[i]===URBAN?2:M.cls[i]===FOREST?1.6:iceAt(i)?-2:0,sc=cv*40-d*.25;if(sc>bs){bs=sc;best=q;}}
  return best||{x:p.x,y:p.y};}
// Waiting units stand in a loose line across the direction of the enemy (fx, fy), 44 px apart, with any second rank
// 64 px behind, so no four are ever within an air strike's reach of each other. Slot k of n, around point c.
function slotPos(c,k,n,fx,fy,type){const per=Math.min(n,7),rank=Math.floor(k/per),col=k%per,cols=Math.min(per,n-rank*per),L=Math.hypot(fx,fy)||1,ux=fx/L,uy=fy/L;
  const off=(col-(cols-1)/2)*44,back=rank*64,x=c.x-uy*off-ux*back,y=c.y+ux*off-uy*back;return cc(nearestPassable(type,clamp(x,8,W-8),clamp(y,8,H-8),true));}
// where the defender holds an objective from: a bridge from the north bank, anything else on the spot
const defendSpot=ob=>ob.kind==='bridge'?{x:ob.x,y:M.ry(ob.x)-M.rw(ob.x)/2-30}:{x:ob.x,y:ob.y};
// A spot near p where the attacker can wait out of reach: moved south toward its depot in 30 px steps until no enemy it
// remembers (guns aside) has it within that enemy's range (with any high-ground bonus) plus `keep`. A defender dug in on the
// attacker's own bank would otherwise sit on top of its assembly areas, pin lines and gun positions.
function aiSafe(p,seen,keep,type){let q={x:p.x,y:p.y};
  for(let k=0;k<20&&seen.some(s=>s.type!=='art'&&dist(s,q)<rangeOf(s)+keep);k++)q={x:q.x+(M.depA.x-q.x)*.04,y:Math.min(H-30,q.y+30)};
  return q.x===p.x&&q.y===p.y?p:cc(nearestPassable(type,q.x,q.y,true));}
// Artillery fire missions on remembered enemies: the aim point with the most enemy weight within 55 px, favouring fresh
// sightings and enemies near the focus point, never within 70 px of friendly troops or (for the attacker) of a crossing
// it still needs. Returns the aim point, or null when there is nothing worth shelling in range.
function aiArtillery(u,known,side,focus,avoid){const R=rangeOf(u)*.97,own=G.units.filter(v=>v.side===side);let best=null,bs=0;
  for(const s of known){const d=dist(u,s);if(d>R||d<TYPES.art.minRange||own.some(v=>dist(v,s)<70)||(avoid&&avoid(s)))continue;
    let sc=0;for(const t of known)if(dist(s,t)<55)sc+=W8[t.type];
    sc*=(1+.6*Math.max(0,1-dist(s,focus)/400))*(G.time-s.t<6?1.3:.8);if(sc>bs){bs=sc;best=s;}}
  return best?{x:best.x+(Math.random()-.5)*16,y:best.y+(Math.random()-.5)*16}:null;}
// Defender AI (the player attacks).
//  Reserve (tanks and a few infantry): waits under cover behind the town; when an objective is threatened it moves to a
//  covered blocking position behind it, and only counterattacks when the objective is actually being taken and the odds
//  are fair (or it has already fallen). It never crosses to the attacker's bank. Hurt reserve units fall back to heal.
//  Line infantry: hold their trench posts. Posts on the far bank are given up when the enemy comes on in strength. When
//  an objective is under attack, up to two units shift to it from the quietest objective, which always keeps two.
//  Badly hurt line units that aren't fighting pull back to heal.
//  Artillery: fire missions on remembered attackers, preferring those near the threatened objective; moves up when it
//  has had nothing in range for a while. Engineer: repairs cratered road.
function aiDefender(){const o=G.objs,D=G.units.filter(u=>u.side==='D'),recent=aiSee('D').filter(s=>G.time-s.t<20),R=Math.random;
  const res=D.filter(u=>u.role==='reserve'),line=D.filter(u=>u.role==='line');
  if(!G.dai){const h=res.length?{x:res.reduce((a,u)=>a+u.home.x,0)/res.length,y:res.reduce((a,u)=>a+u.home.y,0)/res.length}:o[1];G.dai={stage:coverNear(h,150,'tank',-1),block:{},mode:'stage',ti:-1};}
  const S=G.dai,north=p=>!M.wet||M.side(p.x,p.y)<0;
  const enemyNear=(p,r)=>recent.reduce((a,s)=>a+(dist(s,p)<r?W8[s.type]:0),0),ownNear=(p,r,skip)=>D.reduce((a,u)=>a+(dist(u,p)<r&&!(skip&&skip(u))?W8[u.type]*u.hp/u.max:0),0);
  // how threatened each objective is: recently seen attackers near it, counted double inside it and more on our bank
  const threat=o.map(ob=>{let t=0,inside=0;for(const s of recent){const d=dist(s,ob);if(d>330)continue;let w=W8[s.type];if(d<CAPTURE.radius+25){w*=2;inside+=W8[s.type];}if(north(s))w*=1.4;t+=w;}
    if(ob.owner==='A')t+=4;else if(ob.p<.98)t+=2;return{t,crit:ob.owner==='A'||ob.p<.98||inside>0};});
  let ti=-1,tt=1.5;threat.forEach((x,k)=>{if(x.t>tt){tt=x.t;ti=k;}});
  S.threat=threat.map(x=>Math.round(x.t*10)/10);
  // --- reserve
  let mode='stage',spot=S.stage;
  if(ti>=0){const ob=o[ti],hold=defendSpot(ob),rs=res.reduce((a,u)=>a+W8[u.type]*u.hp/u.max,0),en=enemyNear(ob,230),loc=ownNear(ob,170,u=>u.role==='reserve');
    if(threat[ti].crit&&(rs+loc*.5>=en*.85||(ob.owner==='A'&&rs>=en*.6))){mode='counter';spot=hold;}
    else{mode='block';spot=S.block[ti]||(S.block[ti]=coverNear({x:hold.x+(S.stage.x-hold.x)*.45,y:hold.y+(S.stage.y-hold.y)*.45},130,'tank',M.wet?-1:0));}}
  if(S.mode!==mode||S.ti!==ti){S.mode=mode;S.ti=ti;}
  const rs=res.slice().sort((a,b)=>a.id-b.id),face=ti>=0?{x:o[ti].x-spot.x,y:o[ti].y-spot.y}:{x:0,y:1};
  rs.forEach((u,k)=>{if(u.hp<u.max*.3)u.falling=true;else if(u.hp>hpTop(u)*.8)u.falling=false;
    const tg=u.falling?slotPos(S.stage,k,rs.length,0,1,u.type):mode==='counter'?{x:spot.x+(R()-.5)*50,y:spot.y+(R()-.5)*40}:slotPos(spot,k,rs.length,face.x,face.y,u.type),key=(u.falling?'heal':mode)+ti;
    if(u.goal!==key||(!u.path.length&&!u.tgt&&dist(u,tg)>50)){u.goal=key;route(u,tg.x,tg.y,u.falling?'move':'amove',spot.x,spot.y);}});
  // --- line infantry
  for(const u of line)if(u.sector===undefined)u.sector=o.reduce((b,ob,k)=>dist(u.post,ob)<dist(u.post,o[b])?k:b,0);
  // far-bank posts are given up when the enemy comes on in strength
  if(M.wet)for(const u of line){if(M.side(u.post.x,u.post.y)<0)continue;
    if(enemyNear(u,260)>=Math.max(3,ownNear(u,160)*2.5)){const ob=o[u.sector],np=coverNear({x:ob.x,y:M.ry(ob.x)-M.rw(ob.x)/2-45},120,'inf',-1);u.post=np;route(u,np.x,np.y,'move');}}
  // reinforce the threatened objective from the quietest one, which keeps at least two
  if(ti>=0&&threat[ti].crit&&line.filter(u=>u.sector===ti).length<4){
    const q=threat.map((x,k)=>({k,t:x.t,n:line.filter(u=>u.sector===k).length})).filter(x=>x.k!==ti&&x.t<1&&x.n>2).sort((a,b)=>a.t-b.t)[0];
    if(q){const posts=line.map(u=>u.post),spotNear=()=>{let best=null,bd=-1;for(const t of G.trenches)for(const p of t){if(dist(p,defendSpot(o[ti]))>150||!north(p))continue;const m=Math.min(...posts.map(v=>dist(v,p)),1e9);if(m>bd){bd=m;best=p;}}return best;};
      for(const u of line.filter(u=>u.sector===q.k&&!u.tgt).sort((a,b)=>dist(a,o[ti])-dist(b,o[ti])).slice(0,Math.min(2,q.n-2))){
        const p=spotNear()||coverNear(defendSpot(o[ti]),120,'inf',M.wet?-1:0);u.sector=ti;u.post={x:p.x,y:p.y};posts.push(u.post);route(u,p.x,p.y,'move');}}}
  // a lost objective is retaken by the line units nearby when they're strong enough for the attackers seen there (or
  // none have been seen): its own sector's units first, then ones from quiet objectives that keep at least two. They
  // go back to their posts once it's held again, and give up if the attackers there turn out too strong.
  for(const u of line)if(u.retake!=null&&(u.falling||(o[u.retake].owner==='D'&&o[u.retake].p>=1))){u.retake=null;if(!u.tgt&&!u.falling)route(u,u.post.x,u.post.y,'amove');}
  o.forEach((ob,k)=>{if(ob.owner==='D')return;
    const en=enemyNear(ob,220),spare=s=>threat[s].t<1&&line.filter(v=>v.sector===s&&v.retake==null).length>2;
    const cand=line.filter(u=>!u.falling&&u.hp>u.max*.45&&dist(u,ob)<620&&(u.sector===k||u.retake===k||spare(u.sector)));
    const mine=cand.reduce((a,u)=>a+W8[u.type]*u.hp/u.max,0);
    if(mine>=Math.max(1.5,en*1.15)){for(const u of cand.sort((a,b)=>dist(a,ob)-dist(b,ob)).slice(0,5)){if(u.retake===k)continue;
        u.retake=k;route(u,ob.x+(R()-.5)*60,ob.y+(R()-.5)*60,'amove',ob.x,ob.y);}}
    else if(mine<en*.7)for(const u of line)if(u.retake===k){u.retake=null;route(u,u.post.x,u.post.y,'move');}});
  for(const u of line){if(u.hp<u.max*.3&&!u.tgt)u.falling=true;else if(u.hp>hpTop(u)*.75)u.falling=false;
    if(u.falling){if(dist(u,S.stage)>60&&!u.path.length)route(u,S.stage.x,S.stage.y,'move');continue;}
    if(u.retake!=null){const ob=o[u.retake];if(!u.path.length&&!u.tgt&&dist(u,ob)>45)route(u,ob.x+(R()-.5)*50,ob.y+(R()-.5)*50,'amove',ob.x,ob.y);continue;}
    if(!u.path.length&&!u.tgt&&dist(u,u.post)>30)route(u,u.post.x,u.post.y,'amove');}
  // --- artillery
  const focus=o[ti>=0?ti:1];
  for(const u of D.filter(u=>u.type==='art')){if(u.path.length)continue;const aim=aiArtillery(u,recent,'D',focus);u.fireAt=aim;
    u.aiIdle=aim?0:(u.aiIdle||0)+2;
    // nothing in range for a while: move up behind the threatened objective, staying well back from the enemy
    if(u.aiIdle>40&&dist(u,focus)>rangeOf(u)*.8){const d=dist(S.stage,focus)||1,k=Math.min(1,rangeOf(u)*.7/d),p={x:focus.x+(S.stage.x-focus.x)*k,y:focus.y+(S.stage.y-focus.y)*k};
      const sp={x:p.x+(p.x<focus.x?-1:1)*90*(u.id%2?1:-1),y:p.y};
      if(enemyNear(sp,250)<1&&!res.some(v=>dist(v,sp)<90)){const c=coverNear(sp,80,'art',M.wet?-1:0);route(u,c.x,c.y,'move');u.aiIdle=0;}}}
  for(const u of D)if(u.role==='eng')aiRepair(u);}
// The attacker AI draws one doctrine per game, with random flanks, group sizes, timings and objective order,
// so a defender can't learn a single answer. Each doctrine is a set of groups. A group gathers at an assembly area
// south of its crossing, waits for 70% of its units (or a minute), then moves off. Group stances:
//   assault: cross at its axis and take its objectives in order    probe: a small assault that falls back to pin if halved
//   pin: sit on the south bank opposite its crossing and fire, then join the assault later    reserve: wait to be committed
const DOCTRINE_NAME={broad:'Broad front',feint:'Feint, then main thrust',hook:'Flank hook',bombard:'Bombard, then assault',crossing:'Surprise river crossing',probe:'Probe and exploit'};
function planAttack(){const o=G.objs,R=Math.random,pick=a=>a[R()*a.length|0],jit=t=>t*(.75+R()*.5);
  const axes={M:{x:o[0].x,via:null}};
  if(M.vias)M.vias.forEach((v,k)=>{axes['V'+k]={x:v.x,via:v};});else{if(M.viaW)axes.W={x:M.viaW.x,via:M.viaW};if(M.viaE)axes.E={x:M.viaE.x,via:M.viaE};}
  const flanks=Object.keys(axes).filter(k=>k!=='M'),flank=()=>flanks.length?pick(flanks):'M';
  const pool=G.units.filter(u=>u.side==='A'&&(u.type==='inf'||u.type==='tank')&&!u.holdAt);
  for(let i=pool.length-1;i>0;i--){const j=R()*(i+1)|0;[pool[i],pool[j]]=[pool[j],pool[i]];}
  const P={axes,flank,groups:[],site:null};
  P.asm=k=>{const x=clamp(axes[k].x+(R()-.5)*80,60,W-60);return cc(nearestPassable('tank',x,clamp(M.ry(x)+M.rw(x)/2+240,0,H-50)));};
  // objectives nearest the crossing come first, with the first two sometimes swapped
  const order=k=>{const pt=axes[k].via||o[0],ix=[0,1,2].sort((a,b)=>dist(pt,o[a])-dist(pt,o[b]));if(R()<.35)[ix[0],ix[1]]=[ix[1],ix[0]];return ix;};
  const mk=(axis,stance,n,start)=>{const g={i:P.groups.length,axis,stance,start,state:'assemble',probe:stance==='probe',objs:order(axis),asm:P.asm(axis)};
    const x=clamp(axes[axis].x+(R()-.5)*60,40,W-40);g.pinPt=cc(nearestPassable('tank',x,M.ry(x)+M.rw(x)/2+70));g.pinUntil=start+jit(260);
    const us=pool.splice(0,Math.min(n,pool.length));g.size=us.length;us.forEach((u,k)=>{u.grp=g.i;u.slot=k;u.via=null;u.viaFor=null;});P.groups.push(g);return g;};
  const N=pool.length;let d=pick(SC().econ?['broad','hook','feint']:MAP_MODES[M.mode].doctrines.filter(k=>M.wet||k!=='crossing'));
  if(d==='crossing'){const xs=[];for(let x=120;x<W-120;x+=30){if(G.bridges.some(b=>Math.abs(b.x-x)<200)||Math.abs(x-o[0].x)<250)continue;const s=pontoonSite(x);if(!s.err)xs.push(x);}
    if(xs.length){const x=pick(xs);P.site=startPontoon('A',x,M.ry(x),true);}
    if(P.site){const a=P.site.a;axes.P={x:P.site.x,via:cc(nearestPassable('inf',a.x,a.y-40))};}else d='hook';}
  P.name=DOCTRINE_NAME[d];P.key=d;
  if(d==='broad'){const ks=Object.keys(axes);ks.forEach(k=>mk(k,'assault',Math.ceil(N/ks.length),jit(25)));}
  else if(d==='feint'){const f=flank();mk(f,'probe',4,jit(10));mk(pick(['M','M',...flanks.filter(k=>k!==f)]),'assault',N,jit(100));}
  else if(d==='hook'){mk('M','pin',Math.round(N*.3),jit(15));mk(flank(),'assault',N,jit(30));}
  else if(d==='bombard'){mk('M','assault',Math.round(N*.6),jit(170));mk(pick(Object.keys(axes)),'assault',N,jit(280));}
  else if(d==='crossing'){mk('M','pin',Math.round(N*.3),jit(20));mk('P','assault',N,Infinity);}
  else{for(const k of Object.keys(axes))mk(k,'probe',3,jit(15));mk('M','reserve',N,Infinity);P.commitAt=jit(160);}
  for(const u of G.units)if(u.side==='A'&&u.type==='art')u.obj=-1;
  return P;}
function aiAttacker(){if(G.time<3)return;const o=G.objs,P=G.plan,R=Math.random,A=G.units.filter(u=>u.side==='A'),seen=aiSee('A'),known=seen.filter(s=>G.time-s.t<20);
  const live=g=>A.filter(u=>u.grp===g.i);
  // an objective can only be taken if there is ground to stand on inside its capture zone (a causeway objective can't once
  // its causeway is down), so groups pass over the ones they can't take
  const takeable=o.map(ob=>ob.owner!=='A'&&dist(cc(nearestPassable('inf',ob.x,ob.y)),ob)<=CAPTURE.radius-8),nextObj=g=>{const k=g.objs.find(i=>takeable[i]);return k!==undefined?k:o.findIndex((x,i)=>takeable[i]);};
  // the surprise crossing falls back to a flank if its pontoon site is destroyed or no engineers are left to build it, and
  // goes when the pontoon is done
  if(P.site&&!P.site.done&&(!G.pontoons.includes(P.site)||!A.some(u=>u.type==='eng'))){P.site=null;for(const g of P.groups)if(g.axis==='P'){g.axis=P.flank();g.asm=P.asm(g.axis);g.start=G.time+15;g.state='assemble';}}
  // enemies kept in mind for staying out of reach: a sighting is kept for three minutes, since troops dug in and holding
  // fire are hard to spot again, unless our own troops get close enough to see the spot and find it empty
  P.danger=P.danger||new Map();for(const s of seen)P.danger.set(s.id,s);
  {const alive=new Set(G.units.map(u=>u.id));for(const [id,s] of P.danger)if(!alive.has(id)||G.time-s.t>180||(G.time-s.t>2&&A.some(u=>dist(u,s)<TYPES[u.type].vision*.5)))P.danger.delete(id);}
  // Trench lines count as suspected armor when choosing where to wait and pin from (earthworks show; whoever is dug in
  // there may not), until our own troops get close enough to see a stretch and find no one in it. They don't count for
  // deciding whether a unit is under fire, or for placing the guns, which have to stay in range of their objective.
  const danger=[...P.danger.values()];
  if(P.dugRef!==G.trenches||P.dugN!==G.trenches.length){P.dugRef=G.trenches;P.dugN=G.trenches.length;P.dug=[];for(const t of G.trenches)t.forEach((q,k)=>{if(k%2===0)P.dug.push({x:q.x,y:q.y,type:'tank'});});}
  P.dug=P.dug.filter(q=>!A.some(u=>u.type!=='art'&&dist(u,q)<TYPES[u.type].vision*.5)||G.units.some(e=>e.side==='D'&&G.vis.A.has(e.id)&&dist(e,q)<60));
  const wary=danger.concat(P.dug);
  for(const g of P.groups){const mem=live(g);
    // where the group actually waits and pins from: its planned spots, moved back out of reach of enemies it has seen. Once
    // the attacker firmly holds an objective nearer the group's next one, an assault regroups and heals there instead of
    // trekking back to its start line on the far side of the river.
    const nk=g.stance==='pin'?-1:nextObj(g),fwd=nk<0?null:o.filter(x=>x.owner==='A'&&x.p<=-.9&&dist(x,o[nk])<dist(g.asm,o[nk])-150).sort((a,b)=>dist(a,o[nk])-dist(b,o[nk]))[0];
    g.at=aiSafe(fwd?cc(nearestPassable('tank',fwd.x,fwd.y+40)):g.asm,wary,40,'tank');g.pinAt=aiSafe(g.pinPt,wary,0,'inf');
    // seconds the guns have spent shelling the group's next objective (an assault's first wave waits for some of it)
    if(nk>=0&&g.state==='assemble')g.prep=(g.prep||0)+(A.some(v=>v.type==='art'&&v.fireAt&&dist(v.fireAt,o[nk])<CAPTURE.hold+120)?2:0);
    if(g.axis==='P'&&P.site&&P.site.done&&g.start===Infinity)g.start=G.time;
    // probe and exploit: commit the reserve behind the probe that got furthest for the fewest losses
    if(g.stance==='reserve'&&G.time>=P.commitAt){let best=null,bs=-1e9;
      for(const q of P.groups){if(!q.probe)continue;const m=live(q);if(!m.length)continue;const t=o[q.objs.find(i=>o[i].owner!=='A')??q.objs[0]];
        const sc=m.length/q.size*300-Math.min(...m.map(u=>dist(u,t)));if(sc>bs){bs=sc;best=q;}}
      if(best){g.axis=best.axis;g.objs=best.objs.slice();}g.stance='assault';g.state='go';P.commitAt=Infinity;}
    // an assault that is down to 40% of its strength still fighting (the rest lost or falling back hurt) breaks off,
    // regroups and heals, then goes again together, rather than sending its units back in one at a time as they recover
    if(g.stance==='assault'&&g.state==='go'&&mem.filter(u=>!u.falling).length<g.size*DIFFICULTY[G.diff].breakAt){g.state='assemble';g.start=G.time+60+R()*60;g.size=mem.length;g.waves=(g.waves||1)+1;
      for(const u of mem){u.path=[];u.mode='idle';u.via=null;u.viaFor=null;}}
    if(g.stance==='probe'&&g.state==='go'&&mem.length<g.size*.5){g.stance='pin';g.pinUntil=G.time+120+R()*120;}
    if(g.stance==='pin'&&g.state==='go'&&(G.time>=g.pinUntil||o.some(x=>x.owner==='A'))){g.stance='assault';for(const u of mem)if(u.mode==='hold'){u.mode='idle';u.path=[];}}
    // an assault's first wave also waits until the guns have shelled its objective for about 25 s (at most a minute past its start)
    const prepped=g.stance!=='assault'||g.waves>1||!A.some(v=>v.type==='art')||(g.prep||0)>=24||G.time>g.start+60;
    if(g.state==='assemble'&&G.time>=g.start&&prepped&&(mem.filter(u=>!u.falling&&dist(u,g.at)<230).length>=mem.length*.7||G.time>g.start+(g.waves>1?120:60)))g.state='go';}
  // how long each objective has had attackers in it without the capture moving (contested out of reach, say)
  P.stall=P.stall||[0,0,0];P.lastP=P.lastP||o.map(x=>x.p);
  o.forEach((ob,k)=>{const inside=A.some(u=>u.type!=='art'&&dist(u,ob)<CAPTURE.radius);P.stall[k]=inside&&ob.owner!=='A'&&Math.abs(ob.p-P.lastP[k])<.01?P.stall[k]+2:0;P.lastP[k]=ob.p;});
  // artillery supports the biggest assault on the move or about to go (it shells ahead of it), else the biggest group on the move
  const big=(a,b)=>live(b).length-live(a).length;
  const main=P.groups.filter(g=>g.stance==='assault'&&(g.state==='go'||G.time>=g.start-30)).sort(big)[0]||P.groups.filter(g=>g.state==='go'&&g.stance!=='reserve').sort(big)[0]||P.groups[P.groups.length-1];
  const artT=main?nextObj(main):-1;
  for(const u of A){
    if(u.type==='eng'){aiEngineer(u);continue;}
    if(u.type==='art'){if(artT<0)continue;const tgt=o[artT],d=dist(u,tgt);
      // The gun closes to about 300 px of the objective, but never ahead of the leading troops of the group it supports,
      // never to within 90 px of the river on the defender's side of it, and never into reach of an enemy it has seen.
      const fwd=live(main).filter(v=>v.type==='inf'||v.type==='tank'),lead=fwd.length?Math.min(...fwd.map(v=>dist(v,tgt))):d,want=Math.max(300,lead+100);
      let pos=u;if(d>want+50){const k=(d-want)/d;pos={x:u.x+(tgt.x-u.x)*k,y:u.y+(tgt.y-u.y)*k};
        if(M.wet)pos.y=Math.max(pos.y,M.ry(pos.x)+M.rw(pos.x)/2+90);}
      pos=aiSafe(pos,danger,60,'art');
      if(dist(u,pos)>40){if(!u.path.length||!u.dest||dist(u.dest,pos)>60){u.dest=pos;route(u,pos.x,pos.y,'move');}continue;}
      const vis=G.units.some(e=>e.side==='D'&&G.vis.A.has(e.id)&&dist(u,e)<=TYPES.art.range);
      // its shells wear crossings down, so it shells the far bank beyond any bridge or pontoon near the objective
      const near=q=>strikable().some(c=>{const [a,b]=crossingEnds(c);return segDist(q,a,b)<60;});
      // fire on remembered defenders in range first, otherwise on the objective area if it is in range
      let aim=aiArtillery(u,known,'A',tgt,near);
      // with no one in sight it shells the earthworks around the objective (dug-in troops are hard to see, their trenches aren't)
      if(!aim){const tp=[];for(const t of G.trenches)for(const q of t)if(dist(q,tgt)<CAPTURE.hold+90&&dist(u,q)<rangeOf(u)*.95&&dist(u,q)>TYPES.art.minRange&&!near(q)&&!A.some(v=>v.type!=='art'&&dist(v,q)<70))tp.push(q);
        if(tp.length){const q=tp[R()*tp.length|0];aim={x:q.x+(R()-.5)*16,y:q.y+(R()-.5)*16};}}
      if(!aim&&d<rangeOf(u)*.95){aim={x:tgt.x+(R()-.5)*60,y:tgt.y+(R()-.5)*60};
        if(near(aim))aim={x:tgt.x+(R()-.5)*60,y:M.ry(tgt.x)-M.rw(tgt.x)/2-90+(R()-.5)*30};if(near(aim))aim=null;}
      u.fireAt=vis?null:aim;
      continue;}
    // (counterattack) units already holding an objective stay on it
    if(u.holdAt){const p=u.holdAt;if(dist(u,p)>25){if(!u.path.length&&!u.tgt)route(u,p.x,p.y,'amove');}else if(!u.path.length)u.mode='hold';continue;}
    const g=P.groups[u.grp];if(!g)continue;
    // badly hurt units fall back to their assembly area to heal, then rejoin (healed as far as their wounds allow)
    if(u.hp<u.max*.3)u.falling=true;else if(u.hp>hpTop(u)*.8)u.falling=false;
    if(u.falling){if(dist(u,g.at)>60&&(u.mode!=='move'||!u.path.length||dist(u.path[u.path.length-1],g.at)>80))route(u,g.at.x,g.at.y,'move');continue;}
    // waiting units take their slot in a loose line facing north
    if(g.state==='assemble'||g.stance==='reserve'){const sp=slotPos(g.at,u.slot||0,Math.max(g.size,(u.slot||0)+1),0,-1,u.type);if(dist(u,sp)>40&&(!u.path.length||dist(u.path[u.path.length-1],sp)>80))route(u,sp.x,sp.y,'move',g.at.x,g.at.y);continue;}
    // the pin line holds just out of reach of the defenders it has found (it is there to tie them down, not to fight them)
    // Under fire from defenders it has found, a unit pulls back to its slot instead of standing to trade shots with them.
    if(g.stance==='pin'){const p=aiSafe(slotPos(g.pinAt,u.slot||0,Math.max(g.size,(u.slot||0)+1),0,-1,u.type),wary,0,u.type);
      if(dist(u,p)>30){if(danger.some(s=>s.type!=='art'&&dist(s,u)<rangeOf(s)+10)){if(u.mode!=='move'||!u.path.length||dist(u.path[u.path.length-1],p)>40)route(u,p.x,p.y,'move',g.pinAt.x,g.pinAt.y);}
        else if((!u.path.length||dist(u.path[u.path.length-1],p)>80)&&!u.tgt)route(u,p.x,p.y,'amove',g.pinAt.x,g.pinAt.y);}
      else if(!u.path.length)u.mode='hold';continue;}
    if(u.path.length||u.tgt)continue;
    if(u.viaFor!==g.axis){u.viaFor=g.axis;u.via=P.axes[g.axis].via;}
    // a unit already across (regrouped at a taken objective, say) doesn't go back to its crossing first
    if(u.via&&M.side(u.x,u.y)<0)u.via=null;
    // a crossing that can't be reached (its bridge is down) is dropped, and the unit heads straight for its objective
    if(u.via){if(dist(u,u.via)<70)u.via=null;else if(route(u,u.via.x+(R()-.5)*40,u.via.y,'amove',u.via.x,u.via.y))continue;else u.via=null;}
    const oi=nextObj(g);
    // nothing left that can be taken: wait back at the assembly area (engineers may yet bridge the way)
    if(oi<0){if(!u.path.length&&dist(u,g.at)>70)route(u,g.at.x,g.at.y,'move');continue;}
    const t=o[oi];
    // In the objective but it isn't ours yet. Normally hold on: the capture runs while we're inside. If it has been stuck
    // for 20 s (the defenders holding it are out of reach), go after them, or push through to its far side.
    if(dist(u,t)<=90){if(P.stall[oi]<20){if(dist(u,t)>40&&!u.path.length)route(u,t.x+(R()-.5)*60,t.y+(R()-.5)*60,'amove',t.x,t.y);continue;}
      const foe=known.filter(s=>s.type!=='art'&&dist(s,t)<CAPTURE.hold+60).sort((a,b)=>dist(a,u)-dist(b,u))[0],f0=foe||defendSpot(t);
      // (aim points are snapped to a 48 px grid so units heading the same way share one route search)
      const fs={x:Math.round(f0.x/48)*48,y:Math.round(f0.y/48)*48};
      if(dist(u,fs)>40)route(u,fs.x+(R()-.5)*40,fs.y+(R()-.5)*40,'amove',fs.x,fs.y);continue;}
    route(u,t.x+(R()-.5)*80,t.y+(R()-.5)*80,'amove',t.x,t.y);}}
// Attacker engineers bridge the river beside any fallen bridge, help finish an open pontoon, or wait south of the main bridge.
function aiEngineer(u){const ps=G.plan&&G.plan.site;
  if(ps&&!ps.done&&G.pontoons.includes(ps)){if(u.build!==ps.id||(!u.path.length&&dist(u,u.buildEnd)>=PONTOON.reach))assignBuild(u,ps);return;}
  const own=G.pontoons.find(p=>p.id===u.build);
  if(own){if(!u.path.length&&dist(u,u.buildEnd)>=PONTOON.reach)assignBuild(u,own);return;}
  for(const b of G.bridges){if(!b.down||G.pontoons.some(p=>p.side===u.side&&dist(p,b)<160))continue;
    for(const off of [50,-50,90,-90]){const s=startPontoon(u.side,b.x+off,M.ry(b.x+off),true);if(s&&assignBuild(u,s))return;}}
  const open=G.pontoons.find(p=>p.side===u.side&&!p.done);if(open&&assignBuild(u,open))return;
  if(aiRepair(u))return;
  const o=G.objs[0],wait=aiSafe({x:o.x,y:Math.min(H-40,M.ry(o.x)+M.rw(o.x)/2+300)},G.plan&&G.plan.danger?[...G.plan.danger.values()]:[],60,'eng');if(dist(u,wait)>60&&(!u.path.length||dist(u.path[u.path.length-1],wait)>80))route(u,wait.x,wait.y,'move');}
// AI air strikes, at most one per cooldown: the defender hits enemy pontoons first, then bridges the attacker is massing near;
// (finished pontoons only); both sides hit tight clusters of visible enemies, unless their own units are close.
function aiAir(side){if(G.air[side]<=0||G.time<20||G.time-G.airT[side]<AIR.aiCooldown*DIFFICULTY[G.diff].cool)return;const foe=side==='A'?'D':'A';
  // recent sightings (guns don't move, so a sighting of artillery stays good for 20 s); for air targeting a gun is worth a tank
  const AW={inf:1,tank:2,art:2,eng:.6},seen=aiSee(side).filter(s=>G.time-s.t<(s.type==='art'?20:8)),own=G.units.filter(u=>u.side===side);
  // the four bombs and their blasts reach about 85 px from the aim point, so keep that clear of friendly units
  const clear=p=>!own.some(u=>dist(u,p)<90);
  if(side==='D'){for(const p of G.pontoons)if(p.side==='A'&&p.done&&own.some(u=>dist(u,p)<TYPES[u.type].vision)&&clear(p))return callAir(side,p.x,p.y);
    for(const b of G.bridges)if(!b.down&&clear(b)&&seen.filter(e=>dist(e,b)<220&&M.side(e.x,e.y)>0).length>=3)return callAir(side,b.x,b.y);}
  // the heaviest group of recently seen enemies within 65 px of one another (tanks and guns count double), at least 4 strong
  let best=null,bn=3.9;for(const e of seen){const n=seen.reduce((a,f)=>a+(dist(e,f)<65?AW[f.type]:0),0);if(n>bn){bn=n;best=e;}}
  if(!best)return;const g=seen.filter(f=>dist(best,f)<65),c={x:g.reduce((s,f)=>s+f.x,0)/g.length,y:g.reduce((s,f)=>s+f.y,0)/g.length};
  // the attacker won't bomb next to a crossing it still needs
  if(side==='A'&&strikable().some(x=>{const [a,b]=crossingEnds(x);return segDist(c,a,b)<AIR.bridgeHit+50;}))return;
  if(clear(c))callAir(side,c.x,c.y);}

