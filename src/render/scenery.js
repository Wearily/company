// COMPANY · src/render/scenery.js
// The scenery ring past the border: generated and drawn for display only, never part of the battle.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
// Terrain past the border, so the battlefield sits inside a wider landscape. It is scenery only: nothing can move,
// fire or be ordered there. It's generated from the battlefield's own noise functions and formulas (kept in M.gen)
// with a separate random stream, never the battlefield's, so the battlefield itself is untouched. Anchored to the same
// world coordinates, the river, roads, hills, forests and farm regions carry straight across the border.
const OUT={mx:896,my:600,ts:.5};
const oc=document.createElement('canvas');
function genOuter(){if(M.outer)return M.outer;
  const g=M.gen,mp=g.mp,x0=-OUT.mx,y0=-OUT.my,gw=(W+2*OUT.mx)/C,gh=(H+2*OUT.my)/C,n=gw*gh,X1=x0+gw*C,Y1=y0+gh*C;
  const r=rng(M.seed*977+31),R=(a,b)=>a+(b-a)*r(),inMap=(x,y)=>x>=0&&x<W&&y>=0&&y<H,near=(x,y,m)=>x>-m&&x<W+m&&y>-m&&y<H+m;
  const cellO=(x,y)=>clamp(Math.floor((y-y0)/C),0,gh-1)*gw+clamp(Math.floor((x-x0)/C),0,gw-1);
  // a new-generation map (M.gen.v2) is continuous already: its own river, height, land-use and lake functions carry on
  const v2=g.v2;
  // the river runs on past both edges with the battlefield's meander formula, slope cap and smoothing, starting from
  // its edge values so it joins without a kink
  const rvRaw=x=>g.ry0+(g.fbm(x/900+g.ro,g.ro*.7,3)-.5)*520+(g.fbm(x/240+g.ro*2,7.1,2)-.5)*120;
  const rwRaw=x=>{if(!mp.wet)return 0;let w=mp.rw[0]+g.fbm(x/260+g.ro,4.2,2)*mp.rw[1];for(const b of g.bumps)w+=b.a*Math.exp(-(((x-b.x)/b.s)**2));return w;};
  const extend=dir=>{const e0=M.ry(dir>0?W:0),a=[];let prev=e0;for(let k=1;k*10<=OUT.mx+60;k++){prev=clamp(rvRaw(dir>0?W+k*10:-k*10),prev-7,prev+7);a.push(prev);}
    for(let p=0;p<3;p++)for(let i=0;i<a.length-1;i++)a[i]=((i?a[i-1]:e0)+2*a[i]+a[i+1])/4;
    return{e0,a:a.map(v=>clamp(v,H*.34,H*.64))};};
  const RE=v2?null:extend(1),RWs=v2?null:extend(-1);
  const ry=v2?M.ry:x=>{if(x>=0&&x<=W)return M.ry(x);const s=x>W?RE:RWs,f=(x>W?x-W:-x)/10-1,i=clamp(Math.floor(f),-1,s.a.length-2),t=clamp(f-i,0,1),v0=i<0?s.e0:s.a[i];return v0+(s.a[i+1]-v0)*t;};
  const rw=v2?M.rw:x=>x>=0&&x<=W?M.rw(x):rwRaw(x),band=mp.wet?(x,y)=>Math.abs(y-ry(x))<rw(x)/2:()=>false,water=v2?(x,y)=>band(x,y)||v2.lakeAt(x,y):band,bank=(x,y)=>Math.abs(y-ry(x))-rw(x)/2;
  const hgt=new Float32Array(n),cls=new Uint8Array(n),lu=new Uint8Array(n),road=new Uint8Array(n),urb=new Uint8Array(n),own=new Uint8Array(n),lakes=v2&&M.lakes?new Uint8Array(n):null;
  // cells inside the battlefield are copied from it; the rest take the battlefield's height formula (valley, noise,
  // hills, ridges), normalised with its range
  for(let j=0;j<gh;j++)for(let i=0;i<gw;i++){const k=j*gw+i,x=x0+i*C+4,y=y0+j*C+4;
    if(inMap(x,y)){const c=cellOf(x,y);own[k]=1;hgt[k]=M.hgt[c];lu[k]=M.lu[c];cls[k]=M.cls[c];road[k]=M.road0[c];urb[k]=M.cls[c]===URBAN?1:0;if(lakes)lakes[k]=M.lakes[c];continue;}
    if(v2){hgt[k]=clamp((v2.height(x,y)-g.hmin)/(g.hmax-g.hmin),0,1.15);continue;}
    let h=(1-mp.valley)*g.fbm(x/430+11,y/430+5,4)+mp.valley*Math.min(1,Math.max(0,bank(x,y))/450)**.8;
    for(const q of g.hills)h+=q.a*Math.exp(-((x-q.x)**2+(y-q.y)**2)/(q.s*q.s));
    for(const q of g.ridges)h+=q.a*Math.exp(-(((x-q.x)/q.s)**2))*(.7+.6*g.fbm(x/170+q.k,y/170,3));
    hgt[k]=clamp((h-g.hmin)/(g.hmax-g.hmin),0,1.15);}
  // roads that run out of the battlefield carry on outward, wandering gently and bending away from the border so they
  // never come back in
  const roads=[],away=(x,y)=>{if(!inMap(x,y))return Math.atan2(y-clamp(y,0,H),x-clamp(x,0,W));const m=Math.min(x,W-x,y,H-y);return m===x?Math.PI:m===W-x?0:m===y?-Math.PI/2:Math.PI/2;};
  for(const rd of M.roads){const p=rd.pts;if(p.length<2)continue;
    for(const back of [false,true]){const q=back?[...p].reverse():p,e=q[q.length-1];if(e.x>18&&e.x<W-18&&e.y>18&&e.y<H-18)continue;
      let k=q.length-1;while(k>0&&dist(q[k],e)<40)k--;if(k===q.length-1)continue;
      let ang=Math.atan2(e.y-q[k].y,e.x-q[k].x),x=e.x,y=e.y;const pts=[{x,y}],turn=rd.kind===2?.05:.1;
      for(let s=0;s<700;s++){ang+=(g.noise(x/260+rd.kind*13.1,y/260+3.7)-.5)*turn;
        if(near(x+Math.cos(ang)*40,y+Math.sin(ang)*40,6)){const d=away(x,y)-ang;ang+=clamp(Math.atan2(Math.sin(d),Math.cos(d)),-.25,.25);}
        x+=Math.cos(ang)*10;y+=Math.sin(ang)*10;pts.push({x,y});if(x<x0-30||x>X1+30||y<y0-30||y>Y1+30)break;}
      roads.push({pts,kind:rd.kind});}}
  // a small town on most highways a few hundred metres out, villages along the other roads and a few off them
  const vil=[],okV=(x,y,rad)=>x>x0+rad&&x<X1-rad&&y>y0+rad&&y<Y1-rad&&!near(x,y,rad+40)&&(!mp.wet||bank(x,y)>rad+60)&&!vil.some(v=>Math.hypot(v.x-x,v.y-y)<300)&&!M.D.some(d=>Math.hypot(d.cx-x,d.cy-y)<300);
  for(const rd of roads){if(rd.kind!==2)continue;const k=Math.min(rd.pts.length-2,R(30,55)|0);if(k<1)continue;const p=rd.pts[k],a=Math.atan2(rd.pts[k+1].y-p.y,rd.pts[k+1].x-p.x);
    if(r()<.75&&okV(p.x,p.y,140))vil.push({x:p.x,y:p.y,a,town:true});}
  const cand=[];for(const rd of roads)for(let k=4;k<rd.pts.length-1;k+=4)cand.push({p:rd.pts[k],a:Math.atan2(rd.pts[k+1].y-rd.pts[k].y,rd.pts[k+1].x-rd.pts[k].x)});
  const want=vil.length+Math.round(mp.villages*1.6);
  for(let t=0;t<500&&vil.length<want;t++){if(cand.length&&r()<.7){const c=cand[r()*cand.length|0],o=R(-14,14);const x=c.p.x-Math.sin(c.a)*o,y=c.p.y+Math.cos(c.a)*o;if(okV(x,y,70))vil.push({x,y,a:c.a});}
    else{const x=R(x0+80,X1-80),y=R(y0+80,Y1-80);if(okV(x,y,70))vil.push({x,y,a:R(0,3.14)});}}
  const D=vil.map(v=>{const rx=v.town?R(100,140)*mp.town.scale:R(38,60),ryy=v.town?R(60,90)*mp.town.scale:R(30,46),poly=blob(v.x,v.y,rx,ryy,v.a,v.town?.35:.4,g.noise,R(0,90));
    return{cx:v.x,cy:v.y,poly,bb:bbox(poly),rot:v.town?v.a+R(-.1,.1):v.a,sp:v.town?R(20,24):R(13,16),village:!v.town,name:'',side:0};});
  const mark=(pts,kind)=>{for(let k=0;k<pts.length-1;k++){const a=pts[k],b=pts[k+1],L=Math.max(1,Math.ceil(dist(a,b)/3));
    for(let s=0;s<=L;s++){const x=a.x+(b.x-a.x)*s/L,y=a.y+(b.y-a.y)*s/L;if(x<x0||x>=X1||y<y0||y>=Y1)continue;const c=cellO(x,y);if(own[c])continue;road[c]=water(x,y)?3:Math.max(road[c],kind);}}};
  // a lane from each settlement off the road network to the nearest road
  for(const d of D){let best=null,bd=1e9;for(const rd of roads)for(const q of rd.pts){const dd=Math.hypot(q.x-d.cx,q.y-d.cy);if(dd<bd){bd=dd;best=q;}}
    if(!best||bd<32||bd>420)continue;const m={x:(d.cx+best.x)/2+R(-30,30),y:(d.cy+best.y)/2+R(-30,30)},pts=catmull([{x:d.cx,y:d.cy},m,best]);
    if(pts.some(q=>near(q.x,q.y,24)))continue;roads.push({pts,kind:1});}
  for(const rd of roads)mark(rd.pts,rd.kind);
  // settlements: urban cells and a street grid inside each outline, kept off the water and out of the battlefield
  const streets=[],inside=(d,x,y)=>inPoly(d.poly,x,y)&&!water(x,y)&&(!mp.wet||bank(x,y)>5)&&!near(x,y,2);
  for(const d of D){const b=d.bb;for(let j=Math.max(0,Math.floor((b.y0-y0)/C));j<=Math.min(gh-1,Math.floor((b.y1-y0)/C));j++)
    for(let i=Math.max(0,Math.floor((b.x0-x0)/C));i<=Math.min(gw-1,Math.floor((b.x1-x0)/C));i++){const k=j*gw+i;if(!own[k]&&inside(d,x0+i*C+4,y0+j*C+4))urb[k]=d.village?2:1;}
    const ext=Math.max(b.w,b.h)*.75;
    for(const ang of [d.rot,d.rot+Math.PI/2]){const dx=Math.cos(ang),dy=Math.sin(ang),px=-dy,py=dx;
      for(let o=-ext;o<=ext;o+=d.sp){const oo=o+R(-2.5,2.5);let run=[];
        for(let t=-ext;t<=ext;t+=5){const x=d.cx+dx*t+px*oo,y=d.cy+dy*t+py*oo,ins=x>=b.x0&&x<=b.x1&&y>=b.y0&&y<=b.y1&&inside(d,x,y);
          if(ins)run.push({x,y});else{if(run.length>2)streets.push(run);run=[];}}
        if(run.length>2)streets.push(run);}}}
  for(const st of streets)mark(st,1);
  // land use with the battlefield's own scores and thresholds: forest, then fields kept clear of it, then bare rock
  const bfs=(seed,cap)=>{const d=new Uint8Array(n).fill(cap),q=new Int32Array(n);let h=0,t=0;for(let i=0;i<n;i++)if(seed(i)){d[i]=0;q[t++]=i;}
    while(h<t){const i=q[h++],x=i%gw,nd=d[i]+1;if(nd>=cap)continue;
      if(x>0&&d[i-1]>nd){d[i-1]=nd;q[t++]=i-1;}if(x<gw-1&&d[i+1]>nd){d[i+1]=nd;q[t++]=i+1;}if(i>=gw&&d[i-gw]>nd){d[i-gw]=nd;q[t++]=i-gw;}if(i<n-gw&&d[i+gw]>nd){d[i+gw]=nd;q[t++]=i+gw;}}return d;};
  const slope=k=>{const i=k%gw,j=(k/gw)|0;return Math.hypot(hgt[j*gw+Math.min(gw-1,i+1)]-hgt[j*gw+Math.max(0,i-1)],hgt[Math.min(gh-1,j+1)*gw+i]-hgt[Math.max(0,j-1)*gw+i]);};
  const dU=bfs(k=>urb[k]>0,8);
  for(let k=0;k<n;k++){if(own[k])continue;const x=x0+(k%gw)*C+4,y=y0+((k/gw)|0)*C+4,b=mp.wet?bank(x,y):99;if(b<6||urb[k]||dU[k]<=2||water(x,y))continue;
    const f=v2?v2.fsc(x,y,slope(k)/g.smax,hgt[k]):g.fbm(x/360+40,y/360+9,4)+.3*slope(k)/g.smax+.2*hgt[k]+.35*Math.exp(-(((x-g.wf.x)/260)**2)-(b/190)**2);if(f>=g.ft)lu[k]=2;}
  const dF=bfs(k=>lu[k]===2,4),vills=[...g.villages,...D.filter(d=>d.village).map(d=>({cx:d.cx,cy:d.cy}))];
  for(let k=0;k<n;k++){if(own[k]||lu[k])continue;const x=x0+(k%gw)*C+4,y=y0+((k/gw)|0)*C+4,b=mp.wet?bank(x,y):99,td=Math.hypot(x-g.bx,y-g.by);
    if(b<6||urb[k]||dU[k]<=1||dF[k]<=2||td<240||water(x,y))continue;let vp=0;for(const v of vills)vp+=Math.exp(-((x-v.cx)**2+(y-v.cy)**2)/(230*230));
    const s=slope(k),f=v2?v2.psc(x,y,s/g.smax,vp):g.fbm(x/300+70,y/300+3,3)+.35*(1-Math.min(1,s/g.smax*1.5))+.3*vp+.25*Math.exp(-(((td-380)/260)**2));if(f>=g.pt)lu[k]=1;}
  const rockH=v2?v2.rockH:mp.rockH;
  if(rockH)for(let k=0;k<n;k++)if(!own[k]&&hgt[k]>rockH&&!urb[k]&&!road[k])lu[k]=3;
  // streams rise on high ground out here too and run down to the river, into another stream or off the edge
  const hs=(x,y)=>{const gx=clamp((x-x0)/C-.5,0,gw-1.001),gy=clamp((y-y0)/C-.5,0,gh-1.001),i=gx|0,j=gy|0,u=gx-i,v=gy-j,k=j*gw+i;
    return hgt[k]*(1-u)*(1-v)+hgt[k+1]*u*(1-v)+hgt[k+gw]*(1-u)*v+hgt[k+gw+1]*u*v;};
  const streams=[],sm=new Uint8Array(n);
  for(let t=0;t<400&&streams.length<Math.round(mp.streams*1.3);t++){let x=R(x0+40,X1-40),y=R(y0+40,Y1-40);if(near(x,y,80))continue;
    const b=bank(x,y);if((mp.wet&&(b<150||b>560))||streams.some(s=>Math.hypot(s[0].x-x,s[0].y-y)<190))continue;
    const sg=mp.wet?(y<ry(x)?1:-1):0;let a=mp.wet?sg*Math.PI/2+R(-.6,.6):R(0,6.283),end=false;const P=[{x,y}];
    for(let k=0;k<170;k++){const gx=hs(x+12,y)-hs(x-12,y),gy=hs(x,y+12)-hs(x,y-12),gl=Math.hypot(gx,gy)||1e-9;
      let da=Math.atan2(-gy/gl+sg*.7+Math.sin(a)*1.4,-gx/gl+Math.cos(a)*1.4)-a;da=Math.atan2(Math.sin(da),Math.cos(da));
      a+=clamp(da,-.3,.3)+(g.noise(x/60+t*3.1,y/60)-.5)*.4;x+=Math.cos(a)*8;y+=Math.sin(a)*8;
      if(x<x0||x>=X1||y<y0||y>=Y1){if(!mp.wet)end=true;break;}
      if(near(x,y,10)||P.some((q,j)=>j<P.length-4&&Math.hypot(q.x-x,q.y-y)<16))break;
      P.push({x,y});if(water(x,y)||sm[cellO(x,y)]){end=true;break;}}
    if(!end||P.length<10)continue;streams.push(P);for(const q of P)sm[cellO(q.x,q.y)]=1;}
  // terrain classes, as on the battlefield: land use, then towns, streams and water
  for(let k=0;k<n;k++){if(own[k])continue;const x=x0+(k%gw)*C+4,y=y0+((k/gw)|0)*C+4;
    cls[k]=lu[k]===1?FIELD:lu[k]===2?FOREST:lu[k]===3?ROCK:OPEN;if(urb[k])cls[k]=URBAN;if(sm[k]&&!urb[k])cls[k]=STREAM;if(water(x,y)){cls[k]=WATER;if(lakes&&!band(x,y))lakes[k]=1;}}
  // bridges where the outer roads cross the river
  const bridges=[];if(mp.wet)for(const rd of roads){const p=rd.pts;for(let k=0;k<p.length-1;k++){const a=p[k],b=p[k+1];
    if((a.y<ry(a.x))!==(b.y<ry(b.x))){const x=(a.x+b.x)/2;if(bridges.some(q=>Math.hypot(q.x-x,q.y-ry(x))<30))continue;bridges.push({x,y:ry(x),ang:Math.atan2(b.y-a.y,b.x-a.x),kind:rd.kind,len:rw(x)});}}}
  // contour lines for the paper style, outside the battlefield only
  const contours=[],Hh=(i,j)=>hgt[j*gw+i];
  for(const lv of [.5,.6,.7,.8,.9])for(let j=0;j<gh-1;j++)for(let i=0;i<gw-1;i++){const k=j*gw+i;if(cls[k]===WATER||(own[k]&&own[k+gw+1]))continue;
    const a=Hh(i,j),b=Hh(i+1,j),c=Hh(i+1,j+1),d=Hh(i,j+1),xa=x0+i*C+4,ya=y0+j*C+4,q=[];
    const e=(p,s,x1,y1,x2,y2)=>{if((p<lv)!==(s<lv)){const t=(lv-p)/(s-p);q.push(x1+(x2-x1)*t,y1+(y2-y1)*t);}};
    e(a,b,xa,ya,xa+C,ya);e(b,c,xa+C,ya,xa+C,ya+C);e(d,c,xa,ya+C,xa+C,ya+C);e(a,d,xa,ya,xa,ya+C);
    if(q.length>=4)contours.push([q[0],q[1],q[2],q[3],lv]);if(q.length===8)contours.push([q[4],q[5],q[6],q[7],lv]);}
  return M.outer={x0,y0,gw,gh,n,cls,lu,hgt,road,ry,rw,water,wet:mp.wet,streets,roads:[...M.roads,...roads],bridges,streams,contours,D,lakes,cellOf:cellO,outer:true};}
function renderOuter(){const dm=genOuter();if(settings.style==='paper')paperRender(dm,oc,OUT.ts);else satRender(dm,oc,OUT.ts);}

