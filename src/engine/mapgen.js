// COMPANY · src/engine/mapgen.js
// Legacy map generator (genMap). Pure and deterministic: the same seed and mode always give the same map.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
// Multi-source BFS over the 4-connected grid: distance in cells from any seed cell, capped at `cap`.
function gridDist(seed,cap){const d=new Uint8Array(N).fill(cap),q=new Int32Array(N);let h=0,t=0;
  for(let i=0;i<N;i++)if(seed(i)){d[i]=0;q[t++]=i;}
  while(h<t){const i=q[h++],x=i%GW,nd=d[i]+1;if(nd>=cap)continue;
    if(x>0&&d[i-1]>nd){d[i-1]=nd;q[t++]=i-1;}if(x<GW-1&&d[i+1]>nd){d[i+1]=nd;q[t++]=i+1;}
    if(i>=GW&&d[i-GW]>nd){d[i-GW]=nd;q[t++]=i-GW;}if(i<N-GW&&d[i+GW]>nd){d[i+GW]=nd;q[t++]=i+GW;}}
  return d;}
// 4-connected components of the cells where keep(i) holds, as arrays of cell indices.
function components(keep){const seen=new Uint8Array(N),out=[];
  for(let s=0;s<N;s++){if(seen[s]||!keep(s))continue;const comp=[s];seen[s]=1;
    for(let k=0;k<comp.length;k++){const i=comp[k],x=i%GW;
      for(const j of [x>0?i-1:-1,x<GW-1?i+1:-1,i-GW,i+GW])if(j>=0&&j<N&&!seen[j]&&keep(j)){seen[j]=1;comp.push(j);}}
    out.push(comp);}
  return out;}
