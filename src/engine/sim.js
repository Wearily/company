// COMPANY · src/engine/sim.js
// The fixed-step simulation: movement, combat, vision, supply, capture, the win check.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
const hillK=(x,y)=>clamp((M.hgt[cellOf(x,y)]-HILL.from)/(HILL.to-HILL.from),0,1);
// effective firing range, with the high-ground bonus for where the unit stands now
function rangeOf(u){return TYPES[u.type].range*(1+(u.type==='art'?HILL.artRange:HILL.range)*hillK(u.x,u.y));}
const visionR=u=>TYPES[u.type].vision*MAP_MODES[M.mode].vision*CLIMATES[G.climate||'temperate'].vision*(SC().vision||1)*(1+HILL.vision*hillK(u.x,u.y));
function computeVis(){const prev=G.vis[G.player];trenchSight();
  if(!G.fog){for(const s of ['A','D'])G.vis[s]=new Set(G.units.filter(e=>e.side!==s).map(e=>e.id));G.ghosts.clear();return;}
  for(const s of ['A','D']){const set=new Set(),mine=G.units.filter(u=>u.side===s).map(u=>({x:u.x,y:u.y,vr:visionR(u)}));
    for(const e of G.units){if(e.side===s)continue;const ci=cellOf(e.x,e.y);let k=1;
      if(e.rev<=0){if(dugIn(e))k=TRENCH.hide;else if(M.cls[ci]===URBAN)k=.6;else if(M.cls[ci]===FOREST)k=.5;}
      if(iceAt(ci))k=ICE.seen;
      for(const u of mine){const vr=u.vr*k,dx=u.x-e.x,dy=u.y-e.y;if(dx*dx+dy*dy<=vr*vr){set.add(e.id);break;}}}
    G.vis[s]=set;}
  const now=G.vis[G.player];
  for(const e of G.units){if(e.side===G.player)continue;if(now.has(e.id))G.ghosts.delete(e.id);else if(prev.has(e.id))G.ghosts.set(e.id,{x:e.x,y:e.y,type:e.type,t:G.time});}
  for(const [id,g] of G.ghosts)if(G.time-g.t>30)G.ghosts.delete(id);}
// Trenches under fog of war: the defender dug them, so the attacker knows only the stretches its units have had in
// sight (within their vision range), and a stretch once seen stays known. G.tSeen keeps each seen segment's key. Only
// what the attacking player is shown and where its orders snap to a trench depend on it; the battle itself doesn't.
const tKey=(a,b)=>a.x+','+a.y+','+b.x+','+b.y;
const trenchKnown=(side,a,b)=>side==='D'||!G.fog||!!(G.tSeen&&G.tSeen.has(tKey(a,b)));
function trenchSight(){const S=G.tSeen||(G.tSeen=new Set()),us=G.units.filter(u=>u.side==='A').map(u=>({x:u.x,y:u.y,vr:visionR(u)}));if(!us.length)return;
  for(const t of G.trenches)for(let k=0;k<t.length-1;k++){const a=t[k],b=t[k+1],key=tKey(a,b);if(S.has(key))continue;
    for(const u of us)if(segDist(u,a,b)<=u.vr){S.add(key);break;}}}
function nearestRoad(p){const c=cellOf(p.x,p.y),cx=c%GW,cy=Math.floor(c/GW);for(let r=0;r<14;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
  const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=GW||ny>=GH)continue;const j=ny*GW+nx;if(M.road[j])return j;}return -1;}
// Supply runs from the depot along roads, cut where the enemy holds the ground (see enemyHeld). Supplied highways, bridges and
// pontoons cover SUPPLY.major px around them, supplied minor roads SUPPLY.minor px, and the depot SUPPLY.depot px.
// A finished pontoon whose near landing is covered carries supply over the river: its span is supplied (so its far
// landing covers like a highway), and roads within SUPPLY.link px of either landing join the network, so supply flows
// on into the far bank's roads. Pontoons can chain, one supplying the next.
const isMajor=i=>M.road[i]>=2;
// Multi-source 8-connected distance in cells (Chebyshev), capped at r. With `pass`, the spread only enters cells
// where pass(i) holds, so it flows around obstacles instead of through them.
function cover8(src,r,pass){const d=new Uint8Array(N).fill(255),q=new Int32Array(N);let h=0,t=0;
  for(let i=0;i<N;i++)if(src(i)){d[i]=0;q[t++]=i;}
  while(h<t){const i=q[h++],x=i%GW,y=Math.floor(i/GW),nd=d[i]+1;if(nd>r)continue;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=GW||ny>=GH)continue;const j=ny*GW+nx;
      if(d[j]>nd&&(!pass||pass(j))){d[j]=nd;q[t++]=j;}}}
  return d;}
