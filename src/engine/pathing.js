// COMPANY · src/engine/pathing.js
// Flow fields, routes and passability.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
// bridges (3) run at highway speed, pontoons (4) at road speed, so crossing water never slows a column down
// off-road movement is scaled by the climate (M.offroad: sand, snow, bog)
function mult(type,i){const rd=M.road[i],k=M.offroad||1;if(M.dmg&&M.dmg[i])return MOVE[type][M.cls[i]]*ROAD_DMG.move*k;if(rd)return ROADMOVE[type]*(rd===2||rd===3?HIGHWAY:1);
  if(M.cls[i]===WATER)return M.frozen&&(type==='inf'||type==='eng')?ICE.move:0;return MOVE[type][M.cls[i]]*k;}
// frozen water a unit can stand on (not a bridge or pontoon)
const iceAt=i=>M.frozen&&M.cls[i]===WATER&&!M.road[i],onIce=u=>iceAt(cellOf(u.x,u.y));
function nearestPassable(type,x,y,dry){const ok=j=>mult(type,j)>0&&!(dry&&iceAt(j)),ci=cellOf(x,y);if(ok(ci))return ci;const cx=ci%GW,cy=Math.floor(ci/GW);
  for(let r=1;r<45;r++){let best=-1,bd=1e9;for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
    const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=GW||ny>=GH)continue;const j=ny*GW+nx;if(ok(j)){const d=dx*dx+dy*dy;if(d<bd){bd=d;best=j;}}}if(best>=0)return best;}return ci;}
class Heap{constructor(){this.i=[];this.p=[];}
  push(i,p){const I=this.i,P=this.p;let k=I.length;I.push(i);P.push(p);while(k>0){const q=(k-1)>>1;if(P[q]<=p)break;I[k]=I[q];P[k]=P[q];k=q;}I[k]=i;P[k]=p;}
  pop(){const I=this.i,P=this.p,top=I[0];this.tp=P[0];const li=I.pop(),lp=P.pop();if(I.length){let k=0;const n=I.length;
    for(;;){let c=2*k+1;if(c>=n)break;if(c+1<n&&P[c+1]<P[c])c++;if(P[c]>=lp)break;I[k]=I[c];P[k]=P[c];k=c;}I[k]=li;P[k]=lp;}return top;}
  get size(){return this.i.length;}}
const fieldCache=new Map();
// With direct set, every passable cell costs the same, so the field gives the shortest way there over open ground,
// ignoring roads (it still goes round water and anything else the unit can't cross).
function flowField(type,ti,direct){const key=type+':'+ti+(direct?':d':'');if(fieldCache.has(key)){const f=fieldCache.get(key);fieldCache.delete(key);fieldCache.set(key,f);return f;}
  // costs are rounded to float32 before comparing, and each cell is expanded once, so float64 heap priorities
  // can neither drop live entries nor re-queue a cell at the same cost forever
  const d=new Float32Array(N).fill(Infinity),done=new Uint8Array(N),h=new Heap();d[ti]=0;h.push(ti,0);
  while(h.size){const i=h.pop();if(done[i])continue;done[i]=1;const x=i%GW,y=Math.floor(i/GW);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=GW||ny>=GH)continue;
      const j=ny*GW+nx,m=mult(type,j);if(!m)continue;
      if(dx&&dy&&(!mult(type,y*GW+nx)||!mult(type,ny*GW+x)))continue;
      const nd=Math.fround(d[i]+(dx&&dy?1.414:1)/(direct?1:m));if(nd<d[j]){d[j]=nd;h.push(j,nd);}}}
  fieldCache.set(key,d);if(fieldCache.size>24)fieldCache.delete(fieldCache.keys().next().value);return d;}
