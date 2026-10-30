// COMPANY · src/render/draw.js
// The per-frame dynamic layer: units, objectives, trenches, effects, labels.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
// NATO (APP-6) symbols, a Settings option (ui.symbols): your units in a rectangle frame and the enemy's in a diamond,
// each with its branch inside (natoIcon): infantry a cross, armor an oval for its tracks, artillery a dot, engineers a bridge
const nato=()=>ui.symbols==='nato';
function framePath(x,y,r,hostile){ctx.beginPath();if(hostile){const d=r*1.4;ctx.moveTo(x,y-d);ctx.lineTo(x+d,y);ctx.lineTo(x,y+d);ctx.lineTo(x-d,y);ctx.closePath();}
  else ctx.rect(x-r*1.3,y-r*.88,r*2.6,r*1.76);}
function natoIcon(type,x,y,r,hostile){const w=hostile?r*.7:r*1.3,h=hostile?r*.7:r*.88;ctx.strokeStyle=ctx.fillStyle='#fff';ctx.lineWidth=Math.max(1.2,r*.16);ctx.beginPath();
  if(type==='inf'){ctx.moveTo(x-w,y-h);ctx.lineTo(x+w,y+h);ctx.moveTo(x+w,y-h);ctx.lineTo(x-w,y+h);ctx.stroke();}
  else if(type==='tank'){ctx.ellipse(x,y,w*.62,h*.52,0,0,Math.PI*2);ctx.stroke();}
  else if(type==='art'){ctx.arc(x,y,r*.3,0,Math.PI*2);ctx.fill();}
  else{const a=w*.55,t=y-h*.3,b=y+h*.38;ctx.moveTo(x-a,b);ctx.lineTo(x-a,t);ctx.lineTo(x+a,t);ctx.lineTo(x+a,b);ctx.moveTo(x,t);ctx.lineTo(x,b);ctx.stroke();}}