// Zone of control for side s: a cell is enemy-held when an enemy unit is within SUPPLY.zoc and closer than any of
// side s's units (ties go to side s, so ground where the two sides are in contact isn't lost).
// Only enemy units side s can currently see hold ground against it, so an unseen enemy neither cuts supply nor shows
// up as a hole in the supply map.
function enemyHeld(s){const r=Math.round(SUPPLY.zoc/C),own=new Uint8Array(N),foe=new Uint8Array(N);
  for(const u of G.units){if(u.side===s)own[cellOf(u.x,u.y)]=1;else if(G.vis[s].has(u.id))foe[cellOf(u.x,u.y)]=1;}
  const dF=cover8(i=>own[i],r),dE=cover8(i=>foe[i],r),held=new Uint8Array(N);
  for(let i=0;i<N;i++)held[i]=dE[i]<=r&&dE[i]<dF[i]?1:0;return held;}
// Taken ground (G.claim[s]) on the enemy's half of the battlefield. Every supply tick, each unit floods out over the land
// it could walk to (bridges and pontoons count, open water doesn't) up to SUPPLY.claim px away. A cell there becomes side
// s's when one of its units is nearer than any enemy unit s can see, and goes back to the enemy when a visible enemy unit
// is nearer than any of s's. Taken ground stays taken after the units move on, so the road behind an advance stays open;
// two units slipping across a bridge take only the ground they stand on.
const claimMark=new Int32Array(N);let claimStamp=0;
// (with all set, cells on both halves are updated: used for the line of control)
function updateClaim(s,home,cl=G.claim[s],all=false,ex=null){const R=SUPPLY.claim,dO=new Float32Array(N).fill(1e9),dE=new Float32Array(N).fill(1e9),touched=[],q=new Int32Array(N);
  const pass=i=>M.cls[i]!==WATER||M.road[i]>0||M.frozen;
  // a claim can go out onto river ice but not up the far bank: only units that have actually crossed hold ground there
  const ice=i=>M.cls[i]===WATER&&!M.road[i];
  const flood=(u,arr)=>{const id=++claimStamp,c0=cellOf(u.x,u.y),us=M.side(u.x,u.y);let h=0,t=0;q[t++]=c0;claimMark[c0]=id;
    while(h<t){const i=q[h++],c=cc(i),d=Math.hypot(c.x-u.x,c.y-u.y);if(d>R)continue;
      if(all||M.side(c.x,c.y)!==home){if(dO[i]===1e9&&dE[i]===1e9)touched.push(i);if(d<arr[i])arr[i]=d;}
      const x=i%GW,onIce=M.frozen&&ice(i);for(const j of [x>0?i-1:-1,x<GW-1?i+1:-1,i-GW,i+GW])if(j>=0&&j<N&&claimMark[j]!==id&&pass(j)){
        if(onIce&&!ice(j)){const cj=cc(j);if(M.side(cj.x,cj.y)!==us)continue;}claimMark[j]=id;q[t++]=j;}}};
  for(const u of G.units){if(u.side===s)flood(u,dO);else if(G.vis[s].has(u.id))flood(u,dE);}
  for(const i of touched){if(dO[i]<dE[i]){cl[i]=1;if(ex){ex[0][i]=1;ex[1][i]=0;}}else if(dE[i]<dO[i]){cl[i]=0;if(ex){ex[0][i]=0;ex[1][i]=1;}}}}
