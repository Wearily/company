// COMPANY · src/engine/mapgen2.js
// Map generation v2 (genMap2) and makeMap, which picks a generator. Pure and deterministic.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
// The New map generation switch (on by default) uses this generator; genMap above is the legacy one and is untouched.
// The battle is the same: the attacker comes from the south, the defender holds the north, objective A is on the front
// line and B and C are behind it. Everything about the ground is rolled per seed within the battlefield's theme
// (MAP_MODES[mode].v2): where the front line runs and how its river winds, lakes and ponds away from it, hills,
// escarpments and rock massifs, where the towns, villages, works and farms are, how many bridges there are and where,
// the road network and its depots, forests and fields, and which features become the objectives. Height, land use, the
// river and the lakes are functions of world x, y, so the scenery ring (genOuter) carries them past the border.
// Each map checks itself (objectives reachable by infantry and armor from both depots, a bridge on a river map, room
// behind B) and rolls again with the next sub-seed if not, so a seed always gives the same map.
function genMap2(seed,mode){mode=MAP_MODES[mode]?mode:'river';let m=null;
  for(let t=0;t<6&&!(m&&m.ok);t++)m=genMap2Try(seed,mode,t);
  return m;}
function genMap2Try(seed,mode,att){const mp=MAP_MODES[mode],th=mp.v2,wet=mp.wet;
  const r=rng((seed*7+mp.salt+23117+att*104729)>>>0),noise=makeNoise(r),R=(a,b)=>a+(b-a)*r(),RI=(a,b)=>Math.floor(R(a,b+.999)),pick=a=>a[r()*a.length|0];
  const fbm=(x,y,o)=>{let s=0,a=.5,f=1,n=0;for(let i=0;i<o;i++){s+=a*noise(x*f,y*f);n+=a;a*=.5;f*=2.03;}return s/n;};
  const M={seed,mode,wet,gen2:true,cls:new Uint8Array(N),road:new Uint8Array(N),hgt:new Float32Array(N),trench:new Uint8Array(N),lu:new Uint8Array(N)};
  const used=new Set();const uname=()=>{let n,g=0;do n=PRE[r()*PRE.length|0]+SUF[r()*SUF.length|0];while(used.has(n)&&g++<50);used.add(n);return n;};
  M.townName=uname();M.riverName=uname();
  const walk=(pts,fn)=>{for(let k=0;k<pts.length-1;k++){const a=pts[k],b=pts[k+1],L=dist(a,b),n=Math.max(1,Math.ceil(L/3)),ux=L?(b.x-a.x)/L:0,uy=L?(b.y-a.y)/L:0;
    for(let s=0;s<=n;s++){const x=a.x+(b.x-a.x)*s/n,y=a.y+(b.y-a.y)*s/n;if(x<0||y<0||x>=W||y>=H)continue;fn(cellOf(x,y),x,y,ux,uy);}}};
  const S=R(...th.scale);

  // the front line: a river course walked west to east, well past both borders so the scenery ring carries it on. Its
  // heading swings through meanders whose size and tightness change along the way (straight reaches, wide lazy loops,
  // tight bends), on top of slow swings that carry it north or south. A gentle pull keeps it a west–east front in the
  // middle of the map, and it never turns more than about 55° from east, so the line stays one-valued. The profile sets
  // the character: calm, meandering, wild, mixed (straight reaches between meandering ones) or swinging.
  const XS=-1200,STP=10,NS=Math.round((W+2400)/STP)+1,CAP=.96;
  const prof=pick(['calm','meander','meander','wild','mixed','mixed','swing']);
  const PR={calm:{a:[.12,.3],l:[900,1600],d:[.5,.9],s:.3},meander:{a:[.55,.9],l:[420,820],d:[.4,.8],s:.5},wild:{a:[.75,1],l:[260,520],d:[.3,.6],s:.35},
    mixed:{a:[.6,1],l:[300,900],d:[.5,.9],s:.4},swing:{a:[.25,.55],l:[600,1100],d:[1,1.4],s:.3}}[prof];
  const aMax=R(...PR.a),lA=R(...PR.l),lB=R(...PR.l),dAmp=R(...PR.d),q1=R(0,60),q2=R(0,60),q3=R(0,60);
  const y0=H*R(.4,.58),tilt=R(-.2,.2)*H/W,yt=x=>clamp(y0+tilt*(x-W/2),H*.3,H*.68);
  const RV=new Float32Array(NS);
  {let y=yt(XS),ph=R(0,6.283);
    for(let k=0;k<NS;k++){const x=XS+k*STP;RV[k]=y;
      const lam=lA+(lB-lA)*fbm(x/1600+q1,1.3,2),env=prof==='mixed'?clamp((fbm(x/800+q2,4.4,3)-.38)*3.2,0,1):.55+.45*fbm(x/800+q2,4.4,3);
      ph+=6.2832*STP/lam*(.75+.5*noise(x/300+q3,9.1));
      // meanders: part a swinging rhythm, part noise, so bends vary in size and spacing; big sweeps from slow noise
      const wig=PR.s*Math.sin(ph)+(1-PR.s)*clamp((fbm(x/lam*1.6+q1,5.5,3)-.5)*3.6,-1,1);
      let th=clamp(aMax*env*1.25*wig,-CAP,CAP)+(fbm(x/2300+q3,2.2,2)-.5)*2*dAmp+(noise(x/80+q1,6.6)-.5)*.18;
      // the pull back toward the middle grows the further it strays, so it turns back in a bend rather than running flat
      {const dv=(y-yt(x))/420;th-=dv*Math.abs(dv)*.55+dv*.12;}
      y=clamp(y+Math.tan(clamp(th,-CAP,CAP))*STP,H*.06,H*.94);}
    for(let p=0;p<2;p++)for(let k=1;k<NS-1;k++)RV[k]=(RV[k-1]+2*RV[k]+RV[k+1])/4;
    // fit the part on the battlefield into the middle band without flattening it
    let lo=1e9,hi=-1e9;for(let x=0;x<=W;x+=STP){const v=RV[Math.round((x-XS)/STP)];lo=Math.min(lo,v);hi=Math.max(hi,v);}
    const span=hi-lo,room=H*.46,sc=span>room?room/span:1,mid=(lo+hi)/2,tgt=clamp(mid,H*.26+span*sc/2,H*.72-span*sc/2);
    for(let k=0;k<NS;k++)RV[k]=tgt+(RV[k]-mid)*sc;}
  const rvAt=x=>{const f=clamp((x-XS)/STP,0,NS-1.001),i=f|0,t=f-i;return RV[i]+(RV[i+1]-RV[i])*t;};
  const RYF=rvAt,slp=x=>(rvAt(x+10)-rvAt(x-10))/20;
  // the river's width across its flow: narrow reaches and wider ones, and for Lake Narrows one huge widening somewhere
  // along it. RWF is the width measured north–south, so a reach that runs at an angle is drawn just as wide.
  const w0=wet?R(...th.rw):0,widen=[];
  for(let k=RI(...(th.widen||[0,0]));k>0;k--)widen.push({x:W*R(.08,.92),a:R(14,40),s:R(70,170)});
  const bigLake=wet&&th.bigLake?{x:W*R(.28,.72),a:R(230,330),s:R(210,300)}:null;if(bigLake)widen.push(bigLake);
  const RWF=x=>{if(!wet)return 0;let w=w0*(.62+.76*fbm(x/320+9.1,5.7,2));for(const b of widen)w+=b.a*Math.exp(-(((x-b.x)/b.s)**2));
    return w*Math.min(1.6,Math.sqrt(1+slp(x)**2));};
  const band=(x,y)=>wet&&Math.abs(y-RYF(x))<RWF(x)/2,side=(x,y)=>y<RYF(x)?-1:1,bank=(x,y)=>Math.abs(y-RYF(x))-RWF(x)/2,rang=x=>Math.atan2(RYF(x+30)-RYF(x-30),60);
  // lakes and ponds away from the river, with ragged shores; roads go round them
  const lakes=[];
  for(let t=0,n=RI(...th.lakes);t<300&&lakes.length<n;t++){const x=R(70,W-70),y=R(70,H-70),rx=R(55,190),ry=rx*R(.45,.85);
    if(Math.abs(y-RYF(x))-RWF(x)/2<Math.max(rx,ry)+140||lakes.some(l=>Math.hypot(l.x-x,l.y-y)<l.rx+rx+130))continue;
    lakes.push({x,y,rx,ry,rot:R(0,3.14),k:R(0,50)});}
  const lakeF=(x,y)=>{let b=-9;for(const l of lakes){const dx=x-l.x,dy=y-l.y,c=Math.cos(l.rot),s=Math.sin(l.rot),u=(dx*c+dy*s)/l.rx,v=(-dx*s+dy*c)/l.ry;
    b=Math.max(b,1-Math.hypot(u,v)*(1+.35*(noise(x/90+l.k,y/90)-.5)));}return b;};
  const lakeAt=(x,y)=>lakes.length>0&&lakeF(x,y)>0,water=(x,y)=>band(x,y)||lakeAt(x,y);
  Object.assign(M,{ry:RYF,rw:RWF,water,side});

  // height: rolling noise at this map's own scale, a valley toward the river, hills anywhere, sometimes an escarpment that
  // gives one side the high ground, and for Mountain Pass rock massifs at any angle with a pass cut through each
  const valley=wet?R(.18,.42):R(.04,.14),hills=[];
  for(let t=0,n=RI(...th.hills);t<300&&hills.length<n;t++){const x=R(60,W-60),y=R(60,H-60);
    if((wet&&bank(x,y)<140)||lakeAt(x,y)||hills.some(h=>Math.hypot(h.x-x,h.y-y)<280))continue;
    const big=r()<.35;hills.push({x,y,a:big?R(.3,.45):R(.12,.28),s:big?R(140,220):R(80,170),big});}
  const esc=r()<th.escarp?{sd:r()<.55?-1:1,d:R(220,460),w:R(40,90),a:R(.22,.4),k:R(0,50)}:null;
  const massifs=[];for(let k=RI(...(th.massif||[0,0]));k>0;k--){const a=R(0,3.14),L=R(300,650);
    massifs.push({x:W*R(.12,.88),y:H*R(.15,.85),ca:Math.cos(a),sa:Math.sin(a),L,w:R(80,140),amp:R(.7,.95),k:R(0,50),pass:R(-.55,.55)*L});}
  const escY=x=>RYF(x)+esc.sd*esc.d+(fbm(x/260+esc.k,1.7,2)-.5)*160;
  const hRaw=(x,y)=>{let h=(1-valley)*fbm(x/S+11,y/S+5,4)+(wet?valley*Math.min(1,Math.max(0,bank(x,y))/450)**.8:valley*fbm(x/900+3,y/900+8,2));
    for(const q of hills)h+=q.a*Math.exp(-((x-q.x)**2+(y-q.y)**2)/(q.s*q.s));
    if(esc)h+=esc.a/(1+Math.exp(-esc.sd*(y-escY(x))/esc.w));
    for(const m of massifs){const dx=x-m.x,dy=y-m.y,u=dx*m.ca+dy*m.sa,v=-dx*m.sa+dy*m.ca;
      h+=m.amp*Math.exp(-((u/m.L)**6))*Math.exp(-((v/m.w)**2))*(1-.9*Math.exp(-(((u-m.pass)/75)**2)))*(.7+.6*fbm(x/170+m.k,y/170,3));}
    return h;};
  const hraw=M.hgt;for(let j=0;j<GH;j++)for(let i=0;i<GW;i++)hraw[j*GW+i]=hRaw(i*C+4,j*C+4);
  const hs=(x,y)=>{const gx=clamp(x/C-.5,0,GW-1.001),gy=clamp(y/C-.5,0,GH-1.001),i=gx|0,j=gy|0,u=gx-i,v=gy-j,k=j*GW+i;
    return hraw[k]*(1-u)*(1-v)+hraw[k+1]*u*(1-v)+hraw[k+GW]*(1-u)*v+hraw[k+GW+1]*u*v;};
  // streams rise on high ground and run downhill into the river, a lake or another stream (or off a dry map)
  M.streams=[];const sm=new Uint8Array(N),carve=new Float32Array(N);
  for(let t=0,n=RI(...th.streams);t<300&&M.streams.length<n;t++){let x=R(40,W-40),y=R(40,H-40);
    const b=bank(x,y);if(b<150||b>620||lakeAt(x,y)||M.streams.some(s=>Math.hypot(s[0].x-x,s[0].y-y)<190))continue;
    const sg=y<RYF(x)?1:-1;let a=sg*Math.PI/2+R(-.7,.7),end=false;const P=[{x,y}];
    for(let k=0;k<190;k++){const gx=hs(x+12,y)-hs(x-12,y),gy=hs(x,y+12)-hs(x,y-12),gl=Math.hypot(gx,gy)||1e-9;
      let da=Math.atan2(-gy/gl+sg*.6+Math.sin(a)*1.4,-gx/gl+Math.cos(a)*1.4)-a;da=Math.atan2(Math.sin(da),Math.cos(da));
      a+=clamp(da,-.3,.3)+(noise(x/60+t*3.1,y/60)-.5)*.45;
      x+=Math.cos(a)*8;y+=Math.sin(a)*8;if(x<0||x>=W||y<0||y>=H){if(!wet)end=true;break;}
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

  // settlements: a main town (on the river, near it, or inland on either side; a whole city for City Fight), other towns,
  // an industrial works, farms and villages, each with its own street grid
  const D=[];
  const mkD=(cx,cy,rx,ryy,rot,grid,sp,village,name,extra)=>{const poly=blob(cx,cy,rx,ryy,rot,village?.4:.35,noise,R(0,90));
    const d={cx,cy,poly,bb:bbox(poly),rot:grid,sp,village,name,side:side(cx,cy),...(extra||{})};D.push(d);return d;};
  const okPlace=(x,y,rad,gap)=>x>rad+30&&x<W-rad-30&&y>rad+30&&y<H-rad-30&&!lakeAt(x,y)&&lakeF(x,y)<-.6&&(!wet||bank(x,y)>rad*.6+40)&&!D.some(d=>Math.hypot(d.cx-x,d.cy-y)<gap);
  const ts=R(.8,1.15)*(th.townScale||1),tStyle=th.city?'river':wet?pick(['river','river','river','near','inland','inland']):pick(['near','inland','inland']);
  let core=null,townX=null;
  if(tStyle==='river'){
    for(let t=0;t<40&&!core;t++){const x=W*R(.14,.86);if(RWF(x)>110||lakeF(x,RYF(x))>-.8)continue;townX=x;const sd=r()<.62?-1:1,a=rang(x);
      core=mkD(x,RYF(x)+sd*(RWF(x)/2+R(85,120)*ts),R(170,215)*ts,R(90,120)*ts,a,a+R(-.12,.12),R(22,26),false,M.townName);
      if(th.city||r()<.7){const x2=clamp(x+R(-60,60),90,W-90),a2=rang(x2);mkD(x2,RYF(x2)-sd*(RWF(x2)/2+R(75,100)*ts),R(120,170)*ts,R(65,90)*ts,a2,a2+R(-.15,.15),R(21,25),false,'');}
      for(const s of [-1,1])if(r()<(th.city?1:.45)){const x3=clamp(x+s*R(220,290)*ts,100,W-100),a3=rang(x3);if(RWF(x3)>110)continue;
        mkD(x3,RYF(x3)+sd*(RWF(x3)/2+R(60,90)*ts),R(110,150)*ts,R(55,80)*ts,a3,a3+R(-.1,.1),R(20,24),false,'');}
      if(th.city)for(const [s,sd2] of [[-1,-1],[1,-1],[-1,1],[1,1]]){const x4=clamp(x+s*R(420,520),110,W-110),a4=rang(x4);if(RWF(x4)>110)continue;
        mkD(x4,RYF(x4)+sd2*(RWF(x4)/2+R(70,110)),R(110,150),R(60,85),a4,a4+R(-.15,.15),R(20,24),false,'');}}}
  if(!core)for(let t=0;t<200&&!core;t++){const x=W*R(.12,.88),sd=r()<.6?-1:1,off=tStyle==='near'?R(170,300):R(320,620),y=RYF(x)+sd*(RWF(x)/2+off);
    if(okPlace(x,y,160,0))core=mkD(x,y,R(160,205)*ts,R(90,120)*ts,R(0,3.14),R(-.3,.3),R(22,26),false,M.townName);}
  if(!core)core=mkD(W/2,H*.2,150,90,0,0,23,false,M.townName);
  for(let k=RI(...th.towns);k>0;k--)for(let t=0;t<120;t++){const x=R(140,W-140),y=R(140,H-140);if(!okPlace(x,y,120,460))continue;
    mkD(x,y,R(110,150),R(65,90),R(0,3.14),R(-.4,.4),R(20,24),false,uname());break;}
  if(r()<(th.works||.45))for(let t=0;t<120;t++){const x=R(110,W-110),y=R(110,H-110);if(!okPlace(x,y,90,300))continue;
    mkD(x,y,R(70,110),R(50,75),R(0,3.14),R(-.4,.4),R(26,32),false,uname()+' Works',{kind:'industrial',works:true});break;}
  for(let k=RI(1,3);k>0;k--)for(let t=0;t<120;t++){const x=R(80,W-80),y=R(80,H-80);if(!okPlace(x,y,40,240))continue;
    mkD(x,y,R(22,32),R(18,26),R(0,3.14),R(0,3.14),R(12,14),true,uname()+' Farm',{farm:true});break;}
  for(let k=RI(...th.villages);k>0;k--)for(let t=0;t<120;t++){const x=R(80,W-80),y=R(80,H-80);if(!okPlace(x,y,60,280))continue;
    const a=R(0,3.14);mkD(x,y,R(38,60),R(30,46),a,a,R(13,16),true,uname());break;}
  M.D=D;
  const urb=new Uint8Array(N),inD=(d,x,y)=>inPoly(d.poly,x,y)&&!water(x,y)&&(!wet||(side(x,y)===d.side&&bank(x,y)>5));
  for(const d of D){const b=d.bb;for(let j=Math.max(0,Math.floor(b.y0/C));j<=Math.min(GH-1,Math.floor(b.y1/C));j++)
    for(let i=Math.max(0,Math.floor(b.x0/C));i<=Math.min(GW-1,Math.floor(b.x1/C));i++)if(inD(d,i*C+4,j*C+4))urb[j*GW+i]=d.village?2:1;}
  M.streets=[];
  for(const d of D){const ext=Math.max(d.bb.w,d.bb.h)*.75;
    for(const ang of [d.rot,d.rot+Math.PI/2]){const dx=Math.cos(ang),dy=Math.sin(ang),px=-dy,py=dx;
      for(let o=-ext;o<=ext;o+=d.sp){const oo=o+R(-2.5,2.5);let run=[];
        for(let t=-ext;t<=ext;t+=5){const x=d.cx+dx*t+px*oo,y=d.cy+dy*t+py*oo;
          if(x>=d.bb.x0&&x<=d.bb.x1&&y>=d.bb.y0&&y<=d.bb.y1&&inD(d,x,y))run.push({x,y});else{if(run.length>2)M.streets.push(run);run=[];}}
        if(run.length>2)M.streets.push(run);}}}

  // roads, rasterised as they're added (the same rules as the legacy generator: road over water is a bridge deck, chains
  // kept 4-connected, highways two cells wide, the nearest drawn point kept per cell)
  M.roads=[];const rid=new Int16Array(N).fill(-1),rpx=new Float32Array(N),rpy=new Float32Array(N),rpd=new Float32Array(N).fill(1e9);
  const setRoad=(i,x,y,kind,id)=>{const c=cc(i);if(water(c.x,c.y))M.road[i]=3;else if(M.road[i]!==3)M.road[i]=Math.max(M.road[i],kind);
    rid[i]=id;const d=Math.hypot(c.x-x,c.y-y);if(d<rpd[i]){rpd[i]=d;rpx[i]=x;rpy[i]=y;}};
  const addRoad=(pts,kind)=>{const id=M.roads.length;M.roads.push({pts,kind});let prev=-1;
    walk(pts,(i,x,y,ux,uy)=>{
      if(prev>=0&&prev!==i&&prev%GW!==i%GW&&(prev/GW|0)!==(i/GW|0))setRoad((i/GW|0)*GW+prev%GW,x,y,kind,id);
      setRoad(i,x,y,kind,id);prev=i;
      if(kind===2)for(const o of [-5,5]){const qx=x-uy*o,qy=y+ux*o;if(qx>=0&&qy>=0&&qx<W&&qy<H)setRoad(cellOf(qx,qy),x,y,kind,id);}});
    return id;};
  const roadNear=(x,y,rad)=>{const cx=Math.floor(x/C),cy=Math.floor(y/C);for(let dy=-rad;dy<=rad;dy++)for(let dx=-rad;dx<=rad;dx++){
    const nx=cx+dx,ny=cy+dy;if(nx>=0&&ny>=0&&nx<GW&&ny<GH&&M.road[ny*GW+nx])return true;}return false;};
  const rcost=new Float32Array(N);
  for(let i=0;i<N;i++){const c=cc(i);if(water(c.x,c.y)){rcost[i]=Infinity;continue;}
    let k=(1+slope[i]/smax*3)*(.7+.6*noise(c.x/90+31,c.y/90+17));if(wet&&bank(c.x,c.y)<28)k+=3;if(sm[i])k+=4;if(urb[i]===1)k+=6;
    if(th.rockH&&M.hgt[i]>th.rockH)k+=8;if(lakes.length&&lakeF(c.x,c.y)>-.25)k+=3;
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
  const commit=(path,start,kind=1)=>{let run=[],a=-1;
    const fin=b=>{if(run.length>=2||(a>=0&&b>=0)){const P=[];
        if(a>=0)P.push({x:rpx[a],y:rpy[a]});else if(start)P.push(start);
        for(let k=0;k<run.length;k++)if((k%4===0&&!(k===0&&a<0&&start))||k===run.length-1)P.push(cc(run[k]));
        if(b>=0)P.push({x:rpx[b],y:rpy[b]});
        if(P.length>=2)addRoad(catmull(P,6),kind);}
      run=[];};
    for(const c of path){if(M.road[c]){if(run.length)fin(c);a=c;}else run.push(c);}
    if(run.length)fin(-1);};
  // highways prefer gentle ground; every road eases through towns along their streets
  const flat=j=>1+slope[j]/smax*2,thruTown=j=>urb[j]===1?.25:1;
  const edgeCell=(x,top)=>cellOf(clamp(x,40,W-40),top?6:H-6);

  // crossings: 1-5 bridges at narrow reaches, unevenly spread; a bridge through the main town when it's on the river; a
  // causeway over Lake Narrows' lake
  const xings=[];
  const addX=(x,kind,cause)=>{const y=RYF(x),h=RWF(x)/2,ap=cause?40:30;
    const pts=catmull([{x:x+R(-50,50),y:clamp(y+h+R(120,220),40,H-40)},{x:x+R(-5,5),y:y+h+ap},{x:x+R(-5,5),y:y-h-ap},{x:x+R(-50,50),y:clamp(y-h-R(120,220),40,H-40)}]);
    const id=addRoad(pts,kind);xings.push({x,id,pts,kind,cause});};
  if(wet){if(townX!==null)addX(townX+R(-25,25),2,false);
    if(bigLake)addX(bigLake.x+R(-50,50),2,true);
    const want=RI(...th.cross);
    for(let t=0;t<500&&xings.length<want;t++){const x=R(80,W-80),w=RWF(x);
      if(w>PONTOON.maxLen*.8||xings.some(c=>Math.abs(c.x-x)<170)||lakeF(x,RYF(x))>-.7)continue;
      if(r()>Math.exp(-(w-w0)/22))continue;
      addX(x,xings.length&&r()>(th.city?.6:.25)?1:2,false);}
    if(!xings.length)addX(W*R(.2,.8),2,false);}

  // depots on the top and bottom edges, anywhere along them, clear of lakes
  // (the whole area the side's units start in, about 300 px wide and 260 deep, must be clear of lakes)
  const depX=top=>{const clear=x=>{for(let dx=-150;dx<=150;dx+=30)for(let dy=30;dy<=270;dy+=30){const y=top?dy:H-dy;if(lakeF(x+dx,y)>-.35)return false;}return true;};
    for(let t=0;t<80;t++){const x=W*R(.12,.88);if(clear(x))return x;}return W/2;};
  const dAx=depX(false),dDx=depX(true);
  const toRoad=(src,goalFn,dst,startPt,kind,mod)=>{const p=cheapest(src,goalFn,dst,mod);if(p)commit(p,startPt,kind);return !!p;};
  // the arterial bridge: the town's when the town is on the river, otherwise the main bridge nearest the depots
  const art=!xings.length?null:townX!==null?xings[0]:xings.reduce((b,c)=>c.kind===2&&(!b||Math.abs(c.x-dAx)+Math.abs(c.x-dDx)<Math.abs(b.x-dAx)+Math.abs(b.x-dDx))?c:b,null)||xings[0];
  const coreCell=cellOf(core.cx,core.cy),coreGoal=i=>urb[i]===1&&Math.hypot(cc(i).x-core.cx,cc(i).y-core.cy)<90;
  if(wet){
    // the arterial: from each depot to the main town if it's on that side, and on to the arterial bridge
    const cs=side(core.cx,core.cy);
    for(const top of [false,true]){const sd=top?-1:1,src=edgeCell(top?dDx:dAx,top),st={x:top?dDx:dAx,y:top?-40:H+40};
      if(cs===sd&&tStyle!=='river'){toRoad(src,coreGoal,coreCell,st,2,j=>flat(j)*thruTown(j));
        toRoad(coreCell,i=>rid[i]===art.id,cellOf(art.x,RYF(art.x)+sd*120),{x:core.cx,y:core.cy},2,j=>flat(j)*thruTown(j));}
      else toRoad(src,i=>rid[i]===art.id,cellOf(art.x,RYF(art.x)+sd*120),st,2,flat);}
    // a second arterial from another point on an edge to another bridge
    if(xings.length>1&&r()<(th.city?1:.6)){const o=xings.filter(c=>c!==art)[r()*(xings.length-1)|0],top=r()<.5,x=W*R(.1,.9);
      toRoad(edgeCell(x,top),i=>rid[i]===o.id,cellOf(o.x,RYF(o.x)+(top?-120:120)),{x,y:top?-40:H+40},2,flat);}}
  else{
    // dry: the arterial runs edge to edge; the main town hangs off it
    {const tg=edgeCell(dDx,true);toRoad(edgeCell(dAx,false),i=>i===tg,tg,{x:dAx,y:H+40},2,j=>flat(j)*thruTown(j));}
    if(r()<.7){const x=W*R(.1,.9),tg=edgeCell(W*R(.1,.9),true);toRoad(edgeCell(x,false),i=>i===tg,tg,{x,y:H+40},2,flat);}
    // a lateral road along the front line, so the roads that cross it meet at crossroads
    const P=[];for(let k=0;k<=9;k++){const x=-40+(W+80)*k/9;P.push({x,y:RYF(clamp(x,0,W))+R(-35,35)});}M.roads[addRoad(catmull(P),1)].lat=true;}
  // a lateral highway across one side of the map, through whatever towns lie near it
  if(r()<(th.lateral??.55)){const sd=r()<.5?-1:1,yL=x=>clamp(RYF(x)+sd*R(260,520),60,H-60),xa=yL(0),xb=yL(W);
    toRoad(cellOf(6,xa),i=>i%GW>=GW-2,cellOf(W-6,xb),{x:-40,y:xa},2,j=>flat(j)*thruTown(j)*(wet&&bank(cc(j).x,cc(j).y)<120?3:1));}
  // every bridge's two ends join the network
  // (a bridge road's own cells cost full price here, so each end finds its own way in instead of doubling back over the bridge)
  for(const c of xings)for(const e of [c.pts[0],c.pts[c.pts.length-1]])toRoad(cellOf(e.x,e.y),i=>M.road[i]>0&&rid[i]!==c.id,-1,null,1,j=>rid[j]===c.id?40:1);
  // towns, works and farms not on a road get one; villages link to their nearest neighbours on the same side
  for(const d of D){if(d.village&&!d.farm)continue;if(!roadNear(d.cx,d.cy,4))toRoad(cellOf(d.cx,d.cy),i=>M.road[i]>0,-1,{x:d.cx,y:d.cy},1,j=>urb[j]===1?.2:1);}
  const vs=D.filter(d=>d.village&&!d.farm),pairs=new Set();
  for(const v of vs){const near=vs.filter(w=>w!==v&&w.side===v.side).map(w=>({w,d:Math.hypot(w.cx-v.cx,w.cy-v.cy)})).filter(o=>o.d<700).sort((a,b)=>a.d-b.d).slice(0,2);
    for(const {w} of near){const key=[D.indexOf(v),D.indexOf(w)].sort((a,b)=>a-b).join();if(pairs.has(key))continue;pairs.add(key);
      const b=cellOf(w.cx,w.cy);toRoad(cellOf(v.cx,v.cy),i=>i===b,b,{x:v.cx,y:v.cy},1);}}
  for(const v of vs)if(!roadNear(v.cx,v.cy,3))toRoad(cellOf(v.cx,v.cy),i=>M.road[i]>0,-1,{x:v.cx,y:v.cy},1);
  // roads in from the map edges
  for(let t=0,n=0,want=RI(3,7);t<40&&n<want;t++){const e=r()*4|0;
    const p=e===0?{x:R(60,W-60),y:4}:e===1?{x:R(60,W-60),y:H-4}:e===2?{x:4,y:R(60,H-60)}:{x:W-4,y:R(60,H-60)};
    if((wet&&bank(p.x,p.y)<60)||lakeAt(p.x,p.y)||roadNear(p.x,p.y,18))continue;const pth=cheapest(cellOf(p.x,p.y),i=>M.road[i]>0,-1);if(!pth||pth.length>120)continue;
    commit(pth,{x:e===2?-20:e===3?W+20:p.x,y:e===0?-20:e===1?H+20:p.y});n++;}

  // land use: forests on noise at this map's scale, on slopes and around 2-5 random centres; fields around villages and
  // towns and in random farm regions; each takes a share of the land rolled from the theme
  const fAt=[],pAt=[];for(let k=RI(2,5);k>0;k--)fAt.push({x:R(-100,W+100),y:R(-100,H+100),s:R(140,360),a:R(.18,.42)});
  for(let k=RI(1,3);k>0;k--)pAt.push({x:R(0,W),y:R(0,H),s:R(200,420),a:R(.15,.3)});
  const sett=D.map(d=>({cx:d.cx,cy:d.cy,w:d.village?1:1.6}));
  const pull=(L,x,y)=>{let s=0;for(const a of L)s+=a.a*Math.exp(-((x-a.x)**2+(y-a.y)**2)/(a.s*a.s));return s;};
  const fsc2=(x,y,sl,h)=>fbm(x/(S*.85)+40,y/(S*.85)+9,4)+.3*sl+.2*h+pull(fAt,x,y);
  const psc2=(x,y,sl,vp)=>fbm(x/(S*.7)+70,y/(S*.7)+3,3)+.35*(1-Math.min(1,sl*1.5))+.3*vp+pull(pAt,x,y);
  const dU=gridDist(i=>urb[i]>0,8);
  let land=0;for(let i=0;i<N;i++){const c=cc(i);if(!water(c.x,c.y))land++;}
  const pickT=(score,frac)=>{const v=score.filter(s=>s>-9).sort();return v.length?v[Math.max(0,v.length-Math.min(v.length,Math.floor(land*frac)))]:9;};
  const fsc=new Float32Array(N).fill(-9);
  for(let i=0;i<N;i++){const c=cc(i),b=wet?bank(c.x,c.y):99;if(b<6||urb[i]||dU[i]<=2||water(c.x,c.y))continue;fsc[i]=fsc2(c.x,c.y,slope[i]/smax,M.hgt[i]);}
  const ft=pickT(fsc,R(...th.forest));for(let i=0;i<N;i++)if(fsc[i]>=ft)M.lu[i]=2;
  for(const comp of components(i=>M.lu[i]===2))if(comp.length<24)for(const i of comp)M.lu[i]=0;
  const dF=gridDist(i=>M.lu[i]===2,4),psc=new Float32Array(N).fill(-9);
  for(let i=0;i<N;i++){const c=cc(i),b=wet?bank(c.x,c.y):99;if(b<6||urb[i]||dU[i]<=1||dF[i]<=2||water(c.x,c.y))continue;
    let vp=0;for(const v of sett)vp+=v.w*Math.exp(-((c.x-v.cx)**2+(c.y-v.cy)**2)/(230*230));psc[i]=psc2(c.x,c.y,slope[i]/smax,vp);}
  const pt=pickT(psc,R(...th.field));for(let i=0;i<N;i++)if(psc[i]>=pt)M.lu[i]=1;
  for(const comp of components(i=>M.lu[i]===1))if(comp.length<24)for(const i of comp)M.lu[i]=0;
  for(const comp of components(i=>M.lu[i]===1)){if(comp.length<150)continue;
    for(let k=0;k<(comp.length>420?2:1);k++){const s=comp[r()*comp.length|0],c=cc(s);if(roadNear(c.x,c.y,5))continue;
      const p=cheapest(s,i=>M.road[i]>0,-1,i=>M.lu[i]===1?.5:1.4);if(p&&p.length<60)commit(p,c);}}
  if(th.rockH){for(let i=0;i<N;i++)if(M.hgt[i]>th.rockH&&!urb[i]&&!M.road[i])M.lu[i]=3;
    for(const comp of components(i=>M.lu[i]===3))if(comp.length<24)for(const i of comp)M.lu[i]=0;}
  for(const s of M.streets)walk(s,(i,x,y)=>{if(M.road[i]!==3)M.road[i]=Math.max(M.road[i],1);if(rpd[i]>=1e9){rpd[i]=Math.hypot(cc(i).x-x,cc(i).y-y);rpx[i]=x;rpy[i]=y;}});

  // terrain classes, in priority order, as in the legacy generator
  for(let i=0;i<N;i++){M.cls[i]=M.lu[i]===1?FIELD:M.lu[i]===2?FOREST:M.lu[i]===3?ROCK:OPEN;if(urb[i])M.cls[i]=URBAN;}
  M.streams.forEach(p=>walk(p,i=>{M.cls[i]=STREAM;}));
  {const add=[];for(let i=0;i<N;i++){if(M.cls[i]!==STREAM||!M.road[i])continue;const x=i%GW;
    for(const j of [x>0?i-1:-1,x<GW-1?i+1:-1,i-GW,i+GW])if(j>=0&&j<N&&M.cls[j]===STREAM&&!M.road[j])add.push([j,M.road[i]]);}
    for(const [j,rr] of add)if(!M.road[j])M.road[j]=Math.min(rr,2);}
  M.lakes=lakes.length?new Uint8Array(N):null;
  for(let i=0;i<N;i++){const c=cc(i);if(water(c.x,c.y)){M.cls[i]=WATER;if(M.lakes&&!band(c.x,c.y))M.lakes[i]=1;}}

  // where roads cross the front line: bridge symbols on a river map, crossroads candidates on a dry one
  M.bridges=[];const lineX=[];
  for(const rd of M.roads){if(rd.lat)continue;const p=rd.pts;for(let k=0;k<p.length-1;k++){const a=p[k],b=p[k+1];
    if(a.x<0||a.x>W||b.x<0||b.x>W||a.y<0||b.y<0||a.y>H||b.y>H)continue;
    if(side(a.x,a.y)!==side(b.x,b.y)){const x=(a.x+b.x)/2;if(lineX.some(q=>Math.hypot(q.x-x,q.y-RYF(x))<30))continue;
      const q={x,y:RYF(x),ang:Math.atan2(b.y-a.y,b.x-a.x),kind:rd.kind,len:RWF(x)};lineX.push(q);if(wet)M.bridges.push(q);}}}
  // contours
  M.contours=[];const Hh=(i,j)=>M.hgt[j*GW+i];
  for(const lv of [.5,.6,.7,.8,.9])for(let j=0;j<GH-1;j++)for(let i=0;i<GW-1;i++){if(M.cls[j*GW+i]===WATER)continue;
    const a=Hh(i,j),b=Hh(i+1,j),c=Hh(i+1,j+1),d=Hh(i,j+1),x0=i*C+4,y0=j*C+4,q=[];
    const e=(p,s,x1,y1,x2,y2)=>{if((p<lv)!==(s<lv)){const t=(lv-p)/(s-p);q.push(x1+(x2-x1)*t,y1+(y2-y1)*t);}};
    e(a,b,x0,y0,x0+C,y0);e(b,c,x0+C,y0,x0+C,y0+C);e(d,c,x0,y0+C,x0+C,y0+C);e(a,d,x0,y0,x0,y0+C);
    if(q.length>=4)M.contours.push([q[0],q[1],q[2],q[3],lv]);if(q.length===8)M.contours.push([q[4],q[5],q[6],q[7],lv]);}

  // objectives. A: one of the crossings anywhere along the front (a bridge, the causeway, or on a dry map a crossroads),
  // weighted toward the busier ones. B and C: features behind the line, picked by kind (towns, villages, the works,
  // farms, stations, crossroads, hills, ridges, woods) and spread out, so they aren't a column in the middle.
  const named=(x,y,rad)=>{let b=null,bd=rad;for(const d of D){const dd=Math.hypot(d.cx-x,d.cy-y);if(d.name&&dd<bd){bd=dd;b=d.name.replace(/ (Works|Farm)$/,'');}}return b;};
  const solid=(x,y)=>{const i=cellOf(x,y);return M.cls[i]!==WATER&&M.cls[i]!==ROCK;};
  const north=(x,y)=>x>90&&x<W-90&&y>=330&&y<RYF(x)-RWF(x)/2-90&&solid(x,y);
  const wpick=L=>{const s=L.reduce((a,c)=>a+c.w,0);let t=r()*s;for(const c of L){t-=c.w;if(t<=0)return c;}return L[L.length-1];};
  const aC=lineX.filter(q=>q.x>90&&q.x<W-90).map(q=>{const cause=wet&&q.len>110,nm=named(q.x,q.y,320);
    return{x:q.x,y:q.y,kind:wet?'bridge':'crossroads',w:(q.kind===2?3:1)*(cause?1.5:1),
      name:wet?(cause?(bigLake?'Lake '+M.riverName:M.riverName)+' Causeway':(nm||M.riverName)+' Bridge'):(nm||uname())+' Crossroads'};});
  if(!aC.length){const x=art?art.x:W/2;aC.push({x,y:RYF(x),kind:wet?'bridge':'crossroads',w:1,name:wet?M.riverName+' Bridge':uname()+' Crossroads'});}
  const A=wpick(aC);
  const cand=[];
  for(const d of D){if(!d.name||!north(d.cx,d.cy))continue;const onHwy=!d.farm&&d.village&&(()=>{const cx=Math.floor(d.cx/C),cy=Math.floor(d.cy/C);for(let dy=-6;dy<=6;dy++)for(let dx=-6;dx<=6;dx++){const nx=cx+dx,ny=cy+dy;if(nx>=0&&ny>=0&&nx<GW&&ny<GH&&M.road[ny*GW+nx]===2)return true;}return false;})();
    if(d.works)cand.push({x:d.cx,y:d.cy,kind:'works',name:d.name,b:3,c:1});
    else if(d.farm)cand.push({x:d.cx,y:d.cy,kind:'farm',name:d.name,b:1.5,c:1.5});
    else if(d.village){const st=onHwy&&r()<.5;cand.push({x:d.cx,y:d.cy,kind:st?'station':'village',name:st?d.name+' Station':d.name,b:2.5,c:1.5});}
    else cand.push({x:d.cx,y:d.cy,kind:'town',name:d.name,b:d===core?5:3.5,c:1});}
  for(const h of hills){let bx=h.x,by=h.y,bh=-1;for(let dy=-80;dy<=80;dy+=8)for(let dx=-80;dx<=80;dx+=8){const x=h.x+dx,y=h.y+dy;if(x<0||y<0||x>=W||y>=H)continue;const v=M.hgt[cellOf(x,y)];if(v>bh&&solid(x,y)){bh=v;bx=x;by=y;}}
    if(!north(bx,by)||urb[cellOf(bx,by)])continue;const e=M.elev(bh);
    cand.push({x:bx,y:by,kind:'hill',name:h.big&&r()<.5?uname()+' Heights':(r()<.6?'Hill ':'Point ')+e,b:1.2,c:3});}
  if(esc&&esc.sd<0)for(let k=0;k<2;k++){const x=W*R(.15,.85),y=escY(x)-esc.w*1.5;if(north(x,y)&&!urb[cellOf(x,y)])cand.push({x,y,kind:'ridge',name:uname()+' Ridge',b:1,c:2.5});}
  for(const comp of components(i=>M.lu[i]===2)){if(comp.length<70)continue;let sx=0,sy=0;for(const i of comp){const c=cc(i);sx+=c.x;sy+=c.y;}const x=sx/comp.length,y=sy/comp.length;
    if(M.lu[cellOf(x,y)]===2&&north(x,y))cand.push({x,y,kind:'wood',name:uname()+' Wood',b:1,c:2});}
  {const js=[];for(let i=0;i<N;i++){if(rid[i]<0||urb[i])continue;const x=i%GW;let j2=false;
      for(const j of [x>0?i-1:-1,x<GW-1?i+1:-1,i-GW,i+GW])if(j>=0&&j<N&&rid[j]>=0&&rid[j]!==rid[i])j2=true;
      if(!j2)continue;const c=cc(i);if(north(c.x,c.y)&&!js.some(q=>Math.hypot(q.x-c.x,q.y-c.y)<160))js.push(c);}
    for(const c of js)cand.push({x:c.x,y:c.y,kind:'crossroads',name:(named(c.x,c.y,260)||uname())+' Crossroads',b:1.5,c:1.5});}
  const okD=(p,q,d)=>Math.hypot(p.x-q.x,p.y-q.y)>=d;
  let Bo=null,Co=null;
  // pick a kind of feature first (by weight, among the kinds on offer), then one of that kind, so the many crossroads
  // and villages don't crowd out the rest; the main town is the likeliest town
  const KB={town:4,village:3,works:2,station:1.5,farm:1.2,crossroads:1.2,hill:1,ridge:1,wood:.8},KC={hill:3,ridge:2.5,wood:2,village:1.5,crossroads:1.2,farm:1.2,station:1,works:1,town:1};
  const byKind=(L,K)=>{const kinds=[...new Set(L.map(c=>c.kind))].map(k=>({k,w:K[k]||1}));if(!kinds.length)return null;const k=wpick(kinds).k,M2=L.filter(c=>c.kind===k);return wpick(M2.map(c=>({...c,w:c.b>4?3:1})));};
  Bo=byKind(cand.filter(c=>okD(c,A,230)&&Math.hypot(c.x-A.x,c.y-A.y)<1300&&c.y>=350),KB);
  if(Bo)Co=byKind(cand.filter(c=>c.name!==Bo.name&&okD(c,A,230)&&okD(c,Bo,260)&&Math.hypot(c.x-A.x,c.y-A.y)<1400&&Math.hypot(c.x-Bo.x,c.y-Bo.y)<1300),KC);
  M.objs=[{key:'A',name:A.name,kind:A.kind,x:A.x,y:A.y},Bo?{key:'B',name:Bo.name,kind:Bo.kind,x:Bo.x,y:Bo.y}:null,Co?{key:'C',name:Co.name,kind:Co.kind,x:Co.x,y:Co.y}:null];

  // depots where the arterials meet the map edges
  M.depA={x:clamp(dAx,30,W-30),y:H-26};M.depD={x:clamp(dDx,30,W-30),y:26};
  // the other crossings, nearest first, are the attacker's flanking axes
  const vias=lineX.filter(q=>Math.abs(q.x-A.x)>60).sort((a,b)=>Math.abs(a.x-A.x)-Math.abs(b.x-A.x)).slice(0,3).map(q=>({x:q.x,y:RYF(q.x)-RWF(q.x)/2-55}));
  M.vias=vias;M.viaW=vias.filter(v=>v.x<A.x)[0]||null;M.viaE=vias.filter(v=>v.x>A.x)[0]||null;
  // the water's name, where the river runs clear of bridges and towns (or out on the lake)
  M.waterLabel=!wet?null:bigLake?'Lake '+M.riverName:'R. '+M.riverName;
  {let bx=W*.1,bs=-1;for(let k=0;k<24;k++){const x=W*(.06+.88*k/23),s=Math.min(...lineX.map(q=>Math.abs(q.x-x)),...D.map(d=>Math.hypot(d.cx-x,d.cy-RYF(x))),400);if(s>bs){bs=s;bx=x;}}
    M.waterAt=bigLake?bigLake.x+(bigLake.x<W/2?1:-1)*120:bx;}
  // bridge spans, as in the legacy generator
  const spans=new Map();
  for(const cells of components(i=>M.road[i]===3)){const c=cc(cells[cells.length>>1]);let sym=null,sd=30;
    for(const q of M.bridges){const d=Math.hypot(q.x-c.x,q.y-c.y);if(d<sd){sd=d;sym=q;}}
    if(!sym)continue;if(spans.has(sym))spans.get(sym).cells.push(...cells);else spans.set(sym,{sym,cells});}
  M.spans=[...spans.values()];M.road0=M.road.slice();
  M.rpx=rpx;M.rpy=rpy;M.rpOk=Uint8Array.from(rpd,d=>d<1e9?1:0);
  // what the scenery ring needs to carry this landscape past the border
  M.gen={v2:{height:hRaw,lakeAt,fsc:fsc2,psc:psc2,rockH:th.rockH||0},fbm,noise,mp,hmin,hmax,ft,pt,smax,villages:sett.map(v=>({cx:v.cx,cy:v.cy})),bx:core.cx,by:core.cy};

  // self-check: three objectives with room behind B, a bridge on a river map, depots on roads, and every objective
  // reachable by infantry and armor from both depots
  const passT=(t,i)=>M.road[i]>0||MOVE[t][M.cls[i]]>0;
  const reach=(t,p)=>{const s=new Uint8Array(N),q=new Int32Array(N);let h=0,tl=0,st=-1;const c0=cellOf(p.x,p.y),cx=c0%GW,cy=c0/GW|0;
    for(let rr=0;rr<12&&st<0;rr++)for(let dy=-rr;dy<=rr&&st<0;dy++)for(let dx=-rr;dx<=rr;dx++){const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=GW||ny>=GH)continue;const j=ny*GW+nx;if(passT(t,j)){st=j;break;}}
    if(st<0)return s;s[st]=1;q[tl++]=st;
    while(h<tl){const i=q[h++],x=i%GW;for(const j of [x>0?i-1:-1,x<GW-1?i+1:-1,i-GW,i+GW])if(j>=0&&j<N&&!s[j]&&passT(t,j)){s[j]=1;q[tl++]=j;}}
    return s;};
  const hit=(s,o)=>{const c0=cellOf(o.x,o.y),cx=c0%GW,cy=c0/GW|0;for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const nx=cx+dx,ny=cy+dy;if(nx>=0&&ny>=0&&nx<GW&&ny<GH&&s[ny*GW+nx])return true;}return false;};
  let ok=!!(Bo&&Co)&&(!wet||M.spans.length>0)&&roadNear(M.depA.x,M.depA.y,12)&&roadNear(M.depD.x,M.depD.y,12)&&!water(M.depA.x,M.depA.y-40)&&!water(M.depD.x,M.depD.y+40);
  if(ok)for(const t of ['inf','tank']){for(const dp of [M.depA,M.depD]){const s=reach(t,dp);if(!M.objs.every(o=>hit(s,o))){ok=false;break;}}if(!ok)break;}
  if(!M.objs[1])M.objs[1]={key:'B',name:M.townName,kind:'town',x:core.cx,y:Math.min(core.cy,RYF(core.cx)-120)};
  if(!M.objs[2])M.objs[2]={key:'C',name:'Hill '+M.elev(.5),kind:'hill',x:clamp(M.objs[1].x+300,90,W-90),y:clamp(M.objs[1].y-200,60,H)};
  M.ok=ok;M.tries=att+1;
  return M;}
// the generator a game uses: the new one unless the New map generation switch is off
const makeMap=(seed,mode,gen2)=>gen2?genMap2(seed,mode):genMap(seed,mode);