function shapePath(type,x,y,r,hostile){if(nato())return framePath(x,y,r,hostile);ctx.beginPath();if(type==='inf')ctx.arc(x,y,r,0,Math.PI*2);
  else if(type==='tank')ctx.rect(x-r*.92,y-r*.92,r*1.84,r*1.84);
  else if(type==='eng'){for(let k=0;k<6;k++){const a=Math.PI/6+k*Math.PI/3,px=x+Math.cos(a)*r*1.08,py=y+Math.sin(a)*r*1.08;k?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();}
  else{ctx.moveTo(x,y-r*1.15);ctx.lineTo(x+r*1.05,y+r*.75);ctx.lineTo(x-r*1.05,y+r*.75);ctx.closePath();}}
function label(text,x,y,font,color,ls){ctx.font=font;ctx.textAlign='center';ctx.textBaseline='middle';if('letterSpacing' in ctx)ctx.letterSpacing=ls||'0px';
  ctx.lineWidth=3.5;ctx.lineJoin='round';ctx.strokeStyle='rgba(255,255,255,.92)';ctx.strokeText(text,x,y);ctx.fillStyle=color;ctx.fillText(text,x,y);if('letterSpacing' in ctx)ctx.letterSpacing='0px';}
function resample(sp,step){const out=[];let carry=0;for(let k=0;k<sp.length-1;k++){const a=sp[k],b=sp[k+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<1e-6)continue;
  const nx=-(b[1]-a[1])/L,ny=(b[0]-a[0])/L;let s=carry;while(s<=L){out.push([a[0]+(b[0]-a[0])*s/L,a[1]+(b[1]-a[1])*s/L,nx,ny]);s+=step;}carry=s-L;}return out;}
function drawTrench(pts,preview){const sp=pts.filter(Boolean).map(p=>ws(p.x,p.y));if(sp.length<2)return;const step=clamp(5*cam.z*1.4,3.5,8),amp=step*.55;
  const rs=resample(sp,step);ctx.strokeStyle=preview?'rgba(74,53,35,.6)':COL.trench;ctx.lineWidth=1.7;ctx.beginPath();
  rs.forEach((q,i)=>{const f=i%2?1:-1,x=q[0]+q[2]*amp*f,y=q[1]+q[3]*amp*f;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}
const legCol=(mode,alpha)=>`rgba(${mode==='amove'?'227,18,11':'27,29,26'},${alpha})`;
function arrowHead(pts,bold){const [ex,ey]=pts[pts.length-1];let k=pts.length-2;while(k>0&&Math.hypot(ex-pts[k][0],ey-pts[k][1])<6)k--;
  // the head points along the last stretch that is long enough to give a direction
  const a=Math.atan2(ey-pts[k][1],ex-pts[k][0]),hl=bold?11:8;if(!isFinite(a)||k<0)return;
  ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex-Math.cos(a-.42)*hl,ey-Math.sin(a-.42)*hl);ctx.lineTo(ex-Math.cos(a+.42)*hl,ey-Math.sin(a+.42)*hl);ctx.closePath();ctx.fill();}
// The current leg follows the unit's path; each queued leg is a dashed straight line from where the previous one ends,
// with its own head, since its route is only worked out when it starts.
function drawArrow(u,x,y,alpha,bold){ctx.lineWidth=bold?2.2:1.6;ctx.lineJoin='round';let end=[x,y];
  if(u.path.length){const pts=[[x,y],...u.path.map(p=>ws(p.x,p.y))];ctx.strokeStyle=ctx.fillStyle=legCol(u.mode,alpha);
    ctx.beginPath();ctx.moveTo(x,y);for(let k=1;k<pts.length;k++)ctx.lineTo(pts[k][0],pts[k][1]);ctx.stroke();arrowHead(pts,bold);end=pts[pts.length-1];}
  for(const q of u.queue||[]){const to=ws(q.x,q.y);ctx.strokeStyle=ctx.fillStyle=legCol(q.mode,alpha);ctx.setLineDash([6,4]);
    ctx.beginPath();ctx.moveTo(end[0],end[1]);ctx.lineTo(to[0],to[1]);ctx.stroke();ctx.setLineDash([]);arrowHead([end,to],bold);end=to;}}
// A pontoon: boats across the stream under a white deck. Unbuilt length shows as a dashed outline.
function drawPontoon(p){const [s,e]=p.from==='b'?[p.b,p.a]:[p.a,p.b],[x0,y0]=ws(s.x,s.y),[x1,y1]=ws(e.x,e.y),L=Math.hypot(x1-x0,y1-y0);if(L<2)return;
  const ux=(x1-x0)/L,uy=(y1-y0)/L,nx=-uy,ny=ux,w=clamp(6*cam.z,3,14),k=p.done?1:p.progress,bl=L*k;
  if(!p.done){ctx.strokeStyle='rgba(27,29,26,.55)';ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();
    for(const sd of [-1,1]){ctx.moveTo(x0+nx*w*sd,y0+ny*w*sd);ctx.lineTo(x1+nx*w*sd,y1+ny*w*sd);}ctx.stroke();ctx.setLineDash([]);}
  if(bl>0){const step=clamp(9*cam.z,5,16);ctx.fillStyle=COL.ink;
    for(let d=step/2;d<bl;d+=step){const cx=x0+ux*d,cy=y0+uy*d;ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.atan2(uy,ux));ctx.fillRect(-step*.3,-w*1.7,step*.6,w*3.4);ctx.restore();}
    ctx.fillStyle='#fff';ctx.strokeStyle=COL.ink;ctx.lineWidth=1.2;ctx.beginPath();
    ctx.moveTo(x0+nx*w,y0+ny*w);ctx.lineTo(x0+ux*bl+nx*w,y0+uy*bl+ny*w);ctx.lineTo(x0+ux*bl-nx*w,y0+uy*bl-ny*w);ctx.lineTo(x0-nx*w,y0-ny*w);ctx.closePath();ctx.fill();ctx.stroke();}
  if(!p.done)label(Math.round(k*100)+'%',(x0+x1)/2+nx*(w+12),(y0+y1)/2+ny*(w+12),`500 10px ${css('--mono')}`,COL[p.side]);}
function drawPlane(x,y,a,col){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle=col;ctx.strokeStyle='#fff';ctx.lineWidth=1.2;ctx.beginPath();
  ctx.moveTo(13,0);ctx.lineTo(2,-2);ctx.lineTo(-2,-12);ctx.lineTo(-6,-12);ctx.lineTo(-4,-2);ctx.lineTo(-10,-2);ctx.lineTo(-13,-6);ctx.lineTo(-15,-6);ctx.lineTo(-13,0);
  ctx.lineTo(-15,6);ctx.lineTo(-13,6);ctx.lineTo(-10,2);ctx.lineTo(-4,2);ctx.lineTo(-6,12);ctx.lineTo(-2,12);ctx.lineTo(2,2);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
const covCv=document.createElement('canvas');covCv.width=GW;covCv.height=GH;const covCtx=covCv.getContext('2d');
function draw(){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#e8e9e4';ctx.fillRect(0,0,vw,vh);
  if(!M)return;const z=cam.z,live=G&&$('startModal').hidden;
  ctx.setTransform(dpr*z,0,0,dpr*z,-cam.x*z*dpr,-cam.y*z*dpr);ctx.imageSmoothingEnabled=true;
  // the scenery ring around the battlefield, then the battlefield itself; a light veil over the ring and the black
  // border mark where play ends
  if(oc.width)ctx.drawImage(oc,-OUT.mx,-OUT.my,W+2*OUT.mx,H+2*OUT.my);
  ctx.drawImage(tc,0,0,W,H);
  if(G&&live&&SC().night){ctx.fillStyle='rgba(8,14,38,.4)';ctx.fillRect(-OUT.mx,-OUT.my,W+2*OUT.mx,H+2*OUT.my);}
  ctx.fillStyle=settings.style==='paper'?'rgba(60,62,58,.1)':'rgba(16,18,16,.18)';ctx.beginPath();ctx.rect(-OUT.mx,-OUT.my,W+2*OUT.mx,H+2*OUT.my);ctx.rect(0,0,W,H);ctx.fill('evenodd');
  ctx.strokeStyle=COL.ink;ctx.lineWidth=1.5/z;ctx.strokeRect(0,0,W,H);
  if(live){ctx.fillStyle='rgba(90,80,70,.28)';for(const c of G.craters){ctx.beginPath();ctx.arc(c.x,c.y,4,0,Math.PI*2);ctx.fill();}
    // cratered road: a gap in the road. Inside a clip of small discs around the damaged cells, the road lines are
    // stroked again in their white casing, so the red line breaks and nothing spills past the road's own edges.
    if(G.dmgList.length){ctx.save();ctx.beginPath();for(const i of G.dmgList){const c=cc(i);ctx.moveTo(c.x+7,c.y);ctx.arc(c.x,c.y,7,0,Math.PI*2);}ctx.clip();
      // paper shows the road's white casing through the gap; satellite shows broken ground
      ctx.strokeStyle=settings.style==='paper'?'#fff':(M.satRubble||'#4f4538');ctx.lineJoin='round';ctx.lineCap='round';
      for(const l of G.dmgLines){ctx.lineWidth=l.w;ctx.beginPath();l.pts.forEach((q,k)=>k?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.stroke();}
      ctx.restore();ctx.lineCap='butt';}
    // fallen bridges: water over the span, clipped to the river so the bank ends of the bridge symbol stay as stubs
    const downs=G.bridges.filter(b=>b.down);
    if(downs.length){ctx.save();ctx.beginPath();for(let x=-10;x<=W+10;x+=5){const y=M.ry(x)-M.rw(x)/2;x===-10?ctx.moveTo(x,y):ctx.lineTo(x,y);}
      for(let x=W+10;x>=-10;x-=5)ctx.lineTo(x,M.ry(x)+M.rw(x)/2);ctx.closePath();ctx.clip();
      for(const b of downs){const hw=b.kind===2?11:8;ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.ang);ctx.fillStyle=settings.style==='paper'?(M.frozen?COL.ice:COL.water):(M.satWater||COL.water);ctx.fillRect(-b.len/2-14,-hw,b.len+28,hw*2);
        ctx.fillStyle=COL.ink;ctx.rotate(.35);ctx.fillRect(-b.len*.22,-1.5,b.len*.16,3);ctx.rotate(-.7);ctx.fillRect(b.len*.08,-1.5,b.len*.14,3);ctx.restore();}
      ctx.restore();}
    if(settings.front&&(G.frontSeg.length||G.frontSegP.length||G.frontSegE.length)){ctx.drawImage(frontCv,0,0,W,H);const o=1.3/z,foe=COL[G.player==='A'?'D':'A'],pass=(sg,col,w,off)=>{ctx.strokeStyle=col;ctx.lineWidth=w/z;ctx.beginPath();
        for(let k=0;k<sg.length;k+=6){const nx=sg[k+4]*off,ny=sg[k+5]*off;ctx.moveTo(sg[k]+nx,sg[k+1]+ny);ctx.lineTo(sg[k+2]+nx,sg[k+3]+ny);}ctx.stroke();};
      ctx.lineCap='round';
      // single line: your colour on your side, theirs on theirs; two lines: each side's own line, set just inside its ground
      if(settings.frontStyle==='two'){pass(G.frontSegP,'rgba(255,255,255,.8)',6,o);pass(G.frontSegE,'rgba(255,255,255,.8)',6,o);pass(G.frontSegE,foe,2.2,o);pass(G.frontSegP,COL[G.player],2.2,o);}
      else{pass(G.frontSeg,'rgba(255,255,255,.8)',6,0);pass(G.frontSeg,foe,2.2,-o);pass(G.frontSeg,COL[G.player],2.2,o);}
      ctx.lineCap='butt';}
    // supply efficiency as one cell-per-pixel image scaled up (no seams between cells): the side's colour, stronger where
    // supply is better, and amber (stronger the worse it is) below SUPPLY.ok, where the out-of-supply penalties begin
    // supply as a heat map (one cell per pixel, scaled up smoothly): green at full supply through yellow at SUPPLY.ok,
    // where the penalties begin, to red; deep red where your own ground has none (a pocket, or ground the enemy holds).
    // The image is rebuilt only when the supply map changes.
    if(G.showSup){const cv=G.cov[G.player];
      if(covCv._src!==cv){covCv._src=cv;const img=covCtx.createImageData(GW,GH),home=G.player==='A'?1:-1;
        for(let i=0;i<N;i++){const o=i*4;let c,a;
          if(cv[i]){c=supHeat(cv[i]);a=80;}else if(M.side((i%GW)*C+C/2,Math.floor(i/GW)*C+C/2)===home&&(M.cls[i]!==WATER||M.road[i])){c=[150,20,30];a=95;}else continue;
          img.data[o]=c[0];img.data[o+1]=c[1];img.data[o+2]=c[2];img.data[o+3]=a;}
        covCtx.putImageData(img,0,0);}
      ctx.drawImage(covCv,0,0,W,H);
      const dp=G.depot[G.player];ctx.strokeStyle=COL[G.player];ctx.setLineDash([6/z,5/z]);ctx.lineWidth=1.2/z;ctx.beginPath();ctx.arc(dp.x,dp.y,240,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  // place labels
  for(const d of M.D){if(!d.name)continue;const [x,y]=ws(d.cx,d.cy);if(d.village)label(d.name,x,y-(d.bb.h/2+10)*z,`italic 500 ${clamp(10*z+3,9,14)}px ${css('--body')}`,'#3b3f38');
    else label(d.name.toUpperCase(),x,y-(d.bb.h*.5+14)*z,`600 ${clamp(14*z+4,11,22)}px ${css('--body')}`,COL.ink,'3px');}
  if(M.waterLabel){const rx=M.waterAt,lake=M.mode==='lake',[x,y]=ws(rx,lake?M.ry(rx):M.ry(rx)+M.rw(rx)/2+12);ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(M.ry(rx+40)-M.ry(rx-40),80));
    label(M.waterLabel,0,0,`italic 500 ${clamp((lake?16:11)*z+3,10,lake?22:15)}px ${css('--body')}`,lake?(M.frozen?'#4f6070':'#fff'):COL.water,lake?'3px':'1px');ctx.restore();}
  if(!live){drawScale();return;}
  // deploy zone
  if(G.phase==='deploy'){ctx.strokeStyle=COL.D;ctx.lineWidth=1.5;ctx.setLineDash([8,6]);ctx.beginPath();for(let x=0;x<=W;x+=20){const [sx,sy]=ws(x,M.ry(x)+ZONE);x?ctx.lineTo(sx,sy):ctx.moveTo(sx,sy);}ctx.stroke();ctx.setLineDash([]);
    const [lx,ly]=ws(W*.5,M.ry(W*.5)+ZONE+14);label('DEFENDER DEPLOYMENT LIMIT',lx,ly,`600 10px ${css('--body')}`,COL.D,'2px');}
  // (under fog, an attacker sees only the stretches of the defender's trenches it has had in sight)
  for(const t of G.trenches){if(G.replay||G.player==='D'||!G.fog){drawTrench(t);continue;}let run=[];
    for(let k=0;k<t.length-1;k++){if(trenchKnown(G.player,t[k],t[k+1])){if(!run.length)run.push(t[k]);run.push(t[k+1]);}else{if(run.length>1)drawTrench(run);run=[];}}
    if(run.length>1)drawTrench(run);}
  if(tdraw)drawTrench(tdraw,true);
  // a crossing worn down by shelling shows how much is left
  for(const c of strikable()){if(c.hp>=c.max)continue;const [x,y]=ws(c.x,c.y);label(Math.max(0,Math.round(c.hp/c.max*100))+'%',x,y-14,`600 10px ${css('--mono')}`,COL.road);}
  // pontoons: your own and finished ones always show, an enemy site only once your units can see it
  for(const p of G.pontoons)if(p.done||p.side===G.player||!G.fog||mine().some(u=>dist(u,p)<TYPES[u.type].vision))drawPontoon(p);
  // one small grey x in each gap
  ctx.strokeStyle='#8c8c86';ctx.lineWidth=1.5;ctx.lineCap='round';
  for(const d of G.dmgSpots){const [x,y]=ws(d.x,d.y),h=clamp(2.2*cam.z,2.5,5);ctx.beginPath();ctx.moveTo(x-h,y-h);ctx.lineTo(x+h,y+h);ctx.moveTo(x+h,y-h);ctx.lineTo(x-h,y+h);ctx.stroke();}
  ctx.lineCap='butt';
  // your own air strikes on the way: the target and a countdown
  for(const s of G.strikes){if(s.side!==G.player||s.done)continue;const [x,y]=ws(s.x,s.y),rr=(AIR.radius+36)*cam.z;
    ctx.strokeStyle=COL.road;ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(x,y,rr,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    label('AIR '+Math.ceil(s.t-G.time)+'s',x,y-rr-9,`600 10px ${css('--mono')}`,COL.road);}
  // air strike mode: the ring the strike would cover follows the mouse (snapped to a crossing it would hit), with a
  // warning when your own units are inside it; grey once no strikes are left, and nothing past the map border
  if(G.orderMode==='air'&&G.phase==='play'&&hoverPt){const w=s2w(hoverPt.x,hoverPt.y);
    if(w.x>=0&&w.y>=0&&w.x<=W&&w.y<=H){const aim=airAim(w.x,w.y),[x,y]=ws(aim.x,aim.y),R0=AIR.radius+36,rr=R0*cam.z,left=G.air[G.player]>0,col=left?COL.road:'#8a8d86';
      const mineIn=mine().filter(u=>dist(u,aim)<R0).length;
      ctx.fillStyle=left?'rgba(227,18,11,.08)':'rgba(120,120,120,.06)';ctx.beginPath();ctx.arc(x,y,rr,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=3.5;ctx.stroke();ctx.strokeStyle=col;ctx.lineWidth=1.6;ctx.setLineDash([5,4]);ctx.stroke();ctx.setLineDash([]);
      ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x-9,y);ctx.lineTo(x+9,y);ctx.moveTo(x,y-9);ctx.lineTo(x,y+9);ctx.stroke();
      const txt=!left?'NO AIR STRIKES LEFT':aim.crossing?'DESTROY '+crossingName(aim.crossing).toUpperCase():'AIR STRIKE';
      label(txt,x,y-rr-9,`600 10px ${css('--mono')}`,col);
      if(left&&mineIn)label(`${mineIn} OF YOURS IN RANGE`,x,y+rr+11,`600 10px ${css('--mono')}`,COL.road);}}
  // objectives
  for(const o of G.objs){const [x,y]=ws(o.x,o.y),rr=75*z,col=COL[o.owner];
    ctx.fillStyle=o.owner==='A'?'rgba(23,24,28,.06)':o.owner==='N'?'rgba(95,99,93,.06)':'rgba(122,44,191,.07)';ctx.beginPath();ctx.arc(x,y,rr,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=col;ctx.lineWidth=1.6;ctx.setLineDash([7,5]);ctx.stroke();ctx.setLineDash([]);
    if(Math.abs(o.p)<1){ctx.strokeStyle=COL.D;ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,rr+4,-Math.PI/2,-Math.PI/2+Math.PI*2*(o.p+1)/2);ctx.stroke();}
    // the objective's ring, as in the HUD: the owner's colour filled as far as its hold, orange while it's being taken,
    // dotted grey while neutral. No background: a light track, a soft shadow and a white halo on the letter keep it
    // readable on any ground
    const R=clamp(8*Math.sqrt(z)+5,10,15),lw=R*.24,fr=o.contested?takeFrac(o):o.owner==='A'?(1-o.p)/2:(1+o.p)/2;ctx.save();
    ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=3;ctx.lineWidth=lw;
    if(o.owner==='N'&&!o.contested){ctx.strokeStyle='#8e8e93';ctx.setLineDash([lw*.8,lw*1.2]);ctx.beginPath();ctx.arc(x,y,R,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    else{ctx.strokeStyle='rgba(255,255,255,.6)';ctx.beginPath();ctx.arc(x,y,R,0,Math.PI*2);ctx.stroke();ctx.shadowColor='transparent';
      ctx.strokeStyle=o.contested?'#ff9500':col;ctx.lineCap=fr<1?'round':'butt';ctx.beginPath();ctx.arc(x,y,R,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(fr,.04,1));ctx.stroke();}
    ctx.shadowColor='transparent';ctx.font=`700 ${Math.round(R*.95)}px ${css('--font')}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
    ctx.lineWidth=3.5;ctx.strokeStyle='rgba(255,255,255,.92)';ctx.strokeText(o.key,x,y+R*.06);ctx.fillStyle='#1d1d1f';ctx.fillText(o.key,x,y+R*.06);ctx.restore();
    label(o.name,x,y+rr+12,`600 ${clamp(9*z+4,10,13)}px ${css('--font')}`,col);}
  // depots
  for(const s of ['A','D']){const d=G.depot[s],[x,y]=ws(d.x,d.y);ctx.fillStyle='#fff';ctx.strokeStyle=COL[s];ctx.lineWidth=2;ctx.fillRect(x-18,y-8,36,16);ctx.strokeRect(x-18,y-8,36,16);
    ctx.fillStyle=COL[s];ctx.font=`500 9px ${css('--mono')}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('DEPOT',x,y+.5);}
  // Company Command: your rally point (a flag, dashed from the depot), the unit being built, and a raided depot
  if(G.econ&&!G.replay){const e=G.econ[G.player],d=G.depot[G.player],[x,y]=ws(d.x,d.y),[rx,ry]=ws(e.rally.x,e.rally.y),q=e.q[0];
    ctx.strokeStyle=COL[G.player];ctx.lineWidth=1.2;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(rx,ry);ctx.stroke();ctx.setLineDash([]);
    ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(rx,ry);ctx.lineTo(rx,ry-18);ctx.stroke();ctx.fillStyle=COL[G.player];ctx.beginPath();ctx.moveTo(rx,ry-18);ctx.lineTo(rx+11,ry-14);ctx.lineTo(rx,ry-10);ctx.closePath();ctx.fill();
    if(q){ctx.fillStyle='rgba(255,255,255,.92)';ctx.fillRect(x-19,y+11,38,5);ctx.fillStyle=COL[G.player];ctx.fillRect(x-18,y+12,36*Math.min(1,q.t/q.T),3);}
    if(e.raid){ctx.strokeStyle='rgba(255,59,48,'+(.55+.35*Math.sin(performance.now()/180))+')';ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.beginPath();ctx.arc(x,y,ECON.depotR*cam.z,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}}
  const r=unitR(),vis=G.vis[G.player],showAll=G.phase==='over';
  // ghosts
  ctx.setLineDash([3,3]);for(const g of G.ghosts.values()){const [x,y]=ws(g.x,g.y);ctx.globalAlpha=.55*(1-(G.time-g.t)/30);shapePath(g.type,x,y,r,true);ctx.strokeStyle=COL[G.player==='A'?'D':'A'];ctx.lineWidth=1.4;ctx.stroke();}
  ctx.globalAlpha=1;ctx.setLineDash([]);
  // orders: an arrow along each unit's route, solid while paused and faint while the clock runs
  const still=G.paused||G.phase!=='play';
  for(const u of mine()){if(!settings.arrows&&!u.sel)continue;const [x,y]=ws(u.x,u.y);
    if(u.path.length||(u.queue&&u.queue.length))drawArrow(u,x,y,settings.arrows?(still?.95:u.sel?.55:.28):.6,still);
    if(u.fireAt&&(u.sel||(settings.arrows&&still))){const [fx,fy]=ws(u.fireAt.x,u.fireAt.y);ctx.strokeStyle=COL.road;ctx.lineWidth=1;ctx.setLineDash([2,4]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(fx,fy);ctx.stroke();ctx.setLineDash([]);
      ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(fx,fy,9,0,Math.PI*2);ctx.moveTo(fx-14,fy);ctx.lineTo(fx+14,fy);ctx.moveTo(fx,fy-14);ctx.lineTo(fx,fy+14);ctx.stroke();}}
  // firing range of each selected unit, including the high-ground bonus (skipped for big selections)
  {const sel=selected();if(sel.length<=8){ctx.lineWidth=1;ctx.setLineDash([3,5]);
    for(const u of sel){const [x,y]=ws(u.x,u.y),hk=hillK(u.x,u.y);ctx.strokeStyle=hk>.05?'rgba(176,110,0,.95)':'rgba(27,29,26,.4)';ctx.lineWidth=hk>.05?1.6:1;
      ctx.beginPath();ctx.arc(x,y,rangeOf(u)*cam.z,0,Math.PI*2);ctx.stroke();}ctx.setLineDash([]);}}
  for(const m of G.marks){const [x,y]=ws(m.x,m.y),k=m.t/.7;ctx.strokeStyle=m.mode==='move'?COL.ink:COL.road;ctx.globalAlpha=k;ctx.lineWidth=2;ctx.setLineDash(m.direct?[3,3]:[]);ctx.beginPath();ctx.arc(x,y,6+(1-k)*14,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;ctx.setLineDash([]);
  // units
  for(const u of G.units){if(u.side!==G.player&&!vis.has(u.id)&&!showAll)continue;const [x,y]=ws(u.x,u.y);
    if(x<-30||y<-30||x>vw+30||y>vh+30)continue;
    if(u.sel){ctx.strokeStyle=COL.sel;ctx.lineWidth=3;shapePath(u.type,x,y,r+4);ctx.stroke();}
    if(u.flash>0){ctx.fillStyle='rgba(255,170,0,.55)';ctx.beginPath();ctx.arc(x,y,r+5,0,Math.PI*2);ctx.fill();}
    const foe=u.side!==G.player,N6=nato();shapePath(u.type,x,y,r,foe);ctx.fillStyle=COL[u.side];ctx.fill();
    ctx.lineWidth=settings.style==='paper'?1.5:2;ctx.strokeStyle=u.sup?'#fff':COL.road;if(!u.sup)ctx.setLineDash([2.5,2]);ctx.stroke();ctx.setLineDash([]);
    if(N6)natoIcon(u.type,x,y,r,foe);
    // guns set up: a bar under the gun; holding: a bar down the middle (NATO: along the top of the frame)
    if(u.type==='art'&&u.deployT>=3&&!u.moving){ctx.fillStyle='#fff';ctx.fillRect(x-r*.45,y+r*(N6?.5:.15),r*.9,1.6);}
    if(u.mode==='hold'&&!foe){ctx.fillStyle='#fff';if(N6)ctx.fillRect(x-r*.7,y-r*.88-4.5,r*1.4,2.6);else ctx.fillRect(x-1.2,y-r*.55,2.4,r*.9);}
    // dug in: a parapet arc in front of the unit, toward the enemy's side of the map
    if(dugIn(u)){const up=u.side==='A'?-1:1;ctx.strokeStyle='#fff';ctx.lineWidth=4.5;ctx.beginPath();ctx.arc(x,y,N6?r*1.45+4:r+4,up<0?Math.PI*1.15:Math.PI*.15,up<0?Math.PI*1.85:Math.PI*.85);ctx.stroke();
      ctx.strokeStyle=COL.trench;ctx.lineWidth=2.4;ctx.stroke();}
    if(u.hp<u.max){const w=r*2.2,hy=y+r+(N6&&foe?r*.45:0);ctx.fillStyle='rgba(255,255,255,.9)';ctx.fillRect(x-w/2-1,hy+3,w+2,4);
      // a wounded unit's bar: the part it can't heal back is grey, after a white gap at the cap
      if(u.wounded){ctx.fillStyle='#a3a3aa';ctx.fillRect(x-w/2+w*WOUND.cap+1.5,hy+4,w*(1-WOUND.cap)-1.5,2);}ctx.fillStyle=u.hp/u.max>.35?COL[u.side]:COL.road;ctx.fillRect(x-w/2,hy+4,w*u.hp/u.max,2);}}
  // effects
  for(const t of G.tracers){const [x1,y1]=ws(t.x1,t.y1),[x2,y2]=ws(t.x2,t.y2);ctx.strokeStyle=t.side==='A'?'rgba(255,140,0,.85)':'rgba(190,90,255,.85)';ctx.lineWidth=t.heavy?2:1;
    ctx.globalAlpha=t.t/.2;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}ctx.globalAlpha=1;
  for(const s of G.strikes){const dt=G.time-s.t;if(dt<-1.5)continue;const [x,y]=ws(s.x+Math.cos(s.ang)*dt*260,s.y+Math.sin(s.ang)*dt*260);drawPlane(x,y,s.ang,COL[s.side]);}
  for(const s of G.shells){const k=s.t/s.T,wx=s.x0+(s.x1-s.x0)*k,wy=s.y0+(s.y1-s.y0)*k-Math.sin(Math.PI*k)*Math.min(140,dist({x:s.x0,y:s.y0},{x:s.x1,y:s.y1})*.25),[x,y]=ws(wx,wy);
    ctx.fillStyle=COL.ink;ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.fill();}
  for(const b of G.booms){const [x,y]=ws(b.x,b.y),k=b.t/.9;ctx.fillStyle=`rgba(255,${Math.round(140+80*k)},0,${.7*(1-k)})`;ctx.beginPath();ctx.arc(x,y,(6+b.r*k)*z*1.2+3,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=`rgba(60,60,60,${.5*(1-k)})`;ctx.lineWidth=1.2;ctx.stroke();}
  if(drag&&drag.kind==='box'&&(Math.abs(drag.x1-drag.x0)>4||Math.abs(drag.y1-drag.y0)>4)){ctx.strokeStyle=COL.ink;ctx.fillStyle='rgba(255,196,0,.12)';ctx.lineWidth=1;
    const x=Math.min(drag.x0,drag.x1),y=Math.min(drag.y0,drag.y1),w=Math.abs(drag.x1-drag.x0),h=Math.abs(drag.y1-drag.y0);ctx.fillRect(x,y,w,h);ctx.strokeRect(x+.5,y+.5,w,h);}
  drawScale();}
// the scale bar: white on the map, just above the command dock (scaleAnchor)
// supply heat map colours, by efficiency 0–100
const SUP_RAMP=[[0,[205,30,40]],[30,[255,110,30]],[60,[255,204,0]],[80,[150,215,50]],[100,[40,190,90]]];
function supHeat(v){for(let k=1;k<SUP_RAMP.length;k++){const [b,cb]=SUP_RAMP[k];if(v<=b){const [a,ca]=SUP_RAMP[k-1],t=(v-a)/(b-a);return ca.map((c,j)=>Math.round(c+(cb[j]-c)*t));}}return SUP_RAMP[SUP_RAMP.length-1][1];}
// the heat map's key, left of the scale bar while supply is shown
function drawSupKey(){const w=130,x1=scaleAt.x-150,x0=x1-w,y=scaleAt.y;ctx.save();
  const g=ctx.createLinearGradient(x0,0,x1,0);for(const [v,c] of SUP_RAMP)g.addColorStop(v/100,`rgb(${c})`);
  ctx.shadowColor='rgba(0,0,0,.55)';ctx.shadowBlur=3;ctx.shadowOffsetY=1;ctx.fillStyle=g;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x0,y-6,w,6,3);else ctx.rect(x0,y-6,w,6);ctx.fill();
  ctx.fillStyle='#fff';ctx.font=`600 11px ${css('--font')}`;ctx.textBaseline='alphabetic';ctx.textAlign='left';ctx.fillText('Supply 0%',x0,y-11);ctx.textAlign='right';ctx.fillText('100%',x1,y-11);
  ctx.fillRect(x0+w*SUPPLY.ok-.75,y-9,1.5,12);ctx.restore();}
function drawScale(){if(!scaleAt)scaleAnchor();const target=110/cam.z*M_PER_PX,nice=[100,200,250,500,1000,2000].reduce((b,v)=>Math.abs(v-target)<Math.abs(b-target)?v:b),px=nice/M_PER_PX*cam.z;
  const x1=scaleAt.x,x0=x1-px,y=scaleAt.y;ctx.save();ctx.shadowColor='rgba(0,0,0,.55)';ctx.shadowBlur=3;ctx.shadowOffsetY=1;ctx.fillStyle='#fff';
  ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x0,y-4,px,4,2);else ctx.rect(x0,y-4,px,4);ctx.fill();
  ctx.font=`600 11px ${css('--font')}`;ctx.textAlign='right';ctx.textBaseline='alphabetic';ctx.fillText(nice>=1000?nice/1000+' km':nice+' m',x1,y-9);ctx.restore();
  if(G&&G.showSup&&!G.replay&&G.cov[G.player])drawSupKey();}
const cssCache={};function css(v){return cssCache[v]||(cssCache[v]=getComputedStyle(document.documentElement).getPropertyValue(v).trim());}

