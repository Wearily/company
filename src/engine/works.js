// COMPANY · src/engine/works.js
// Engineer works in play: dirt roads laid node to node, and trenches dug on the spot. A work is planned by a command
// (road {ids, pts} or dig {ids, parts}) and the engineers given it build it piece by piece: a dirt road one cell at a
// time (DIRT.cellTime per cell per engineer, nearest cell first), a trench DIG.rate px a second per engineer from its
// start. Several engineers on one work add up. A dirt road is road flag DIRT.flag: half a road's benefit for movement
// (mult) and supply (SUPPLY.road), and it carries supply like any road. A dug trench is an ordinary trench owned by its
// side (t.side), so an attacker sees the ones it dug. Each side's works are its own (G.works, by side).
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
// a dirt road can go over any ground an engineer stands on, never over water or rock; existing roads are joined, not laid again
const dirtOk=i=>!M.road[i]&&M.cls[i]!==WATER&&M.cls[i]!==ROCK;
// the cells between nodes: a 4-connected line (a corner cell is added where it steps diagonally), in laying order
function dirtCells(pts){const out=[],seen=new Set(),add=i=>{if(!seen.has(i)&&dirtOk(i)&&!G.dirt[i]){seen.add(i);out.push(i);}};
  for(let k=0;k<pts.length-1;k++){const a=pts[k],b=pts[k+1],n=Math.max(1,Math.ceil(dist(a,b)/3));let prev=-1;
    for(let j=0;j<=n;j++){const x=clamp(a.x+(b.x-a.x)*j/n,1,W-1),y=clamp(a.y+(b.y-a.y)*j/n,1,H-1),i=cellOf(x,y);
      if(prev>=0&&i!==prev){const px=prev%GW,py=Math.floor(prev/GW),cx=i%GW,cy=Math.floor(i/GW);if(px!==cx&&py!==cy)add(cy*GW+px);}
      add(i);prev=i;}}
  return out;}
function planRoad(side,pts){if(G.phase!=='play')return null;pts=(pts||[]).map(p=>({x:clamp(+p.x||0,4,W-4),y:clamp(+p.y||0,4,H-4)})).filter((p,k,a)=>!k||dist(p,a[k-1])>=6);
  if(pts.length<2)return null;const cells=dirtCells(pts);if(!cells.length)return null;
  const w={id:G.wid++,side,kind:'road',pts,cells,todo:cells.slice(),done:0};G.works.push(w);G.dirtRoads.push({pts});return w;}
// a dirt road's line, sampled for drawing: a sample shows once its cell is laid
function roadSamples(rd){if(rd._s)return rd._s;const s=[];for(let k=0;k<rd.pts.length-1;k++){const a=rd.pts[k],b=rd.pts[k+1],n=Math.max(1,Math.ceil(dist(a,b)/4));for(let j=k?1:0;j<=n;j++){const x=a.x+(b.x-a.x)*j/n,y=a.y+(b.y-a.y)*j/n;s.push({x,y,i:cellOf(clamp(x,1,W-1),clamp(y,1,H-1))});}}return rd._s=s;}
function planDig(side,parts){if(G.phase!=='play')return null;const out=[];
  for(const t of parts||[]){const pts=(t||[]).map(p=>({x:clamp(+p.x||0,4,W-4),y:clamp(+p.y||0,4,H-4)})).filter(p=>!M.water(p.x,p.y)&&!iceAt(cellOf(p.x,p.y)));
    if(pts.length<2)continue;let L=0;for(let k=0;k<pts.length-1;k++)L+=dist(pts[k],pts[k+1]);if(L<12)continue;
    const w={id:G.wid++,side,kind:'dig',pts,len:L,done:0};G.works.push(w);out.push(w);}
  return out.length?out:null;}
function startWork(u,w){u.work=w.id;u.wp=0;u.build=null;u.repair=null;u.path=[];u.mode='idle';}
const workOf=u=>G.works.find(w=>w.id===u.work&&w.side===u.side)||null;
const workDone=w=>w.kind==='road'?!w.todo.length:w.done>=w.len;
// the point s px along a polyline, and which segment it is on
function alongPts(pts,s){let acc=0;for(let k=0;k<pts.length-1;k++){const L=dist(pts[k],pts[k+1]);if(acc+L>=s&&L>0){const t=(s-acc)/L;return{x:pts[k].x+(pts[k+1].x-pts[k].x)*t,y:pts[k].y+(pts[k+1].y-pts[k].y)*t,k};}acc+=L;}
  const p=pts[pts.length-1];return{x:p.x,y:p.y,k:pts.length-2};}
// a dug trench grows along its line: the dug part is a trench on the map (its mask is rebuilt every half second)
function digGrow(w){const p=alongPts(w.pts,w.done),line=[...w.pts.slice(0,p.k+1),{x:p.x,y:p.y}];
  if(!w.tr){w.tr=[];w.tr.side=w.side;G.trenches.push(w.tr);if(w.side===G.player)G.userTrench.push(w.tr);}
  w.tr.length=0;w.tr.push(...line);
  if(w.done>=w.len||G.time-(w.maskT??-9)>=.5){w.maskT=G.time;rebuildTrenchMask();}}
// a laid cell becomes dirt road at once; supply and routes take it in
function dirtChanged(){G.dirtList=[];for(let i=0;i<N;i++)if(G.dirt[i])G.dirtList.push(i);if(G.bridges)applyCrossings();G.acc.sup=0;}
function workStep(u,dt){const w=workOf(u);if(!w){u.work=null;return;}
  if(workDone(w)){u.work=null;tellTo(u.side,`${w.kind==='road'?'Dirt road':'Trench'} finished near ${placeName(u)}`,'d');const n=nextWork(u);if(n)startWork(u,n);return;}
  if(u.moving)return;const rate=.6+.4*supF(u);
  if(w.kind==='road'){let best=-1,bd=1e9;for(const i of w.todo){const c=cc(i),d=Math.hypot(c.x-u.x,c.y-u.y);if(d<bd){bd=d;best=i;}}
    if(bd>DIRT.reach){const c=cc(best);if(!u.path.length&&!route(u,c.x,c.y,'move')){w.todo.splice(w.todo.indexOf(best),1);}return;}
    u.wp+=dt*rate;if(u.wp<DIRT.cellTime)return;u.wp=0;w.todo.splice(w.todo.indexOf(best),1);w.done++;G.dirt[best]=1;dirtChanged();}
  else{const p=alongPts(w.pts,w.done),d=Math.hypot(p.x-u.x,p.y-u.y);
    if(d>DIG.reach){if(!u.path.length&&!route(u,p.x,p.y,'move'))u.work=null;return;}
    w.done=Math.min(w.len,w.done+DIG.rate*rate*dt);digGrow(w);}}
// an engineer that finishes a work picks up its side's nearest unfinished one within 300 px
function nextWork(u){let best=null,bd=300;for(const w of G.works){if(w.side!==u.side||workDone(w))continue;const p=w.kind==='road'?cc(w.todo[0]):alongPts(w.pts,w.done),d=Math.hypot(p.x-u.x,p.y-u.y);if(d<bd){bd=d;best=w;}}return best;}
// finished works are dropped from the list once nobody is on them (the dirt and the trench stay)
function pruneWorks(){G.works=G.works.filter(w=>!workDone(w)||G.units.some(u=>u.work===w.id));}