function descend(type,fd,x,y){let i=cellOf(x,y);if(!isFinite(fd[i])){i=nearestPassable(type,x,y);if(!isFinite(fd[i]))return null;}
  const out=[i];let g=0;
  while(fd[i]>0&&g++<4000){let best=i,bv=fd[i];const ix=i%GW,iy=Math.floor(i/GW);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=ix+dx,ny=iy+dy;if(nx<0||ny<0||nx>=GW||ny>=GH)continue;const j=ny*GW+nx;
      // a diagonal step must not cut the corner of an impassable cell (the same rule flowField uses)
      if(dx&&dy&&(!isFinite(fd[iy*GW+nx])||!isFinite(fd[ny*GW+ix])))continue;if(fd[j]<bv){bv=fd[j];best=j;}}
    if(best===i)break;i=best;out.push(i);}
  // Off-road, keep only the cells where the direction changes. On a road, use every cell's nearest point on the drawn
  // road line instead of the cell centre, so units trace the real curve rather than a staircase beside it.
  const pts=[];let pdx=9,pdy=9;
  for(let k=1;k<out.length;k++){const c=out[k],nx=out[k+1];
    if(M.road[c]&&M.rpOk[c]){pts.push({x:M.rpx[c],y:M.rpy[c]});pdx=pdy=9;continue;}
    if(nx===undefined){pts.push(cc(c));break;}
    const dx=(nx%GW)-(c%GW),dy=Math.floor(nx/GW)-Math.floor(c/GW);if(dx!==pdx||dy!==pdy)pts.push(cc(c));pdx=dx;pdy=dy;}
  // drop points bunched closer than 5 px (a highway is two or three cells wide, all snapping to one line)
  return pts.filter((p,k)=>k===pts.length-1||!k||Math.hypot(p.x-pts[k-1].x,p.y-pts[k-1].y)>=5);}
// A path's last leg runs straight from the last cell to the exact point asked for. That point is kept only if the
// straight leg stays on passable ground, so a formation offset across the river can't walk a unit over the water.
function clearLeg(type,a,b){const n=Math.ceil(dist(a,b)/3);for(let k=1;k<=n;k++)if(!mult(type,cellOf(a.x+(b.x-a.x)*k/n,a.y+(b.y-a.y)*k/n)))return false;return true;}
function finish(type,p,from,x,y,ti){const last=p.length?p[p.length-1]:from;p.push(clearLeg(type,last,{x,y})?{x,y}:cc(ti));return p;}
// A straight-line path: walk the even-cost field down to the target, then pull the route tight, keeping only the
// points where a straight line from the previous point would cross ground the unit can't cross.
function descendDirect(type,fd,x,y){let i=cellOf(x,y);if(!isFinite(fd[i])){i=nearestPassable(type,x,y);if(!isFinite(fd[i]))return null;}
  const cells=[];let g=0;
  while(fd[i]>0&&g++<4000){let best=i,bv=fd[i];const ix=i%GW,iy=Math.floor(i/GW);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=ix+dx,ny=iy+dy;if(nx<0||ny<0||nx>=GW||ny>=GH)continue;const j=ny*GW+nx;
      if(dx&&dy&&(!isFinite(fd[iy*GW+nx])||!isFinite(fd[ny*GW+ix])))continue;if(fd[j]<bv){bv=fd[j];best=j;}}
    if(best===i)break;i=best;cells.push(cc(i));}
  const out=[];let cur={x,y},k=0;
  while(k<cells.length){let j=k;while(j+1<cells.length&&clearLeg(type,cur,cells[j+1]))j++;out.push(cells[j]);cur=cells[j];k=j+1;}
  return out;}
function route(u,x,y,mode,fx,fy,direct){const ti=nearestPassable(u.type,fx??x,fy??y);const fd=flowField(u.type,ti,direct);const p=direct?descendDirect(u.type,fd,u.x,u.y):descend(u.type,fd,u.x,u.y);
  if(!p)return false;u.path=finish(u.type,p,u,x,y,ti);u.mode=mode;u.direct=!!direct;return true;}