// Line of control (display only): who holds each cell as the player sees it (G.ctrl, 1 = the player). Each side starts
// holding its own half; ground then changes hands the same way taken ground does (see updateClaim), over both halves,
// using only enemy units the player can see. It persists, so salients, pockets and encircled units show. The drawn line
// is a contour of G.ctrlS, which eases toward G.ctrl at each update so the line glides rather than jumps.
function updateFront(){const p=G.player,home=p==='A'?1:-1;
  // Two-line style: G.ctrlP (held by the player) and G.ctrlE (held by the enemy, as far as the player knows). Each side
  // starts with its own half except a band FRONT_GAP deep along the river (or the front line on a dry map), which is
  // no-man's land along with the river itself until someone's units reach it.
  if(!G.ctrl){G.ctrl=new Uint8Array(N);G.ctrlS=new Float32Array(N);G.ctrlP=new Uint8Array(N);G.ctrlE=new Uint8Array(N);G.ctrlPS=new Float32Array(N);G.ctrlES=new Float32Array(N);
    // the attacker's ground starts at the defender's deployment limit (ry + ZONE), since the defender may stand anywhere
    // north of it, when the scenario has a deployment; otherwise FRONT_GAP back from its bank, like the defender's
    const dep=SC().deploy!==false;
    for(let i=0;i<N;i++){const c=cc(i),mine=M.side(c.x,c.y)===home,south=c.y>M.ry(c.x),b=Math.abs(c.y-M.ry(c.x))-M.rw(c.x)/2;
      const deep=south&&dep?c.y>M.ry(c.x)+ZONE:b>FRONT_GAP;
      G.ctrl[i]=G.ctrlS[i]=mine?1:0;G.ctrlP[i]=G.ctrlPS[i]=mine&&deep?1:0;G.ctrlE[i]=G.ctrlES[i]=!mine&&deep?1:0;}}
  updateClaim(p,home,G.ctrl,true,[G.ctrlP,G.ctrlE]);
  // open water takes the owner of the bank on its own side, so a river between two banks you hold draws no line; in the
  // two-line style it is held only when the same side holds both banks. Frozen water is taken and held like land.
  const ct=G.ctrl,P=G.ctrlP,E=G.ctrlE;if(M.wet&&!M.frozen)for(let i=0;i<N;i++){if(M.cls[i]!==WATER||M.road[i])continue;
    const bankFrom=st=>{let j=i;while(j>=0&&j<N&&M.cls[j]===WATER&&!M.road[j])j+=st;return j>=0&&j<N?j:-1;},c=cc(i),own=c.y<M.ry(c.x)?-GW:GW,n=bankFrom(-GW),so=bankFrom(GW),j=own<0?n:so;
    if(j>=0)ct[i]=ct[j];P[i]=n>=0&&so>=0&&P[n]&&P[so]?1:0;E[i]=n>=0&&so>=0&&E[n]&&E[so]?1:0;}
  if(settings.front)frontShape();}