function genMap(seed,mode){mode=MAP_MODES[mode]?mode:'river';const mp=MAP_MODES[mode];
  const r=rng(seed+mp.salt),noise=makeNoise(r),R=(a,b)=>a+(b-a)*r();
  const fbm=(x,y,o)=>{let s=0,a=.5,f=1,n=0;for(let i=0;i<o;i++){s+=a*noise(x*f,y*f);n+=a;a*=.5;f*=2.03;}return s/n;};
  const M={seed,mode,wet:mp.wet,cls:new Uint8Array(N),road:new Uint8Array(N),hgt:new Float32Array(N),trench:new Uint8Array(N),lu:new Uint8Array(N)};
  const used=new Set();const uname=()=>{let n,g=0;do n=PRE[r()*PRE.length|0]+SUF[r()*SUF.length|0];while(used.has(n)&&g++<50);used.add(n);return n;};
  M.townName=uname();M.riverName=uname();
  const walk=(pts,fn)=>{for(let k=0;k<pts.length-1;k++){const a=pts[k],b=pts[k+1],L=dist(a,b),n=Math.max(1,Math.ceil(L/3)),ux=L?(b.x-a.x)/L:0,uy=L?(b.y-a.y)/L:0;
    for(let s=0;s<=n;s++){const x=a.x+(b.x-a.x)*s/n,y=a.y+(b.y-a.y)*s/n;if(x<0||y<0||x>=W||y>=H)continue;fn(cellOf(x,y),x,y,ux,uy);}}};

  // river: one channel west to east that meanders gently, stays narrow in open country and broadens through the town
  const tx=W*R(.42,.56),ry0=H*R(.46,.52),ro=R(0,50);
  const bumps=mp.lake?[{x:tx,a:R(...mp.lake[0]),s:R(...mp.lake[1])}]:[{x:tx+R(-40,40),a:R(...mp.townBump),s:R(120,180)}];
  if(r()<mp.bump2)bumps.push({x:W*R(.68,.88),a:R(22,45),s:R(90,160)});
  const RV=[],RW=[],NR=W/10+3;
  for(let i=0;i<NR;i++){const x=i*10;RV.push(ry0+(fbm(x/900+ro,ro*.7,3)-.5)*520+(fbm(x/240+ro*2,7.1,2)-.5)*120);
    let w=mp.rw[0]+fbm(x/260+ro,4.2,2)*mp.rw[1];for(const b of bumps)w+=b.a*Math.exp(-(((x-b.x)/b.s)**2));RW.push(mp.wet?w:0);}
  // cap the slope so the channel never turns side-on, then soften the kinks
  for(let i=1;i<NR;i++)RV[i]=clamp(RV[i],RV[i-1]-7,RV[i-1]+7);
  for(let p=0;p<3;p++)for(let i=1;i<NR-1;i++)RV[i]=(RV[i-1]+2*RV[i]+RV[i+1])/4;
  for(let i=0;i<NR;i++)RV[i]=clamp(RV[i],H*.34,H*.64);
  const ry=x=>{const f=clamp(x,0,W)/10,i=Math.min(f|0,RV.length-2),t=f-i;return RV[i]*(1-t)+RV[i+1]*t;};
  const rw=x=>{const f=clamp(x,0,W)/10,i=Math.min(f|0,RW.length-2),t=f-i;return RW[i]*(1-t)+RW[i+1]*t;};
  // on a dry map the front line keeps its curve but has no water
  const water=mp.wet?(x,y)=>Math.abs(y-ry(x))<rw(x)/2:()=>false;
  const side=(x,y)=>y<ry(x)?-1:1;
  const bank=(x,y)=>Math.abs(y-ry(x))-rw(x)/2;
  const rang=x=>Math.atan2(ry(x+30)-ry(x-30),60);
  Object.assign(M,{ry,rw,water,side});
  const bx=tx+R(-20,20),by=ry(bx);
  const B0={x:bx+R(-30,30)};B0.y=ry(B0.x)-rw(B0.x)/2-R(100,125);

  // height: a broad valley around the river, rolling noise, and a few distinct hills, one of them north of the town
  const hills=[];
  {const a=R(-2.45,-.7),d=R(400,560),x=clamp(B0.x+Math.cos(a)*d,140,W-140);
    hills.push({x,y:clamp(Math.min(B0.y+Math.sin(a)*d,ry(x)-rw(x)/2-230),110,H),a:.42,s:R(120,160)});}
  for(let t=0;t<200&&hills.length<mp.hills;t++){const x=R(80,W-80),y=R(80,H-80);
    if(bank(x,y)<170||Math.hypot(x-bx,y-by)<380||hills.some(h=>Math.hypot(h.x-x,h.y-y)<320))continue;hills.push({x,y,a:R(.14,.28)*mp.hillAmp,s:R(90,180)});}
  // mountain ridges wall both flanks
  const ridges=mp.ridges?[{x:W*R(.08,.16),a:R(.75,.9),s:R(150,190),k:R(0,50)},{x:W*R(.84,.92),a:R(.75,.9),s:R(150,190),k:R(0,50)}]:[];
  const hraw=M.hgt;
  for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const x=i*C+4,y=j*C+4;
    let h=(1-mp.valley)*fbm(x/430+11,y/430+5,4)+mp.valley*Math.min(1,Math.max(0,bank(x,y))/450)**.8;
    for(const q of hills)h+=q.a*Math.exp(-((x-q.x)**2+(y-q.y)**2)/(q.s*q.s));
    for(const g of ridges)h+=g.a*Math.exp(-(((x-g.x)/g.s)**2))*(.7+.6*fbm(x/170+g.k,y/170,3));
    hraw[j*GW+i]=h;}
  const hs=(x,y)=>{const gx=clamp(x/C-.5,0,GW-1.001),gy=clamp(y/C-.5,0,GH-1.001),i=gx|0,j=gy|0,u=gx-i,v=gy-j,k=j*GW+i;
    return hraw[k]*(1-u)*(1-v)+hraw[k+1]*u*(1-v)+hraw[k+GW]*(1-u)*v+hraw[k+GW+1]*u*v;};

  // streams rise on high ground, run downhill and end in the river or join another stream
  M.streams=[];const sm=new Uint8Array(N),carve=new Float32Array(N);
  for(let t=0;t<250&&M.streams.length<mp.streams;t++){let x=R(40,W-40),y=R(40,H-40);
    const b=bank(x,y);if(b<150||b>560||M.streams.some(s=>Math.hypot(s[0].x-x,s[0].y-y)<190))continue;
    const sg=y<ry(x)?1:-1;let a=sg*Math.PI/2+R(-.6,.6),end=false;const P=[{x,y}];
    for(let k=0;k<170;k++){const gx=hs(x+12,y)-hs(x-12,y),gy=hs(x,y+12)-hs(x,y-12),gl=Math.hypot(gx,gy)||1e-9;
      let da=Math.atan2(-gy/gl+sg*.7+Math.sin(a)*1.4,-gx/gl+Math.cos(a)*1.4)-a;da=Math.atan2(Math.sin(da),Math.cos(da));
      a+=clamp(da,-.3,.3)+(noise(x/60+t*3.1,y/60)-.5)*.4;
      x+=Math.cos(a)*8;y+=Math.sin(a)*8;if(x<0||x>=W||y<0||y>=H){if(!mp.wet)end=true;break;}
      // a stream that curls back on itself is dropped rather than drawn as a loop
      if(P.some((q,j)=>j<P.length-4&&Math.hypot(q.x-x,q.y-y)<16))break;
      P.push({x,y});if(water(x,y)||sm[cellOf(x,y)]){end=true;break;}}
    if(!end||P.length<10)continue;
    M.streams.push(P);walk(P,i=>{sm[i]=1;});
    for(const p of P){const cx=Math.floor(p.x/C),cy=Math.floor(p.y/C);
      for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=GW||ny>=GH)continue;
        const k=ny*GW+nx,d=Math.hypot(nx*C+4-p.x,ny*C+4-p.y);if(d<24)carve[k]=Math.max(carve[k],.035*(1-d/24));}}}
  let hmin=1e9,hmax=-1e9;
  for(let i=0;i<N;i++){hraw[i]-=carve[i];hmin=Math.min(hmin,hraw[i]);hmax=Math.max(hmax,hraw[i]);}
  for(let i=0;i<N;i++)M.hgt[i]=(hraw[i]-hmin)/(hmax-hmin);
  M.elev=h=>Math.round(140+h*260);
  const slope=new Float32Array(N);let smax=1e-9;
  for(let j=1;j<GH-1;j++)for(let i=1;i<GW-1;i++){const k=j*GW+i,s=Math.hypot(M.hgt[k+1]-M.hgt[k-1],M.hgt[k+GW]-M.hgt[k-GW]);slope[k]=s;smax=Math.max(smax,s);}

  // town quarters on both banks around the main bridge, each with its own street grid, clipped to its bank
  const D=[];
  const mkD=(cx,cy,rx,ryy,rot,grid,sp,village,name,sd)=>{const poly=blob(cx,cy,rx,ryy,rot,village?.4:.35,noise,R(0,90));
    D.push({cx,cy,poly,bb:bbox(poly),rot:grid,sp,village,name,side:sd});};
  const ts=mp.town.scale;
  mkD(B0.x,B0.y,R(175,215)*ts,R(95,120)*ts,rang(B0.x),R(-.12,.12),R(22,26),false,M.townName,-1);
  for(const s of [-1,1]){const x=bx+s*R(200,270)*ts,a=rang(x);mkD(x,ry(x)-rw(x)/2-R(65,90)*ts,R(110,150)*ts,R(55,80)*ts,a,a+R(-.1,.1),R(20,24),false,'',-1);}
  {const x=bx+R(-10,60);mkD(x,ry(x)+rw(x)/2+R(75,100)*ts,R(130,170)*ts,R(65,90)*ts,rang(x),R(-.15,.15),R(21,25),false,'',1);}
  if(r()<(mp.town.extra?1:.65)){const x=bx+(r()<.5?-1:1)*R(190,240)*ts,a=rang(x);mkD(x,ry(x)+rw(x)/2+R(50,70)*ts,R(80,120)*ts,R(45,65)*ts,a,a,R(20,23),false,'',1);}
  // a city spreads further out along both banks
  if(mp.town.extra)for(const [s,sd] of [[-1,-1],[1,-1],[-1,1],[1,1]]){const x=clamp(bx+s*R(430,520),120,W-120),a=rang(x);
    mkD(x,ry(x)+sd*(rw(x)/2+R(70,110)),R(110,150),R(60,85),a,a+R(-.15,.15),R(20,24),false,'',sd);}

  // roads: every road is rasterised as it is added, so later roads can join the network
  M.roads=[];const rid=new Int16Array(N).fill(-1),rpx=new Float32Array(N),rpy=new Float32Array(N),rpd=new Float32Array(N).fill(1e9);
  const setRoad=(i,x,y,kind,id)=>{const c=cc(i);if(water(c.x,c.y))M.road[i]=3;else if(M.road[i]!==3)M.road[i]=Math.max(M.road[i],kind);
    rid[i]=id;const d=Math.hypot(c.x-x,c.y-y);if(d<rpd[i]){rpd[i]=d;rpx[i]=x;rpy[i]=y;}};
  const addRoad=(pts,kind)=>{const id=M.roads.length;M.roads.push({pts,kind});let prev=-1;
    walk(pts,(i,x,y,ux,uy)=>{
      // keep the cell chain 4-connected so narrow bridges stay passable
      if(prev>=0&&prev!==i&&prev%GW!==i%GW&&(prev/GW|0)!==(i/GW|0))setRoad((i/GW|0)*GW+prev%GW,x,y,kind,id);
      setRoad(i,x,y,kind,id);prev=i;
      if(kind===2)for(const o of [-5,5]){const qx=x-uy*o,qy=y+ux*o;if(qx>=0&&qy>=0&&qx<W&&qy<H)setRoad(cellOf(qx,qy),x,y,kind,id);}});
    return id;};
  const roadNear=(x,y,rad)=>{const cx=Math.floor(x/C),cy=Math.floor(y/C);for(let dy=-rad;dy<=rad;dy++)for(let dx=-rad;dx<=rad;dx++){
    const nx=cx+dx,ny=cy+dy;if(nx>=0&&ny>=0&&nx<GW&&ny<GH&&M.road[ny*GW+nx])return true;}return false;};

  // highways: one north-south through the main bridge, a northern bypass and a south-eastern ring
  const hx0=clamp(bx+R(-260,260),80,W-80),hx1=clamp(bx+R(-300,300),80,W-80);
  const main=catmull([{x:hx0,y:-40},{x:(hx0+bx)/2+R(-60,60),y:by*.45},{x:bx+R(-20,20),y:by-170},{x:bx,y:by},
    {x:bx+R(-20,20),y:by+170},{x:(hx1+bx)/2+R(-60,60),y:by+(H-by)*.55},{x:hx1,y:H+40}]);
  const ny=y=>clamp(y,50,by-260);
  const ringN=catmull([{x:-40,y:ny(by-R(330,450))},{x:W*.22,y:ny(by-R(380,480))},{x:W*.5,y:ny(by-R(420,520))},{x:W*.76,y:ny(by-R(330,430))},{x:W+40,y:ny(by-R(200,330))}])
    .map(p=>({x:p.x,y:Math.max(30,Math.min(p.y,ry(p.x)-rw(p.x)/2-200))}));
  const sy=Math.min(H-110,by+R(380,470));
  const sp=main.reduce((b,p)=>Math.abs(p.y-sy)<Math.abs(b.y-sy)?p:b);
  const ringS=catmull([{x:sp.x,y:sp.y},{x:sp.x+(W-sp.x)*.45,y:clamp(sy+R(-80,60),by+250,H-50)},{x:W+40,y:clamp(sy+R(-160,120),by+200,H-40)}])
    .map(p=>({x:p.x,y:Math.min(H-30,Math.max(p.y,ry(p.x)+rw(p.x)/2+210))}));
  // minor crossings at narrow points of the river, used by the attacker AI to flank
  const crossRoad=(x0,x1)=>{let bxs=x0,best=1e9;for(let k=0;k<12;k++){const x=R(x0,x1),w=rw(x);if(w<best){best=w;bxs=x;}}
    const y=ry(bxs);return catmull([{x:bxs+R(-90,90),y:clamp(y+R(240,360),40,H-40)},{x:bxs+R(-8,8),y:y+45},{x:bxs+R(-8,8),y:y-45},{x:bxs+R(-90,90),y:clamp(y-R(240,360),40,H-40)}]);};
  const westX=crossRoad(W*.12,W*.28),eastX=crossRoad(W*.72,W*.9);
  addRoad(main,2);addRoad(ringN,2);addRoad(ringS,2);
  const flanks=[[westX,addRoad(westX,1)],[eastX,addRoad(eastX,1)]];
  // downtown bridges: extra crossings inside a city, joining its quarters on either bank
  for(let k=0;k<(mp.cityBridges||0);k++){const x=clamp(bx+(k%2?1:-1)*R(130,210),60,W-60),y=ry(x),h=rw(x)/2;
    addRoad(catmull([{x:x+R(-25,25),y:y+h+R(90,140)},{x:x+R(-6,6),y:y+h+22},{x:x+R(-6,6),y:y-h-22},{x:x+R(-25,25),y:y-h-R(90,140)}]),1);}
  // with no river, a lateral road runs along the front and crosses the main highway at the crossroads objective
  if(!mp.wet){const P=[];for(let k=0;k<=8;k++){const x=-40+(W+80)*k/8;P.push({x,y:ry(clamp(x,0,W))+(k===4?0:R(-30,30))});}addRoad(catmull(P),1);}

  // villages: most sit on an existing road, a few lie off it and get their own lanes
  const vill=[];
  const okV=(x,y)=>x>70&&x<W-70&&y>70&&y<H-70&&bank(x,y)>110&&Math.hypot(x-bx,y-by)>520&&!vill.some(v=>Math.hypot(v.x-x,v.y-y)<300);
  const cand=[];for(const rd of M.roads){const p=rd.pts;for(let k=4;k<p.length-4;k+=6)cand.push({p:p[k],a:Math.atan2(p[k+1].y-p[k-1].y,p[k+1].x-p[k-1].x)});}
  for(let t=0;t<150&&vill.length<Math.min(4,mp.villages);t++){const c=cand[r()*cand.length|0];if(!okV(c.p.x,c.p.y))continue;const o=R(-14,14);
    vill.push({x:c.p.x-Math.sin(c.a)*o,y:c.p.y+Math.cos(c.a)*o,a:c.a});}
  for(let t=0;t<200&&vill.length<mp.villages;t++){const x=R(80,W-80),y=R(80,H-80);if(okV(x,y))vill.push({x,y,a:R(0,3.14)});}
  for(const v of vill)mkD(v.x,v.y,R(38,60),R(30,46),v.a,v.a,R(13,16),true,uname(),side(v.x,v.y));
  M.D=D;
  const urb=new Uint8Array(N);
  for(const d of D){const b=d.bb;for(let j=Math.max(0,Math.floor(b.y0/C));j<=Math.min(GH-1,Math.floor(b.y1/C));j++)
    for(let i=Math.max(0,Math.floor(b.x0/C));i<=Math.min(GW-1,Math.floor(b.x1/C));i++){const x=i*C+4,y=j*C+4;
      if(inPoly(d.poly,x,y)&&(!mp.wet||(side(x,y)===d.side&&bank(x,y)>5)))urb[j*GW+i]=d.village?2:1;}}
  M.streets=[];
  for(const d of D){const ext=Math.max(d.bb.w,d.bb.h)*.75;
    for(const ang of [d.rot,d.rot+Math.PI/2]){const dx=Math.cos(ang),dy=Math.sin(ang),px=-dy,py=dx;
      for(let o=-ext;o<=ext;o+=d.sp){const oo=o+R(-2.5,2.5);let run=[];
        for(let t=-ext;t<=ext;t+=5){const x=d.cx+dx*t+px*oo,y=d.cy+dy*t+py*oo;
          const ins=x>=d.bb.x0&&x<=d.bb.x1&&y>=d.bb.y0&&y<=d.bb.y1&&inPoly(d.poly,x,y)&&(!mp.wet||(side(x,y)===d.side&&bank(x,y)>5));
          if(ins)run.push({x,y});else{if(run.length>2)M.streets.push(run);run=[];}}
        if(run.length>2)M.streets.push(run);}}}

  // country roads are laid by least-cost search: they avoid steep ground, water and the town, cross streams reluctantly,
  // wander a little, and end where they meet an existing road
  const rcost=new Float32Array(N);
  for(let i=0;i<N;i++){const c=cc(i);if(water(c.x,c.y)){rcost[i]=Infinity;continue;}
    let k=(1+slope[i]/smax*3)*(.7+.6*noise(c.x/90+31,c.y/90+17));if(mp.wet&&bank(c.x,c.y)<28)k+=3;if(sm[i])k+=4;if(urb[i]===1)k+=6;
    if(mp.rockH&&M.hgt[i]>mp.rockH)k+=8;
    // keep roads from creeping along the map border
    const e=Math.min(i%GW,GW-1-i%GW,i/GW|0,GH-1-(i/GW|0));if(e<4)k+=6-e;rcost[i]=k;}
  const cheapest=(src,goal,dst,mod)=>{const g=new Float32Array(N).fill(Infinity),prev=new Int32Array(N).fill(-1),done=new Uint8Array(N),hp=new Heap();
    const dx0=dst>=0?dst%GW:0,dy0=dst>=0?dst/GW|0:0,hu=i=>dst<0?0:Math.hypot(i%GW-dx0,(i/GW|0)-dy0)*.3;
    g[src]=0;hp.push(src,hu(src));
    while(hp.size){const i=hp.pop();if(done[i])continue;done[i]=1;
      if(i!==src&&goal(i)){const path=[i];let k=i;while(prev[k]>=0){k=prev[k];path.push(k);}return path.reverse();}
      const x=i%GW,y=i/GW|0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=GW||ny>=GH)continue;
        const j=ny*GW+nx;if(done[j])continue;let c=M.road[j]?.3:rcost[j];if(mod)c*=mod(j);if(!(c<Infinity))continue;
        const nd=g[i]+c*(dx&&dy?1.414:1);if(nd<g[j]){g[j]=nd;prev[j]=i;hp.push(j,nd+hu(j));}}}
    return null;};
  // turns a cell path into smooth new road pieces, skipping the stretches that already follow a road
  const commit=(path,start)=>{let run=[],a=-1;
    const fin=b=>{if(run.length>=2||(a>=0&&b>=0)){const P=[];
        if(a>=0)P.push({x:rpx[a],y:rpy[a]});else if(start)P.push(start);
        for(let k=0;k<run.length;k++)if((k%4===0&&!(k===0&&a<0&&start))||k===run.length-1)P.push(cc(run[k]));
        if(b>=0)P.push({x:rpx[b],y:rpy[b]});
        if(P.length>=2)addRoad(catmull(P,6),1);}
      run=[];};
    for(const c of path){if(M.road[c]){if(run.length)fin(c);a=c;}else run.push(c);}
    if(run.length)fin(-1);};
  for(const [pts,id] of flanks)for(const e of [pts[0],pts[pts.length-1]]){const p=cheapest(cellOf(e.x,e.y),i=>M.road[i]>0&&rid[i]!==id,-1);if(p)commit(p);}
  for(const d of D){if(d.village||d===D[0])continue;
    if(!roadNear(d.cx,d.cy,4)){const p=cheapest(cellOf(d.cx,d.cy),i=>M.road[i]>0,-1,i=>urb[i]===1?.2:1);if(p)commit(p,{x:d.cx,y:d.cy});}}
  const vs=D.filter(d=>d.village),pairs=new Set();
  for(const v of vs){const near=vs.filter(w=>w!==v&&w.side===v.side).map(w=>({w,d:Math.hypot(w.cx-v.cx,w.cy-v.cy)})).filter(o=>o.d<720).sort((a,b)=>a.d-b.d).slice(0,2);
    for(const {w} of near){const key=[D.indexOf(v),D.indexOf(w)].sort((a,b)=>a-b).join();if(pairs.has(key))continue;pairs.add(key);
      const b=cellOf(w.cx,w.cy),p=cheapest(cellOf(v.cx,v.cy),i=>i===b,b);if(p)commit(p,{x:v.cx,y:v.cy});}}
  for(const v of vs)if(!roadNear(v.cx,v.cy,3)){const p=cheapest(cellOf(v.cx,v.cy),i=>M.road[i]>0,-1);if(p)commit(p,{x:v.cx,y:v.cy});}
  for(let t=0,n=0;t<40&&n<7;t++){const e=r()*4|0;
    const p=e===0?{x:R(60,W-60),y:4}:e===1?{x:R(60,W-60),y:H-4}:e===2?{x:4,y:R(60,H-60)}:{x:W-4,y:R(60,H-60)};
    if(bank(p.x,p.y)<60||roadNear(p.x,p.y,18))continue;const pth=cheapest(cellOf(p.x,p.y),i=>M.road[i]>0,-1);if(!pth||pth.length>110)continue;
    commit(pth,{x:e===2?-20:e===3?W+20:p.x,y:e===0?-20:e===1?H+20:p.y});n++;}

  // land use: forest on hills, slopes and the river bank west of town; fields on flat ground around villages and the town.
  // Each gets a share of the land by score, keeps clear of towns and of each other, and loses scraps too small to read.
  const dU=gridDist(i=>urb[i]>0,8),wf={x:bx-R(300,420)};wf.y=ry(wf.x);
  let land=0;for(let i=0;i<N;i++){const c=cc(i);if(!water(c.x,c.y))land++;}
  const pick=(score,frac)=>{const v=score.filter(s=>s>-9).sort();return v.length?v[Math.max(0,v.length-Math.min(v.length,Math.floor(land*frac)))]:9;};
  const fsc=new Float32Array(N).fill(-9);
  for(let i=0;i<N;i++){const c=cc(i),b=mp.wet?bank(c.x,c.y):99;if(b<6||urb[i]||dU[i]<=2||Math.hypot(c.x-bx,c.y-by)<300)continue;
    fsc[i]=fbm(c.x/360+40,c.y/360+9,4)+.3*slope[i]/smax+.2*M.hgt[i]+.35*Math.exp(-(((c.x-wf.x)/260)**2)-(b/190)**2);}
  const ft=pick(fsc,mp.forest);for(let i=0;i<N;i++)if(fsc[i]>=ft)M.lu[i]=2;
  for(const comp of components(i=>M.lu[i]===2))if(comp.length<24)for(const i of comp)M.lu[i]=0;
  const dF=gridDist(i=>M.lu[i]===2,4),psc=new Float32Array(N).fill(-9);
  for(let i=0;i<N;i++){const c=cc(i),b=mp.wet?bank(c.x,c.y):99,td=Math.hypot(c.x-bx,c.y-by);if(b<6||urb[i]||dU[i]<=1||dF[i]<=2||td<240)continue;
    let vp=0;for(const v of vs)vp+=Math.exp(-((c.x-v.cx)**2+(c.y-v.cy)**2)/(230*230));
    psc[i]=fbm(c.x/300+70,c.y/300+3,3)+.35*(1-Math.min(1,slope[i]/smax*1.5))+.3*vp+.25*Math.exp(-(((td-380)/260)**2));}
  const pt=pick(psc,mp.field);for(let i=0;i<N;i++)if(psc[i]>=pt)M.lu[i]=1;
  for(const comp of components(i=>M.lu[i]===1))if(comp.length<24)for(const i of comp)M.lu[i]=0;
  // farm tracks run from the middle of the larger fields out to the nearest road
  for(const comp of components(i=>M.lu[i]===1)){if(comp.length<150)continue;
    for(let k=0;k<(comp.length>420?2:1);k++){const s=comp[r()*comp.length|0],c=cc(s);if(roadNear(c.x,c.y,5))continue;
      const p=cheapest(s,i=>M.road[i]>0,-1,i=>M.lu[i]===1?.5:1.4);if(p&&p.length<60)commit(p,c);}}

  // bare rock on the high ridges (land use 3), except where a road or a village already is
  if(mp.rockH){for(let i=0;i<N;i++)if(M.hgt[i]>mp.rockH&&!urb[i]&&!M.road[i])M.lu[i]=3;
    for(const comp of components(i=>M.lu[i]===3))if(comp.length<24)for(const i of comp)M.lu[i]=0;}
  // town streets carry traffic too
  for(const s of M.streets)walk(s,(i,x,y)=>{if(M.road[i]!==3)M.road[i]=Math.max(M.road[i],1);if(rpd[i]>=1e9){rpd[i]=Math.hypot(cc(i).x-x,cc(i).y-y);rpx[i]=x;rpy[i]=y;}});

  // terrain classes, in priority order
  for(let i=0;i<N;i++){M.cls[i]=M.lu[i]===1?FIELD:M.lu[i]===2?FOREST:M.lu[i]===3?ROCK:OPEN;if(urb[i])M.cls[i]=URBAN;}
  M.streams.forEach(p=>walk(p,i=>{M.cls[i]=STREAM;}));
  // where a road crosses a stream, the stream cells beside it count as road too, so a column spreading off the
  // carriageway doesn't wade
  {const add=[];for(let i=0;i<N;i++){if(M.cls[i]!==STREAM||!M.road[i])continue;const x=i%GW;
    for(const j of [x>0?i-1:-1,x<GW-1?i+1:-1,i-GW,i+GW])if(j>=0&&j<N&&M.cls[j]===STREAM&&!M.road[j])add.push([j,M.road[i]]);}
    for(const [j,r] of add)if(!M.road[j])M.road[j]=Math.min(r,2);}
  for(let i=0;i<N;i++){const c=cc(i);if(water(c.x,c.y))M.cls[i]=WATER;}

  // bridge symbols
  M.bridges=[];
  if(mp.wet)for(const rd of M.roads){const p=rd.pts;for(let k=0;k<p.length-1;k++){const a=p[k],b=p[k+1];
    if(a.x<0||a.x>W||b.x<0||b.x>W)continue;
    if(side(a.x,a.y)!==side(b.x,b.y)){const x=(a.x+b.x)/2;if(M.bridges.some(q=>Math.hypot(q.x-x,q.y-ry(x))<30))continue;
      M.bridges.push({x,y:ry(x),ang:Math.atan2(b.y-a.y,b.x-a.x),kind:rd.kind,len:rw(x)});}}}

  // contours
  M.contours=[];const Hh=(i,j)=>M.hgt[j*GW+i];
  for(const lv of [.5,.6,.7,.8,.9])for(let j=0;j<GH-1;j++)for(let i=0;i<GW-1;i++){if(M.cls[j*GW+i]===WATER)continue;
    const a=Hh(i,j),b=Hh(i+1,j),c=Hh(i+1,j+1),d=Hh(i,j+1),x0=i*C+4,y0=j*C+4,q=[];
    const e=(p,s,x1,y1,x2,y2)=>{if((p<lv)!==(s<lv)){const t=(lv-p)/(s-p);q.push(x1+(x2-x1)*t,y1+(y2-y1)*t);}};
    e(a,b,x0,y0,x0+C,y0);e(b,c,x0+C,y0,x0+C,y0+C);e(d,c,x0,y0+C,x0+C,y0+C);e(a,d,x0,y0,x0,y0+C);
    if(q.length>=4)M.contours.push([q[0],q[1],q[2],q[3],lv]);if(q.length===8)M.contours.push([q[4],q[5],q[6],q[7],lv]);}

  // objectives
  let A=null,bd=1e9;
  for(let k=0;k<main.length-1;k++){const a=main[k],b=main[k+1];if(side(a.x,a.y)!==side(b.x,b.y)){const x=(a.x+b.x)/2,d=Math.abs(x-bx);if(d<bd){bd=d;A={x,y:ry(x)};}}}
  if(!A)A={x:bx,y:by};
  const aName=!mp.wet?uname()+' Crossroads':mp.lake?M.riverName+' Causeway':M.riverName+' Bridge';
  const d0=D[0];let B={x:d0.cx,y:Math.min(d0.cy,ry(d0.cx)-rw(d0.cx)/2-60)};
  let Cc=null,best=-1;
  for(let j=4;j<GH-4;j++)for(let i=8;i<GW-8;i++){const x=i*C+4,y=j*C+4;if(y>ry(x)-150)continue;const dd=Math.hypot(x-B.x,y-B.y);
    if(dd<mp.cDist[0]||dd>mp.cDist[1])continue;const k=j*GW+i,h=M.hgt[k];if(h>best&&M.cls[k]!==WATER&&M.cls[k]!==URBAN){best=h;Cc={x,y};}}
  if(!Cc){Cc={x:clamp(B.x+300,80,W-80),y:clamp(B.y-260,60,H)};best=M.hgt[cellOf(Cc.x,Cc.y)];}
  M.waterLabel=!mp.wet?null:mp.lake?'Lake '+M.riverName:'R. '+M.riverName;M.waterAt=mp.lake?tx+150:W*.08;
  M.objs=[{key:'A',name:aName,kind:mp.wet?'bridge':'crossroads',x:A.x,y:A.y},{key:'B',name:M.townName,x:B.x,y:B.y},{key:'C',name:'Hill '+M.elev(best),x:Cc.x,y:Cc.y}];

  // depots on the main highway at each map edge
  M.depD=main.find(p=>p.y>=26)||{x:bx,y:26};
  M.depA=[...main].reverse().find(p=>p.y<=H-26)||{x:bx,y:H-26};
  M.depD={x:clamp(M.depD.x,30,W-30),y:M.depD.y};M.depA={x:clamp(M.depA.x,30,W-30),y:M.depA.y};

  // flank crossings for the attacker AI
  const crossPt=pts=>{for(let k=0;k<pts.length-1;k++){const a=pts[k],b=pts[k+1];if(side(a.x,a.y)!==side(b.x,b.y)){const x=(a.x+b.x)/2;return{x,y:ry(x)-rw(x)/2-55};}}return null;};
  M.viaW=crossPt(westX);M.viaE=crossPt(eastX);

  // river bridge spans: the bridge cells grouped by the bridge symbol they belong to, so a game can drop them.
  // M.road0 keeps the untouched road grid, since a game rewrites M.road as bridges fall and pontoons go up.
  const spans=new Map();
  for(const cells of components(i=>M.road[i]===3)){const c=cc(cells[cells.length>>1]);let sym=null,sd=30;
    for(const q of M.bridges){const d=Math.hypot(q.x-c.x,q.y-c.y);if(d<sd){sd=d;sym=q;}}
    if(!sym)continue;if(spans.has(sym))spans.get(sym).cells.push(...cells);else spans.set(sym,{sym,cells});}
  M.spans=[...spans.values()];M.road0=M.road.slice();
  // for each road cell, the nearest point on the drawn road or street line, so units can march along the real curve
  M.rpx=rpx;M.rpy=rpy;M.rpOk=Uint8Array.from(rpd,d=>d<1e9?1:0);
  // what the scenery ring (genOuter) needs to continue this landscape past the border; reading it never changes the map
  M.gen={fbm,noise,mp,ry0,ro,bumps,hills,ridges,hmin,hmax,ft,pt,wf,bx,by,smax,villages:vs.map(v=>({cx:v.cx,cy:v.cy}))};
  return M;
}