// Squared straight-line distance, in cells, from every cell to the nearest cell where seed(i) holds (Felzenszwalb's
// two-pass exact transform: down the columns, then along the rows). 1e9 where there's no seed at all.
function edt2(seed){const BIG=1e10,n=Math.max(GW,GH),v=new Int32Array(n),z=new Float64Array(n+1),g=new Float64Array(n),d=new Float64Array(n),f=new Float64Array(N),out=new Float32Array(N);
  // the lower envelope of parabolas over one row or column (g in, d out)
  const dt=len=>{let k=0;v[0]=0;z[0]=-Infinity;z[1]=Infinity;
    for(let q=1;q<len;q++){let s=((g[q]+q*q)-(g[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);while(s<=z[k]){k--;s=((g[q]+q*q)-(g[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);}
      k++;v[k]=q;z[k]=s;z[k+1]=Infinity;}
    k=0;for(let q=0;q<len;q++){while(z[k+1]<q)k++;d[q]=(q-v[k])*(q-v[k])+g[v[k]];}};
  for(let i=0;i<N;i++)f[i]=seed(i)?0:BIG;
  for(let x=0;x<GW;x++){for(let q=0;q<GH;q++)g[q]=f[q*GW+x];dt(GH);for(let q=0;q<GH;q++)f[q*GW+x]=d[q];}
  for(let y=0;y<GH;y++){for(let q=0;q<GW;q++)g[q]=f[y*GW+q];dt(GW);for(let q=0;q<GW;q++)out[y*GW+q]=Math.min(d[q],1e9);}
  return out;}
// the 0.5 contour of a field, as segments with the unit normal pointing uphill (toward the held ground)
function contourSegs(B){const seg=[];
  for(let j=0;j<GH-1;j++)for(let i=0;i<GW-1;i++){const k=j*GW+i,a=B[k],b=B[k+1],c=B[k+GW+1],d=B[k+GW],x0=i*C+C/2,y0=j*C+C/2,q=[];
    const e=(p,s2,x1,y1,x2,y2)=>{if((p<.5)!==(s2<.5)){const t=(.5-p)/(s2-p);q.push(x1+(x2-x1)*t,y1+(y2-y1)*t);}};
    e(a,b,x0,y0,x0+C,y0);e(b,c,x0+C,y0,x0+C,y0+C);e(d,c,x0,y0+C,x0+C,y0+C);e(a,d,x0,y0,x0,y0+C);
    const gx=(b+c-a-d)/2,gy=(c+d-a-b)/2,gl=Math.hypot(gx,gy)||1;
    if(q.length>=4)seg.push(q[0],q[1],q[2],q[3],gx/gl,gy/gl);if(q.length===8)seg.push(q[4],q[5],q[6],q[7],gx/gl,gy/gl);}
  return seg;}
function frontShape(snap){const ease=(S,t)=>{for(let i=0;i<N;i++)S[i]=snap?t[i]:S[i]+(t[i]-S[i])*.45;};
  // blurred twice so the contours are rounded, then traced at 0.5 with marching squares
  const blur=a=>{const b=new Float32Array(N),c=new Float32Array(N);
    for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const k=j*GW+i;b[k]=(a[k]+a[i>0?k-1:k]+a[i<GW-1?k+1:k])/3;}
    for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const k=j*GW+i;c[k]=(b[k]+b[j>0?k-GW:k]+b[j<GH-1?k+GW:k])/3;}return c;};
  const img=frontCtx.createImageData(GW,GH),[r,g,bl]=G.player==='A'?[122,44,191]:[23,24,28],px=img.data;
  // Held ground that's close together joins up: a neutral gap narrower than about 190 px with the same side's ground on
  // both sides of it (a river and its bank band between a bridgehead and the main line, say) counts as that side's, unless
  // the other side holds it. A morphological closing on the grid: grow by FRONT_CLOSE cells, then shrink back.
  // distances are true straight-line ones (edt2), so merged ground has round edges, not diamonds
  const close=(src,other)=>{const k2=FRONT_CLOSE*FRONT_CLOSE,d1=edt2(i=>src[i]>0),d2=edt2(i=>d1[i]>k2),out=new Uint8Array(N);
    for(let i=0;i<N;i++)out[i]=src[i]||(d1[i]<=k2&&d2[i]>k2&&!other[i])?1:0;return out;};
  // and a neutral pocket that only one side's ground surrounds (the river and its bank band, enclosed once a bridgehead
  // joins up) is that side's too, so it isn't drawn as a hole
  const fillHoles=(P,E)=>{for(const comp of components(i=>!P[i]&&!E[i])){let byP=false,byE=false;
      for(const i of comp){const x=i%GW;for(const j of [x>0?i-1:-1,x<GW-1?i+1:-1,i-GW,i+GW]){if(j<0||j>=N)continue;if(P[j])byP=true;else if(E[j])byE=true;}}
      if(byP&&!byE)for(const i of comp)P[i]=1;else if(byE&&!byP)for(const i of comp)E[i]=1;}};
  if(settings.frontStyle==='two'){const CP=close(G.ctrlP,G.ctrlE),CE=close(G.ctrlE,G.ctrlP);fillHoles(CP,CE);ease(G.ctrlPS,CP);ease(G.ctrlES,CE);const BP=blur(blur(G.ctrlPS)),BE=blur(blur(G.ctrlES));
    G.frontSegP=contourSegs(BP);G.frontSegE=contourSegs(BE);G.frontSeg=[];
    // enemy ground in the enemy's colour, no-man's land a faint grey
    for(let i=0;i<N;i++){const ae=BE[i]*34,an=(1-BP[i])*(1-BE[i])*26,a=ae+an||1;
      px[i*4]=(r*ae+120*an)/a;px[i*4+1]=(g*ae+120*an)/a;px[i*4+2]=(bl*ae+116*an)/a;px[i*4+3]=ae+an;}}
  else{ease(G.ctrlS,G.ctrl);const B=blur(blur(G.ctrlS));G.frontSeg=contourSegs(B);G.frontSegP=G.frontSegE=[];
    for(let i=0;i<N;i++){px[i*4]=r;px[i*4+1]=g;px[i*4+2]=bl;px[i*4+3]=(1-B[i])*34;}}
  frontCtx.putImageData(img,0,0);}
const frontCv=document.createElement('canvas');frontCv.width=GW;frontCv.height=GH;const frontCtx=frontCv.getContext('2d');
function computeSupply(s){const dep=G.depot[s],blk=enemyHeld(s);
  // Supply follows the army: it reaches your own half of the battlefield, and only the ground you have taken on the enemy's.
  const home=s==='A'?1:-1;updateClaim(s,home);const cl=G.claim[s],reach=new Uint8Array(N);
  for(let i=0;i<N;i++){const x=(i%GW)*C+C/2,y=Math.floor(i/GW)*C+C/2;reach[i]=M.side(x,y)===home||cl[i]?1:0;}
  const sup=new Uint8Array(N),q=new Int32Array(N);let h=0,t=0;
  // cratered road (G.dmg) doesn't carry supply until engineers repair it
  const seed=i=>{if(i>=0&&!sup[i]&&M.road[i]&&!blk[i]&&!G.dmg[i]&&reach[i]){sup[i]=1;q[t++]=i;}};
  const flood=()=>{while(h<t){const i=q[h++],x=i%GW,y=Math.floor(i/GW);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;
    if(nx>=0&&ny>=0&&nx<GW&&ny<GH)seed(ny*GW+nx);}}};
  seed(nearestRoad(dep));flood();
  // the supplied area spreads out from supplied roads over land: never through enemy-held ground, never across water
  // (except on a bridge or pontoon, which are road cells), so a pocket ringed by the enemy goes dry
  const land=i=>!blk[i]&&reach[i]&&(M.cls[i]!==WATER||M.road[i]>0||M.frozen);
  const rMaj=Math.round(SUPPLY.major/C),rMin=Math.round(SUPPLY.minor/C),rDep=Math.round(SUPPLY.depot/C),dc=cellOf(dep.x,dep.y),dcx=dc%GW,dcy=Math.floor(dc/GW);
  const dDep=cover8(i=>i===dc&&!blk[i],rDep,land);
  const coverage=()=>{const a=cover8(i=>sup[i]&&isMajor(i),rMaj,land),b=cover8(i=>sup[i]&&M.road[i]===1,rMin,land),c=new Uint8Array(N);
    for(let i=0;i<N;i++){const dx=i%GW-dcx,dy=Math.floor(i/GW)-dcy;c[i]=a[i]<=rMaj||b[i]<=rMin||(dDep[i]<=rDep&&dx*dx+dy*dy<=rDep*rDep)?1:0;}return c;};
  let cov=coverage();const linked=new Set(),rl=Math.round(SUPPLY.link/C);
  for(let grew=true;grew;){grew=false;
    for(const p of G.pontoons){if(!p.done||linked.has(p))continue;
      if(!p.cells.some(i=>sup[i])&&!cov[cellOf(p.a.x,p.a.y)]&&!cov[cellOf(p.b.x,p.b.y)])continue;
      linked.add(p);grew=true;for(const i of p.cells)seed(i);
      for(const e of [p.a,p.b]){const ec=cellOf(e.x,e.y),ex=ec%GW,ey=Math.floor(ec/GW);
        for(let dy=-rl;dy<=rl;dy++)for(let dx=-rl;dx<=rl;dx++){const nx=ex+dx,ny=ey+dy;if(nx>=0&&ny>=0&&nx<GW&&ny<GH&&dx*dx+dy*dy<=rl*rl)seed(ny*GW+nx);}}
      flood();}
    if(grew)cov=coverage();}
  G.sup[s]=sup;G.cov[s]=cov;
  for(const u of G.units){if(u.side!==s)continue;const ok=!!cov[cellOf(u.x,u.y)];
    if(u.sup&&!ok&&G.phase==='play')tellTo(u.side,`${TYPES[u.type].name} near ${placeName(u)} is cut off from supply`,'a');
    u.sup=ok;}}
const dugIn=u=>!u.moving&&M.trench[cellOf(u.x,u.y)]===1;
function cover(e){const i=cellOf(e.x,e.y);let m=1;if(dugIn(e))m=TRENCH.fire;else if(M.cls[i]===URBAN)m=.55;else if(M.cls[i]===FOREST)m=.7;else if(M.cls[i]===STREAM&&!M.road[i])m=STREAM_EXPOSED;else if(iceAt(i))m=ICE.exposed;
  if(e.moving)m*=1.15;m*=1-HILL.cover*hillK(e.x,e.y);return m;}
function hit(e,amt){e.hp-=amt;e.lastHit=G.time;}
function moveUnit(u,dt){const p=u.path[0],dx=p.x-u.x,dy=p.y-u.y,d=Math.hypot(dx,dy);let m=mult(u.type,cellOf(u.x,u.y));if(m<=0)m=.3;
  const s=TYPES[u.type].speed*m*(u.sup?1:.8)*dt;
  // units sharing a waypoint push each other apart, so count it as reached once close
  // the last point counts as reached once close if friends already stand on it (they'd otherwise push each other off it forever)
  const crowd=u.path.length===1&&d<16&&G.units.some(v=>v!==u&&v.side===u.side&&Math.hypot(v.x-p.x,v.y-p.y)<14);
  if(s>=d||d<(u.path.length>1?10:4)||crowd){if(s>=d){u.x=p.x;u.y=p.y;}u.path.shift();if(!u.path.length&&u.mode!=='hold')u.mode='idle';return;}
  let nx=u.x+dx/d*s,ny=u.y+dy/d*s;
  // never step from dry ground into impassable water: slide along one axis, or give up the route if both are blocked
  if(!mult(u.type,cellOf(nx,ny))&&mult(u.type,cellOf(u.x,u.y))){
    if(mult(u.type,cellOf(nx,u.y)))ny=u.y;else if(mult(u.type,cellOf(u.x,ny)))nx=u.x;else{u.path=[];if(u.mode!=='hold')u.mode='idle';return;}}
  u.x=nx;u.y=ny;}
const inStream=u=>{const i=cellOf(u.x,u.y);return M.cls[i]===STREAM&&!M.road[i];};
function directFire(u,dt){const e=u.tgt;let amt=DPS[u.type][e.type]*cover(e)*(u.sup?1:.6)*(.5+.5*u.hp/u.max)*dt;if(u.moving)amt*=.6;if(inStream(u))amt*=STREAM_FIRE;else if(onIce(u))amt*=ICE.fire;
  hit(e,amt);u.rev=Math.max(u.rev,2.5);u.fx-=dt;
  if(u.fx<=0){u.fx=.3+Math.random()*.6;G.tracers.push({x1:u.x,y1:u.y,x2:e.x+(Math.random()-.5)*8,y2:e.y+(Math.random()-.5)*8,t:.2,side:u.side,heavy:u.type==='tank'});u.flash=.12;}}
function artStep(u,dt){const T=TYPES.art;if(u.moving||inStream(u)){u.deployT=0;return;}
  u.deployT=Math.min(3,u.deployT+dt);u.cd-=dt;if(u.deployT<3||u.cd>0)return;
  const rngR=rangeOf(u);let aim=null,spotted=false;
  if(u.fireAt){const d=dist(u,u.fireAt);if(d<=rngR&&d>=T.minRange)aim=u.fireAt;}
  if(!aim){let bd=1e9;for(const e of G.units){if(e.side===u.side||!G.vis[u.side].has(e.id))continue;const d=dist(u,e);if(d>=T.minRange&&d<=rngR&&d<bd){bd=d;aim=e;spotted=true;}}}
  if(!aim)return;const d=dist(u,aim),sc=(spotted?12:20)+d*.04,a=Math.random()*Math.PI*2,rr=Math.sqrt(Math.random())*sc;
  G.shells.push({x0:u.x,y0:u.y,x1:aim.x+Math.cos(a)*rr,y1:aim.y+Math.sin(a)*rr,t:0,T:.8+d/300,side:u.side,mission:aim===u.fireAt});
  u.cd=6+Math.random()*2*(u.sup?1:2.2);u.rev=Math.max(u.rev,1.5);u.flash=.2;}
function separate(){const U=G.units;for(let i=0;i<U.length;i++)for(let j=i+1;j<U.length;j++){const a=U[i],b=U[j];if(a.side!==b.side)continue;
  const dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;if(d2>=196||d2<1e-4)continue;const d=Math.sqrt(d2),push=(14-d)*.25,nx=dx/d*push,ny=dy/d*push;
  if(canPush(a,-nx,-ny)){a.x-=nx;a.y-=ny;}if(canPush(b,nx,ny)){b.x+=nx;b.y+=ny;}}}
// units push apart only onto passable ground, and a unit on a road is never pushed off it (a column bunches along the
// road instead of spilling onto slow ground beside it)
function canPush(u,dx,dy){const to=cellOf(u.x+dx,u.y+dy);return mult(u.type,to)>0&&(!M.road[cellOf(u.x,u.y)]||M.road[to]>0);}
function capture(dt){for(const o of G.objs){let a=0,d=0;for(const u of G.units){if(u.type==='art')continue;if(dist(u,o)<(u.side===o.owner?CAPTURE.hold:CAPTURE.radius))u.side==='A'?a++:d++;}
  const rate=CAPTURE.rate;o.contested=a>0&&d>0;
  if(a&&!d)o.p=Math.max(-1,o.p-rate*Math.min(3,a)*dt);if(d&&!a)o.p=Math.min(1,o.p+rate*Math.min(3,d)*dt);
  if(o.p<=-1&&o.owner!=='A'){o.owner='A';tell(r=>[`${o.key} · ${o.name} taken by the attacker`,r==='A'?'d':'a']);}
  if(o.p>=1&&o.owner!=='D'){const was=o.owner;o.owner='D';tell(r=>[`${o.key} · ${o.name} ${was==='N'?'taken':'retaken'} by the defender`,r==='D'?'d':'a']);}}
  if(SC().holdA)G.holdA=G.objs[0].owner==='A'?G.holdA+dt:0;}
function placeName(u){let best=null,bd=1e9;for(const o of G.objs){const d=dist(u,o);if(d<bd){bd=d;best=o.name;}}
  if(bd<300)return best;for(const d of M.D){const dd=Math.hypot(d.cx-u.x,d.cy-u.y);if(dd<bd&&d.name){bd=dd;best=d.name;}}return bd<350?best:'open ground';}
function step(dt){
  G.time+=dt;
  if((G.acc.vis-=dt)<=0){G.acc.vis=.2;computeVis();}
  if((G.acc.sup-=dt)<=0){G.acc.sup=1;computeSupply('A');computeSupply('D');}
  if((G.acc.ai-=dt)<=0){G.acc.ai=2;if(!G.mp){G.player==='A'?aiDefender():aiAttacker();aiAir(G.player==='A'?'D':'A');recAI();}}
  if((G.acc.cap-=dt)<=0){G.acc.cap=.5;capture(.5);}
  reinforce();
  if((G.acc.front-=dt)<=0){G.acc.front=.5;updateFront();}
  for(const u of G.units){u.rev=Math.max(0,u.rev-dt);u.flash=Math.max(0,u.flash-dt);
    if(u.type!=='art'){let best=null,bd=rangeOf(u);
      for(const e of G.units){if(e.side===u.side||e.hp<=0||!G.vis[u.side].has(e.id))continue;const d=dist(u,e);if(d<bd){bd=d;best=e;}}u.tgt=best;}
    u.moving=u.path.length>0&&u.mode!=='hold'&&!(u.mode==='amove'&&u.tgt);
    if(u.moving)moveUnit(u,dt);
    // a finished leg hands over to the next queued one
    if(!u.path.length&&u.queue&&u.queue.length&&u.mode!=='hold'){const q=u.queue.shift();route(u,q.x,q.y,q.mode,q.fx,q.fy,q.direct);}
    if(u.type==='art')artStep(u,dt);else if(u.tgt)directFire(u,dt);
    if(u.type==='eng'&&!u.build&&!u.repair&&!u.moving)resumeBuild(u);
    if(u.build)buildStep(u,dt);else if(u.repair)repairStep(u,dt);
    if(u.sup&&G.time-u.lastHit>10&&u.hp<u.max)u.hp=Math.min(u.max,u.hp+1.2*dt);}
  separate();
  for(const s of G.shells){s.t+=dt;if(s.t>=s.T){s.done=true;G.booms.push({x:s.x1,y:s.y1,t:0,r:30});G.craters.push({x:s.x1,y:s.y1});
    for(const e of G.units){if(e.side===s.side)continue;const d=Math.hypot(e.x-s.x1,e.y-s.y1);if(d>=44)continue;const ci=cellOf(e.x,e.y);
      let k=1;if(dugIn(e))k=TRENCH.shell;else if(M.cls[ci]===URBAN)k=.6;else if(M.cls[ci]===FOREST)k=.75;else if(iceAt(ci))k=ICE.exposed;if(e.type==='tank')k*=.45;hit(e,62*(1-d/44)*k);}
    if(s.mission)shellOnInfrastructure(s);}}
  G.shells=G.shells.filter(s=>!s.done);
  for(const s of G.strikes)if(!s.done&&G.time>=s.t)resolveStrike(s);G.strikes=G.strikes.filter(s=>G.time<s.t+1.5);if(G.craters.length>400)G.craters.splice(0,G.craters.length-400);
  for(const t of G.tracers)t.t-=dt;G.tracers=G.tracers.filter(t=>t.t>0);
  for(const b of G.booms)b.t+=dt;G.booms=G.booms.filter(b=>b.t<.9);
  const dead=G.units.filter(u=>u.hp<=0);
  if(dead.length){for(const u of dead){G.booms.push({x:u.x,y:u.y,t:0,r:22});G.stats.lost[u.side]++;G.ghosts.delete(u.id);
      tell(r=>u.side===r?[`Lost ${TYPES[u.type].name.toLowerCase()} near ${placeName(u)}`,'a']:G.vis[r].has(u.id)?[`Enemy ${TYPES[u.type].name.toLowerCase()} destroyed near ${placeName(u)}`,'d']:null);}
    G.units=G.units.filter(u=>u.hp>0);for(const u of G.units)if(u.tgt&&u.tgt.hp<=0)u.tgt=null;}
  recScan();checkEnd();}
// the win check, after every step: all three objectives, a side wiped out, a scenario's own goal, or the clock
function checkEnd(){const sc=SC(),ownA=G.objs.filter(o=>o.owner==='A').length,ownD=G.objs.filter(o=>o.owner==='D').length,aA=G.units.some(u=>u.side==='A'),aD=G.units.some(u=>u.side==='D');
  if(ownA===3)return end('A','The attacker holds all three objectives.');
  if(sc.neutral&&ownD===3)return end('D','The defender holds all three objectives.');
  if(!aD)return end('A','The defending force has been destroyed.');
  if(!aA)return end('D','The attacking force has been destroyed.');
  if(sc.holdA&&G.holdA>=sc.holdA)return end('A',`The attacker held ${G.objs[0].name} for ${sc.holdA/60} minutes.`);
  if(G.time>=G.limit){if(sc.neutral)return ownA>ownD?end('A',`The attacker held ${ownA} objectives to ${ownD} when time ran out.`):ownD>ownA?end('D',`The defender held ${ownD} objectives to ${ownA} when time ran out.`):end(null,`Both sides held ${ownA} objectives when time ran out.`);
    return ownA>=sc.need?end('A',`The attacker held ${ownA} of 3 objectives when time ran out.`):end('D',sc.need>=3?'The defenders held out until time ran out.':'The line held until time ran out.');}}
function end(winner,reason){if(G.phase==='over')return;if(G.rec)recFrame();G.phase='over';G.over={winner,reason};
  const g=G;setTimeout(()=>{if(RP||G!==g)return;showEnd(winner,reason);},900);}
