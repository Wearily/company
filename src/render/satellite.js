// COMPANY · src/render/satellite.js
// The Satellite map style: per-pixel terrain, streams, buildings, roads.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
// A generated satellite image of the same map, at the map's real scale (1 px = 2.5 m): field parcels 30-400 m in farm
// regions about 1 km across, canopy textured at tree-crown size, buildings 8-75 m, streets 6 m, highways 22 m.
// Everything is seeded from the map seed, so a map always looks the same in a given climate.
const SAT_M=m=>m/M_PER_PX;
// Per-climate palette and drawing choices. parcels: whether open ground is cut into farm parcels; forest: how forest
// is drawn (canopy, snowpine, grove of tree dots, sparse taiga); riparian: the band along the river; stream: wet or dry.
const SATK={
  temperate:{parcels:true,forest:'canopy',
    crop:[[170,154,108],[188,174,130],[150,132,96],[120,100,78],[94,82,66],[98,122,64],[110,136,72],[192,184,100],[140,148,100],[86,108,58]],
    grass:[[70,94,50],[82,106,56],[94,116,62],[64,86,46],[104,120,72],[88,100,60],[78,98,62]],
    hedge:[50,68,40],track:[176,166,140],furrow:.045,conifer:[24,42,28],broadleaf:[44,70,38],rock:[122,116,106],town:[124,120,112],garden:[88,108,64],
    water:[[[112,92,66],[152,128,94]],[[56,80,78],[96,116,106]],[[42,64,76],[78,102,108]]],gravel:[198,188,168],riparian:{col:[30,52,34],w:22,style:'trees'},
    roofs:{core:[[176,88,62],[160,80,58],[190,106,76],[146,72,54],[168,98,74],[150,150,150],[122,122,126]],apart:[[150,150,150],[122,122,126],[172,170,166],[100,100,104],[138,132,124]],
      industrial:[[214,214,208],[198,202,202],[186,188,186],[150,150,150]],village:[[176,88,62],[160,80,58],[122,122,126],[100,100,104],[168,98,74]]},
    pitched:{core:true,apart:false,industrial:false,village:true},asphalt:[112,112,110],road:[150,146,138],roadCase:[60,58,52],street:[118,116,112],dirt:false,
    stream:{style:'wet',col:[38,58,62],fringe:[24,40,26]},grade:{sat:.82,mul:.92,add:[7,8,9]}},
  arid:{parcels:true,forest:'grove',orchards:true,greenhouses:true,
    crop:[[196,170,124],[182,152,108],[170,142,102],[204,182,138],[120,140,70],[96,124,58],[150,150,90],[186,160,118]],
    grass:[[198,176,138],[190,168,130],[180,160,122],[206,186,148]],scrub:[92,98,62],
    hedge:[88,96,58],track:[214,196,160],furrow:.04,tree:[64,84,46],ground:[188,164,124],rock:[168,142,112],town:[182,166,138],garden:[110,124,70],
    water:[[[38,84,104],[70,120,124]]],gravel:[214,200,170],riparian:{col:[70,100,50],w:28,style:'reeds'},
    roofs:{core:[[226,222,212],[212,206,196],[196,190,180],[232,228,220],[176,96,74],[184,176,164]],apart:[[218,214,206],[200,196,188],[226,224,218]],
      industrial:[[206,212,214],[224,224,220],[184,190,194]],village:[[224,218,206],[206,198,184],[232,226,214],[176,96,74]]},
    pitched:{core:false,apart:false,industrial:false,village:false},asphalt:[96,94,90],road:[206,186,150],roadCase:null,street:[178,162,134],dirt:true,
    stream:{style:'dry',col:[222,204,168],fringe:[100,108,66]},grade:{sat:.86,mul:.95,add:[10,8,4]}},
  desert:{parcels:false,forest:'grove',dunes:true,pivots:true,
    crop:[[96,128,58],[118,140,64],[136,150,76],[84,112,52],[170,150,104]],grass:[[214,190,148],[206,182,140],[220,198,158]],reg:[192,168,128],
    hedge:null,track:[226,208,172],furrow:.03,tree:[54,78,40],ground:[204,180,138],rock:[178,136,98],town:[200,182,148],garden:[150,150,100],
    water:[[[34,88,96],[72,126,116]]],gravel:[226,212,180],riparian:{col:[92,128,54],w:140,style:'irrigated'},
    roofs:{core:[[226,214,192],[212,200,178],[234,226,210],[196,182,160]],apart:[[222,212,194],[206,196,178]],industrial:[[214,212,204],[230,228,220]],village:[[222,206,178],[208,192,164],[230,218,196]]},
    pitched:{core:false,apart:false,industrial:false,village:false},asphalt:[88,86,82],road:[212,192,156],roadCase:null,street:[196,176,142],dirt:true,
    stream:{style:'dry',col:[230,212,176],fringe:[120,126,74]},grade:{sat:.9,mul:.96,add:[12,8,2]}},
  snow:{parcels:true,forest:'snowpine',snow:true,
    crop:[[238,240,244],[230,233,238],[224,228,234],[234,236,240]],grass:[[232,235,240],[226,230,236],[220,225,232]],
    hedge:[64,66,64],track:[214,218,226],furrow:.035,conifer:[30,40,36],rock:[86,88,92],town:[214,218,224],garden:[226,230,236],
    water:[[[42,54,64],[78,90,100]]],ice:[214,222,230],iceDark:[150,166,182],gravel:[222,226,232],riparian:{col:[66,68,70],w:18,style:'bare'},
    roofs:{core:[[240,242,246],[232,234,240],[226,228,236]],apart:[[236,238,242],[226,228,234]],industrial:[[240,242,246],[230,232,238]],village:[[240,242,246],[232,236,242]]},
    pitched:{core:true,apart:false,industrial:false,village:true},asphalt:[74,76,82],road:[104,106,112],roadCase:[236,238,242],street:[118,120,126],dirt:false,
    stream:{style:'frozen',col:[200,212,224],fringe:[62,64,64]},grade:{sat:.7,mul:.98,add:[3,5,9]}},
  tundra:{parcels:false,forest:'taiga',
    crop:[[156,150,98],[166,156,104],[146,142,94]],grass:[[124,120,86],[136,128,92],[110,106,78],[150,140,106],[118,116,82]],bog:[78,82,58],lichen:[176,170,128],
    hedge:null,track:[160,152,128],furrow:0,tree:[30,46,34],ground:[126,120,88],rock:[132,130,122],town:[140,138,130],garden:[120,118,86],
    water:[[[30,48,66],[58,78,92]]],gravel:[170,168,158],riparian:{col:[92,100,64],w:24,style:'scrub'},
    roofs:{core:[[128,64,56],[66,90,76],[74,92,118],[132,132,130],[56,56,58],[150,136,90]],apart:[[146,146,144],[118,118,120],[80,96,118]],
      industrial:[[176,178,178],[140,144,146]],village:[[128,64,56],[66,90,76],[74,92,118],[56,56,58],[150,136,90],[132,132,130]]},
    pitched:{core:true,apart:false,industrial:false,village:true},asphalt:[100,100,98],road:[156,148,128],roadCase:null,street:[146,140,124],dirt:true,
    stream:{style:'wet',col:[34,50,62],fringe:[84,92,60]},grade:{sat:.8,mul:.93,add:[6,7,8]}},
};
const satClimate=()=>CLIMATES[M.climate]?M.climate:'temperate';
// tileable smooth value noise, `cells` lattice cells across an n×n tile
function tileNoise(n,cells,r){const v=new Float32Array(cells*cells);for(let i=0;i<v.length;i++)v[i]=r();
  const out=new Float32Array(n*n),s=cells/n;
  for(let y=0;y<n;y++){const fy=y*s,iy=fy|0,ty=fy-iy,uy=ty*ty*(3-2*ty),y0=iy%cells,y1=(iy+1)%cells;
    for(let x=0;x<n;x++){const fx=x*s,ix=fx|0,tx=fx-ix,ux=tx*tx*(3-2*tx),x0=ix%cells,x1=(ix+1)%cells;
      const a=v[y0*cells+x0],b=v[y0*cells+x1],c=v[y1*cells+x0],d=v[y1*cells+x1];out[y*n+x]=a+(b-a)*ux+(c-a)*uy+(a-b-c+d)*ux*uy;}}
  return out;}
// Buildings along every street, sized by the kind of district: a terraced old core, apartment slabs or an industrial
// estate in the outer quarters, and detached houses in villages. Rows from crossing streets meet at the corners and
// close into perimeter blocks with courtyards. Roof colours and shapes come from the climate.
function satBuildings(r,K,dm){const out=[],D=dm.D,R=(a,b)=>a+(b-a)*r(),pick=a=>a[r()*a.length|0];
  const kinds=D.map((d,k)=>d.kind||(d.village?'village':k===0?'core':r()<.4?'core':r()<.7?'apart':'industrial'));
  const spec={core:{len:[6,10],dep:[5,7],gap:[0,1.2],set:.6},apart:{len:[10,18],dep:[4.5,6],gap:[4,9],set:2.5},
    industrial:{len:[14,30],dep:[10,18],gap:[3,7],set:2},village:{len:[3,4.5],dep:[3,4],gap:[3,7],set:2.2}};
  for(const st of dm.streets){const a=st[0],b=st[st.length-1],L=dist(a,b);if(L<6)continue;const ux=(b.x-a.x)/L,uy=(b.y-a.y)/L,nx=-uy,ny=ux;
    const m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};let dk=D.findIndex(d=>inPoly(d.poly,m.x,m.y));if(dk<0)dk=D.reduce((bi,d,k)=>Math.hypot(d.cx-m.x,d.cy-m.y)<Math.hypot(D[bi].cx-m.x,D[bi].cy-m.y)?k:bi,0);
    const kind=kinds[dk],sp=spec[kind],vary=c=>{const k=R(.9,1.08);return[c[0]*k|0,c[1]*k|0,c[2]*k|0];};
    for(const side of [-1,1]){let t=R(0,3);while(t<L){const len=R(...sp.len),dep=R(...sp.dep),c=t+len/2;if(c>L)break;
      const off=SAT_M(3)+sp.set+dep/2,x=a.x+ux*c+nx*off*side,y=a.y+uy*c+ny*off*side,ci=dm.cellOf(x,y);
      if(dm.cls[ci]===URBAN&&!dm.water(x,y)&&dm.road[ci]!==2&&dm.road[ci]!==3)out.push({x,y,ux,uy,len,dep,col:vary(pick(K.roofs[kind])),pitched:K.pitched[kind]});
      t+=len+R(...sp.gap);}}}
  return out;}
function renderSatellite(){satRender(innerDom(),tc,(window.devicePixelRatio||1)>1.5?1.5:1.25);}
// Draws a domain (the battlefield from innerDom(), or the scenery ring from genOuter()) into a canvas at TS canvas
// pixels per world pixel. Both go through exactly the same code, so the ring matches the battlefield at the border.
function satRender(dm,cvs,TS){
  const cw=Math.round(dm.gw*C*TS),ch=Math.round(dm.gh*C*TS);cvs.width=cw;cvs.height=ch;const g=cvs.getContext('2d'),GWd=dm.gw,GHd=dm.gh,Nd=dm.n,skip=dm.outer;
  const cl=satClimate(),K=SATK[cl];
  const r=rng(M.seed*31+7),hash=(a,b)=>{let h=Math.imul(a,374761393)^Math.imul(b,668265263)^Math.imul(M.seed,1442695041);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;};
  // per-cell layers, sampled bilinearly per pixel: land-use masks (blurred so edges are soft but crisp after a threshold),
  // low-frequency colour variation, and hill shading lit from the north-west
  const blur=a=>{const b=new Float32Array(Nd),c=new Float32Array(Nd);
    for(let j=0;j<GHd;j++)for(let i=0;i<GWd;i++){const k=j*GWd+i;b[k]=(a[k]+a[i>0?k-1:k]+a[i<GWd-1?k+1:k])/3;}
    for(let j=0;j<GHd;j++)for(let i=0;i<GWd;i++){const k=j*GWd+i;c[k]=(b[k]+b[j>0?k-GWd:k]+b[j<GHd-1?k+GWd:k])/3;}return c;};
  const mask=f=>{const a=new Float32Array(Nd);for(let i=0;i<Nd;i++)a[i]=f(i)?1:0;return blur(blur(a));};
  const F=mask(i=>dm.lu[i]===2),P=mask(i=>dm.lu[i]===1),Rk=mask(i=>dm.lu[i]===3),U=mask(i=>dm.cls[i]===URBAN),Lk=dm.lakes?mask(i=>dm.lakes[i]):null;
  // height spans about 260 m; a cell is 20 m; relief is exaggerated 1.5× so gentle hills still read
  // (low-frequency colour is anchored to world cells, so it carries straight across the border)
  const nz=makeNoise(r),low=new Float32Array(Nd),shade=new Float32Array(Nd),ex=260/(2*C*M_PER_PX)*1.5,ci0=dm.x0/C,cj0=dm.y0/C;
  for(let j=0;j<GHd;j++)for(let i=0;i<GWd;i++){const k=j*GWd+i;low[k]=nz((i+ci0)/30+3.1,(j+cj0)/30+7.7);
    const hx=(dm.hgt[j*GWd+Math.min(GWd-1,i+1)]-dm.hgt[j*GWd+Math.max(0,i-1)])*ex,hy=(dm.hgt[Math.min(GHd-1,j+1)*GWd+i]-dm.hgt[Math.max(0,j-1)*GWd+i])*ex;
    const nl=Math.hypot(hx,hy,1),L=[-.55,-.55,.63];shade[k]=clamp(((-hx*L[0]-hy*L[1]+L[2])/nl)/L[2],.72,1.2);}
  const T1=tileNoise(256,64,r),T1b=tileNoise(256,40,r),T2=tileNoise(256,8,r),T2b=tileNoise(256,14,r);
  // Farm regions about 1 km across (a jittered grid of Voronoi seeds), each laid out along its own direction. Inside a
  // region the parcels are rectangles of a rotated lattice: long strips 25-75 m wide, a staggered patchwork of 60-250 m
  // fields, or large 200-400 m fields. Region edges carry hedges and tree lines.
  const GB=420,nbx=Math.ceil(W/GB)+3,nby=Math.ceil(H/GB)+3,NB=nbx*nby,bsx=new Float32Array(NB),bsy=new Float32Array(NB),bca=new Float32Array(NB),bsa=new Float32Array(NB),bw=new Float32Array(NB),bl=new Float32Array(NB);
  for(let j=0;j<nby;j++)for(let i=0;i<nbx;i++){const k=j*nbx+i;bsx[k]=(i-1+.2+.6*r())*GB;bsy[k]=(j-1+.2+.6*r())*GB;
    const a=nz(i*.6+40,j*.6+11)*Math.PI+(r()-.5)*.35;bca[k]=Math.cos(a);bsa[k]=Math.sin(a);const style=r();
    if(style<.35){bw[k]=SAT_M(R2(r,25,75));bl[k]=SAT_M(R2(r,500,900));}else if(style<.8){bw[k]=SAT_M(R2(r,60,140));bl[k]=SAT_M(R2(r,120,250));}else{bw[k]=SAT_M(R2(r,200,320));bl[k]=SAT_M(R2(r,200,400));}}
  // The region table for this domain: the battlefield's own regions where they exist (same ids, so the battlefield draws
  // exactly as before), and more regions beyond its edges, drawn from a hash of their grid position.
  const ilo=Math.floor(dm.x0/GB),ihi=Math.floor((dm.x0+GWd*C)/GB)+2,jlo=Math.floor(dm.y0/GB),jhi=Math.floor((dm.y0+GHd*C)/GB)+2,ew=ihi-ilo+1,TBN=ew*(jhi-jlo+1);
  const tid=new Int32Array(TBN),tsx=new Float32Array(TBN),tsy=new Float32Array(TBN),tca=new Float32Array(TBN),tsa=new Float32Array(TBN),tw=new Float32Array(TBN),tl=new Float32Array(TBN);
  for(let jj=jlo;jj<=jhi;jj++)for(let ii=ilo;ii<=ihi;ii++){const t=(jj-jlo)*ew+ii-ilo;
    if(ii>=0&&ii<nbx&&jj>=0&&jj<nby){const k=jj*nbx+ii;tid[t]=k;tsx[t]=bsx[k];tsy[t]=bsy[k];tca[t]=bca[k];tsa[t]=bsa[k];tw[t]=bw[k];tl[t]=bl[k];}
    else{const hr=q=>hash(ii*7919+q,jj*104729+q*31);tid[t]=NB+(jj+1000)*4096+ii+1000;tsx[t]=(ii-1+.2+.6*hr(1))*GB;tsy[t]=(jj-1+.2+.6*hr(2))*GB;
      const a=nz(ii*.6+40,jj*.6+11)*Math.PI+(hr(3)-.5)*.35;tca[t]=Math.cos(a);tsa[t]=Math.sin(a);const style=hr(4);
      if(style<.35){tw[t]=SAT_M(25+50*hr(5));tl[t]=SAT_M(500+400*hr(6));}else if(style<.8){tw[t]=SAT_M(60+80*hr(5));tl[t]=SAT_M(120+130*hr(6));}else{tw[t]=SAT_M(200+120*hr(5));tl[t]=SAT_M(200+200*hr(6));}}}
  // desert dunes run along one prevailing wind direction
  const dA=r()*Math.PI,dca=Math.cos(dA),dsa=Math.sin(dA);
  const wks=K.water,wk=wks[(M.seed>>>0)%wks.length],[deep,shal]=wk;
  const ryc=new Float32Array(cw),rwc=new Float32Array(cw);for(let x=0;x<cw;x++){const wx=dm.x0+(x+.5)/TS;ryc[x]=dm.ry(wx);rwc[x]=dm.rw(wx)/2;}
  const img=g.createImageData(cw,ch),px=img.data,mixc=(c,k,t)=>{c[0]+=(t[0]-c[0])*k;c[1]+=(t[1]-c[1])*k;c[2]+=(t[2]-c[2])*k;},col=[0,0,0];
  // streams are small rivers: their channels go into a mask at this canvas's resolution (green: the banks, red: the water,
  // blue: the deep middle), widening downstream, and the per-pixel pass paints them like the river
  const S=K.stream;let SMK=null;
  if(dm.streams.length){const sc=document.createElement('canvas');sc.width=cw;sc.height=ch;const sg=sc.getContext('2d');
    sg.setTransform(TS,0,0,TS,-dm.x0*TS,-dm.y0*TS);sg.lineJoin='round';sg.lineCap='round';sg.globalCompositeOperation='lighter';
    const dry=S.style==='dry';
    // each channel wobbles a little about its course (rivers aren't smooth like roads) and tapers from a thread at the
    // source to its full width downstream
    const wob=dm.streams.map((s,si)=>s.map((p,i)=>{const a=s[Math.max(0,i-1)],b=s[Math.min(s.length-1,i+1)],L=Math.hypot(b.x-a.x,b.y-a.y)||1,amp=SAT_M(dry?5:3.5)*Math.min(1,i/5);
      const n=(nz(p.x/14+si*7.3,p.y/14)-.5)*2;return{x:p.x-(b.y-a.y)/L*n*amp,y:p.y+(b.x-a.x)/L*n*amp};}));
    for(const [colr,extra,k] of [['#00ff00',SAT_M(dry?6:5),1],['#ff0000',0,1],['#0000ff',0,.45]])
      for(const s of wob)for(let i=0;i<s.length-1;i++){const f=Math.pow(i/(s.length-1),.6),w=SAT_M(dry?2+18*f:1.5+10*f);
        sg.strokeStyle=colr;sg.lineWidth=w*k+extra*Math.min(1,.4+f);sg.beginPath();sg.moveTo(s[i].x,s[i].y);sg.lineTo(s[i+1].x,s[i+1].y);sg.stroke();}
    SMK=sg.getImageData(0,0,cw,ch).data;}
  // the bank: a tight, broken, darker edge where the channel cuts into the ground (brush, damp earth or shadow on snow)
  const sBank=S.style==='dry'?[(K.ground||[200,176,136])[0]*.6,(K.ground||[200,176,136])[1]*.56,(K.ground||[200,176,136])[2]*.52]:K.snow?[78,88,104]:K.riparian.col;
  for(let y=0;y<ch;y++){const ly=(y+.5)/TS,wy=dm.y0+ly,gy=clamp(ly/C-.5,0,GHd-1.001),j=gy|0,v=gy-j;
    for(let x=0;x<cw;x++){const lx=(x+.5)/TS,wx=dm.x0+lx,gx=clamp(lx/C-.5,0,GWd-1.001),i=gx|0,u=gx-i,q=j*GWd+i,o=(y*cw+x)*4;
      // the ring leaves the battlefield itself transparent; that part is drawn by the battlefield canvas on top
      if(skip&&wx>1&&wx<W-1&&wy>1&&wy<H-1){px[o+3]=0;continue;}
      const w00=(1-u)*(1-v),w10=u*(1-v),w01=(1-u)*v,w11=u*v;
      const tx=x&255,ty=(y&255)<<8,t1=T1[tx+ty]*.6+T1b[((x*3+77)&255)+(((y*3+31)&255)<<8)]*.4,t2=T2[tx+ty]*.6+T2b[((x+131)&255)+(((y+57)&255)<<8)]*.4;
      // edges are roughened with texture so forests, rock and towns don't have smooth outlines
      const rg=(t2-.5)*.22+(t1-.5)*.08,af=clamp((bilw(F,q,w00,w10,w01,w11,GWd)-.6+rg)*24+.5,0,1),ap=bilw(P,q,w00,w10,w01,w11,GWd),ar=clamp((bilw(Rk,q,w00,w10,w01,w11,GWd)-.6+rg)*24+.5,0,1),au=clamp((bilw(U,q,w00,w10,w01,w11,GWd)-.55+rg*.6)*14+.5,0,1),lw=bilw(low,q,w00,w10,w01,w11,GWd);
      col[0]=col[1]=col[2]=0;
      if(af<1&&ar<1&&au<1){
        // the farm region is the nearest seed; the gap to the second nearest marks the region edge
        const bx=Math.floor(wx/GB)+1-ilo,by=Math.floor(wy/GB)+1-jlo;let f1=1e12,f2=1e12,tb=0;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const kk=(by+dy)*ew+bx+dx,ddx=tsx[kk]-wx,ddy=tsy[kk]-wy,d=ddx*ddx+ddy*ddy;if(d<f1){f2=f1;f1=d;tb=kk;}else if(d<f2)f2=d;}
        const id=tid[tb],edge=Math.sqrt(f2)-Math.sqrt(f1),pu=wx*tca[tb]+wy*tsa[tb],pv=-wx*tsa[tb]+wy*tca[tb];
        // columns across the strips; each column's rows are staggered so fields don't line up like a chessboard
        const cl2=Math.floor(pv/tl[tb]),pu2=pu+hash(id,cl2)*tw[tb],row=Math.floor(pu2/tw[tb]),h=hash(id*7+cl2,row),h2=hash(id*13+row,cl2),h3=hash(id*29+row,cl2*3+1);
        const crop=h2<.2+.65*ap,fu=pu2/tw[tb]-row,fv=pv/tl[tb]-cl2,du=Math.min(fu,1-fu)*tw[tb],dv=Math.min(fv,1-fv)*tl[tb];
        if(K.parcels){const pal=crop?K.crop:K.grass,c=pal[(h*pal.length)|0],lt=(.92+.16*hash(row,cl2*3+id))*(.9+.2*t1);
          const fur=crop?1+K.furrow*Math.sin((tw[tb]<tl[tb]?pv:pu2)*2.6):1;col[0]=c[0]*lt*fur;col[1]=c[1]*lt*fur;col[2]=c[2]*lt*fur;
          // arid: some crop parcels are orchards, trees planted on a 7 m grid
          if(K.orchards&&crop&&h3<.22){const s=SAT_M(7),a=(pu2/s)%1-.5,b=(pv/s)%1-.5;col[0]=K.ground[0]*lt;col[1]=K.ground[1]*lt;col[2]=K.ground[2]*lt;if(a*a+b*b<.09)mixc(col,.85,K.tree);}
          // arid scrubland: dark bushes dotted over the dry open ground
          if(K.scrub&&!crop&&t1>.72)mixc(col,.6,K.scrub);
          if(dv<SAT_M(2.2)&&hash(id,cl2*5+1)<.45)mixc(col,.55,K.track);
          else if(du<.45||dv<.45){col[0]*=.9;col[1]*=.9;col[2]*=.9;}
          if(K.hedge&&edge<SAT_M(5)&&t2>.32){const k=(1-edge/SAT_M(5))*.85;col[0]+=(K.hedge[0]*(.8+.4*t1)-col[0])*k;col[1]+=(K.hedge[1]*(.8+.4*t1)-col[1])*k;col[2]+=(K.hedge[2]*(.8+.4*t1)-col[2])*k;}}
        else if(K.dunes){
          // desert: dune seas where the low noise is high, flat gravel plain elsewhere; irrigated crop circles in crop parcels
          const g0=K.grass[(h*K.grass.length)|0],dz=lw>.48?1:0,ph=(wx*dca+wy*dsa)/SAT_M(95)+lw*6+(t2-.5)*1.2,rip=Math.sin(ph*6.2832);
          const lt=dz?(.94+.1*Math.max(0,rip)-.1*Math.max(0,-rip*1.4))*(.97+.06*t1):(.9+.18*t1);
          const base=dz?g0:K.reg;col[0]=base[0]*lt;col[1]=base[1]*lt;col[2]=base[2]*lt;
          if(crop&&h3<.7){const cu=(fu-.5)*tw[tb],cv=(fv-.5)*tl[tb],R0=Math.min(tw[tb],tl[tb])*.47,R1=Math.min(R0,SAT_M(250));
            if(cu*cu+cv*cv<R1*R1){const c=K.crop[(h*K.crop.length)|0],k=.9+.15*t1;col[0]=c[0]*k;col[1]=c[1]*k;col[2]=c[2]*k;}}}
        else{
          // tundra: mottled moss, lichen and bog, no field pattern
          const a=K.grass[((lw*3.7+t2*1.9)%1*K.grass.length)|0],k=.88+.24*t1;col[0]=a[0]*k;col[1]=a[1]*k;col[2]=a[2]*k;
          const wet=t2+(lw-.5)*.7;if(wet<.34)mixc(col,.6,K.bog);else if(t1>.78&&lw>.4)mixc(col,.5,K.lichen);
          if(crop&&ap>.5)mixc(col,.35,K.crop[0]);}
        // a slow wash of moisture and soil tone over the whole countryside
        const wash=.93+.12*lw;col[0]*=wash;col[1]*=wash;col[2]*=wash;}
      // forest, as the climate draws it
      if(af>0){let fr,fg,fb;
        if(K.forest==='canopy'){const mix=clamp(lw*1.6-.3+(t2-.5)*.6,0,1),c1=K.conifer,c2=K.broadleaf,k=(.62+.75*t1)*(t1>.72?1.15:1);
          fr=(c1[0]+(c2[0]-c1[0])*mix)*k;fg=(c1[1]+(c2[1]-c1[1])*mix)*k;fb=(c1[2]+(c2[2]-c1[2])*mix)*k;}
        else if(K.forest==='snowpine'){const k=.7+.6*t1;fr=K.conifer[0]*k;fg=K.conifer[1]*k;fb=K.conifer[2]*k;
          // snow caught on the crowns and lying in the gaps between them
          if(t1>.64||t2>.7){const s=t1>.64?.75:.4;fr+=(232-fr)*s;fg+=(236-fg)*s;fb+=(242-fb)*s;}}
        else{// groves and taiga: separate tree crowns on open ground, dense in groves, sparse in taiga
          const thr=K.forest==='taiga'?.6:.42,gr=K.ground,k=.92+.16*t2;fr=gr[0]*k;fg=gr[1]*k;fb=gr[2]*k;
          if(t1>thr){const s=Math.min(1,(t1-thr)*9);fr+=(K.tree[0]-fr)*s;fg+=(K.tree[1]-fg)*s;fb+=(K.tree[2]-fb)*s;}
          else if(t1>thr-.06){fr*=.78;fg*=.78;fb*=.78;}}
        col[0]+=(fr-col[0])*af;col[1]+=(fg-col[1])*af;col[2]+=(fb-col[2])*af;}
      // bare rock: mottled scree, relief shading tripled so each ridge shows a lit face and a shadowed one; in winter the
      // gentler, sunlit slopes carry snow and only the steep shaded rock shows dark
      if(ar>0){const sh0=bilw(shade,q,w00,w10,w01,w11,GWd),shR=clamp(1+(sh0-1)*3.2,.45,1.2),k=(.72+.36*t2)*(.9+.2*t1);
        let rr=K.rock[0]*k*shR,rg2=K.rock[1]*k*shR,rb=K.rock[2]*k*shR;
        // winter: sunlit slopes are white; shaded slopes are blue-grey snow with dark rock outcrops showing through
        if(K.snow){if(sh0>.9-(t2-.5)*.2){rr=236*shR;rg2=240*shR;rb=246*shR;}
          else if(t2>.62&&t1>.4){const d=Math.max(.7,shR);rr=96*d;rg2=104*d;rb=118*d;}
          else{const d=Math.max(.8,shR);rr=198*d;rg2=208*d;rb=226*d;}}
        else if(t1>.62&&t2>.45-(1-ar)*.8){const tr=K.tree||K.conifer,v=.7;rr+=(tr[0]*1.4*shR-rr)*v;rg2+=(tr[1]*1.4*shR-rg2)*v;rb+=(tr[2]*1.4*shR-rb)*v;}
        col[0]+=(rr-col[0])*ar;col[1]+=(rg2-col[1])*ar;col[2]+=(rb-col[2])*ar;}
      // town ground: paving with gardens and yards between the buildings
      if(au>0){const gd=t2>.56?1:0,base=K.town,gn=K.garden,k=.86+.25*t1;
        const ur=(base[0]+(gn[0]-base[0])*gd)*k,ug=(base[1]+(gn[1]-base[1])*gd)*k,ub=(base[2]+(gn[2]-base[2])*gd)*k;col[0]+=(ur-col[0])*au;col[1]+=(ug-col[1])*au;col[2]+=(ub-col[2])*au;}
      // relief shading; snow takes blue shadows
      const sh=bilw(shade,q,w00,w10,w01,w11,GWd);
      if(K.snow&&sh<1){col[0]*=sh;col[1]*=sh;col[2]*=sh;const k=(1-sh)*1.4;col[0]+=(150-col[0])*k*.4;col[1]+=(164-col[1])*k*.4;col[2]+=(196-col[2])*k*.4;}
      else{col[0]*=sh;col[1]*=sh;col[2]*=sh;}
      // streams: damp, darker banks with brush, then water deeper in the middle (ice when frozen), or a sandy bed when dry
      if(SMK&&SMK[o+1]){const sb=SMK[o+1]/255,sw=SMK[o]/255,sd=SMK[o+2]/255;
        // the bank: a faint damp edge, and clumps of brush (or bare shrubs on snow) broken along it
        if(sw<1){const e=sb*(1-sw);mixc(col,e*.16,sBank);if(t1>.56)mixc(col,e*Math.min(1,(t1-.56)*4)*.8,sBank);}
        if(sw>0){let wc;
          if(S.style==='dry'){const g0=K.gravel||S.col,k=(.82+.22*t2+.1*t1)*(.92+.08*sd);wc=[(g0[0]*.6+S.col[0]*.4)*k,(g0[1]*.6+S.col[1]*.4)*k,(g0[2]*.6+S.col[2]*.4)*k];
            if(t2<.3)mixc(wc,.35,sBank);if(t1>.76&&sd<.5)mixc(wc,.6,K.scrub||[104,108,66]);}
          else{const k=(1-sd)*.8,tk=.94+.12*t2;wc=[(deep[0]+(shal[0]-deep[0])*k)*tk,(deep[1]+(shal[1]-deep[1])*k)*tk,(deep[2]+(shal[2]-deep[2])*k)*tk];
            // frozen: blue-grey ice, darker and clearer down the middle, snow drifting in at the edges
            if(K.ice){const dk=K.iceDark||K.ice,ic=K.ice,c2=.55+.45*sd,fk=.93+.1*t1;mixc(wc,.9,[(ic[0]+(dk[0]-ic[0])*c2)*fk,(ic[1]+(dk[1]-ic[1])*c2)*fk,(ic[2]+(dk[2]-ic[2])*c2)*fk]);
              if(sd<.2&&t2>.55)mixc(wc,.6,[236,240,246]);}}
          mixc(col,sw,wc);}}
      // lakes and ponds away from the river (new map generation only): a ragged shore, water deepening toward the middle,
      // ice in a frozen climate
      if(Lk){const al=bilw(Lk,q,w00,w10,w01,w11,GWd);if(al>.3){const aw=clamp((al-.55+rg*.3)*14+.5,0,1);
        if(aw>0){const dp=clamp((al-.55)*2.4,0,1),k=(1-dp)*(1-dp)*.85,tk=.94+.12*t2,wc=[(deep[0]+(shal[0]-deep[0])*k)*tk,(deep[1]+(shal[1]-deep[1])*k)*tk,(deep[2]+(shal[2]-deep[2])*k)*tk];
          mixc(wc,dp*.5,[34,56,70]);
          if(K.ice){const ic=K.ice,fk=.95+.08*t1;mixc(wc,.9,[ic[0]*fk,ic[1]*fk,ic[2]*fk]);if(Math.abs(t2-.5)<.012)mixc(wc,.4,[120,134,148]);}
          mixc(col,aw,wc);}}}
      // the river: its bank band (trees, reeds, an irrigated valley, bare winter trees or scrub), water deeper in the middle,
      // gravel bars on wide stretches, darker open water in a lake; in a frozen climate ice over all of it, snow-white at
      // the banks and greyer, clearer ice down the middle of the channel so the river still reads, with thin pressure cracks
      if(dm.wet){const dc=Math.abs(wy-ryc[x]),hw=rwc[x],dv=dc-hw,rb=K.riparian,bw2=SAT_M(rb.w);
        if(dv>0&&dv<bw2&&au<.5){const f=1-dv/bw2;
          if(rb.style==='irrigated'){const k=Math.min(1,f*2.2)*.9,c=t2>.5?rb.col:[rb.col[0]*1.25,rb.col[1]*1.12,rb.col[2]];mixc(col,k*(1-af*.5),[c[0]*(.9+.2*t1),c[1]*(.9+.2*t1),c[2]*(.9+.2*t1)]);}
          else if(t1>.33)mixc(col,f*.7,rb.style==='bare'?[rb.col[0]*(t1>.6?1:3.3),rb.col[1]*(t1>.6?1:3.3),rb.col[2]*(t1>.6?1:3.4)]:rb.col);}
        if(dv<.8){const t=Math.min(1,dc/Math.max(hw,1)),k=t*t*.85,tk=.94+.12*t2,lake=clamp((hw-SAT_M(90))/SAT_M(120),0,1)*(1-t*t);
          const wc=[(deep[0]+(shal[0]-deep[0])*k)*tk,(deep[1]+(shal[1]-deep[1])*k)*tk,(deep[2]+(shal[2]-deep[2])*k)*tk];
          mixc(wc,lake*.7,[34,56,70]);
          if(K.ice){const ch=(1-t)*(1-t)*(1-lake)*.55,ic=K.ice,dk=K.iceDark||ic,fk=.95+.08*t1;
            mixc(wc,.9,[(ic[0]+(dk[0]-ic[0])*ch)*fk,(ic[1]+(dk[1]-ic[1])*ch)*fk,(ic[2]+(dk[2]-ic[2])*ch)*fk]);if(Math.abs(t2-.5)<.012)mixc(wc,.4,[120,134,148]);}
          else if(hw>SAT_M(35)&&hw<SAT_M(90)&&t>.62&&t2>.62&&lw>.45){const gk=.92+.1*t1;wc[0]=K.gravel[0]*gk;wc[1]=K.gravel[1]*gk;wc[2]=K.gravel[2]*gk;}
          mixc(col,clamp(.5-dv*TS,0,1),wc);}}
      // colour grade toward real imagery
      const G2=K.grade,lum=.3*col[0]+.59*col[1]+.11*col[2];
      px[o]=(lum+(col[0]-lum)*G2.sat)*G2.mul+G2.add[0];px[o+1]=(lum+(col[1]-lum)*G2.sat)*G2.mul+G2.add[1];px[o+2]=(lum+(col[2]-lum)*G2.sat)*G2.mul+G2.add[2];px[o+3]=255;}}
  g.setTransform(1,0,0,1,0,0);g.putImageData(img,0,0);
  g.setTransform(TS,0,0,TS,-dm.x0*TS,-dm.y0*TS);g.lineJoin='round';g.lineCap='round';
  const line=p=>{g.beginPath();p.forEach((q,i)=>i?g.lineTo(q.x,q.y):g.moveTo(q.x,q.y));g.stroke();},rgb=(c,a=1)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
  // arid: plastic greenhouses in clusters on farmland near the villages and town, laid out along the field direction
  if(K.greenhouses){const near=(x,y)=>dm.D.some(d=>Math.hypot(d.cx-x,d.cy-y)<(d.village?240:420));
    for(let t=0,n=0;t<900&&n<70;t++){const x=R2(r,dm.x0+20,dm.x0+GWd*C-20),y=R2(r,dm.y0+20,dm.y0+GHd*C-20),ci=dm.cellOf(x,y);if((skip&&x>-30&&x<W+30&&y>-30&&y<H+30)||!(dm.lu[ci]===1||dm.cls[ci]===OPEN)||dm.road[ci]||dm.cls[ci]===URBAN||!near(x,y))continue;
      const bx=Math.floor(x/GB)+1-ilo,by=Math.floor(y/GB)+1-jlo;let tb=0,f1=1e12;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const kk=(by+dy)*ew+bx+dx,d=(tsx[kk]-x)**2+(tsy[kk]-y)**2;if(d<f1){f1=d;tb=kk;}}
      const ux=tca[tb],uy=tsa[tb],cnt=2+(r()*5|0),wd=SAT_M(R2(r,8,12)),ln=SAT_M(R2(r,40,80));let ok=true;
      for(let k=0;k<cnt;k++){const ox=x-uy*(k-cnt/2)*(wd+SAT_M(2)),oy=y+ux*(k-cnt/2)*(wd+SAT_M(2)),cj=dm.cellOf(ox,oy);if(dm.road[cj]||dm.cls[cj]===URBAN||dm.cls[cj]===WATER||dm.cls[cj]===FOREST)ok=false;}
      if(!ok)continue;n++;
      for(let k=0;k<cnt;k++){const ox=x-uy*(k-cnt/2)*(wd+SAT_M(2)),oy=y+ux*(k-cnt/2)*(wd+SAT_M(2));g.save();g.translate(ox,oy);g.transform(ux,uy,-uy,ux,0,0);
        g.fillStyle='rgba(30,30,28,.35)';g.fillRect(-ln/2+.7,-wd/2+.7,ln,wd);const sh=R2(r,.92,1.06);g.fillStyle=rgb([176*sh,190*sh,200*sh]);g.fillRect(-ln/2,-wd/2,ln,wd);
        g.strokeStyle='rgba(120,134,146,.55)';g.lineWidth=.35;for(let s=-wd/2+1.1;s<wd/2;s+=1.1){g.beginPath();g.moveTo(-ln/2,s);g.lineTo(ln/2,s);g.stroke();}g.restore();}}}
  // buildings, each with a shadow cast to the south-east (longer under the low winter sun) and a pitched roof lit on
  // its north-west face
  const bs=satBuildings(r,K,dm),so=K.snow?1.5:.9;
  g.fillStyle=K.snow?'rgba(60,70,90,.55)':'rgba(20,20,18,.42)';for(const b of bs){g.save();g.translate(b.x+so,b.y+so);g.transform(b.ux,b.uy,-b.uy,b.ux,0,0);g.fillRect(-b.len/2,-b.dep/2,b.len,b.dep);g.restore();}
  for(const b of bs){g.save();g.translate(b.x,b.y);g.transform(b.ux,b.uy,-b.uy,b.ux,0,0);
    g.fillStyle=rgb(b.col);g.fillRect(-b.len/2,-b.dep/2,b.len,b.dep);
    // the roof half facing away from the north-west sun is darker
    if(b.pitched){g.fillStyle=K.snow?'rgba(70,90,130,.22)':'rgba(0,0,0,.18)';g.fillRect(-b.len/2,(b.uy-b.ux)>0?-b.dep/2:0,b.len,b.dep/2);}
    else{g.strokeStyle='rgba(0,0,0,.18)';g.lineWidth=.5;g.strokeRect(-b.len/2+.25,-b.dep/2+.25,b.len-.5,b.dep-.5);}g.restore();}
  // streets, roads and highways at their real widths: asphalt, dirt tracks in dry climates, gravel in the tundra, and
  // ploughed snowbanks lining the roads in winter
  g.strokeStyle=rgb(K.street);g.lineWidth=SAT_M(6);dm.streets.forEach(line);
  if(K.roadCase)for(const rd of dm.roads)if(rd.kind===1){g.strokeStyle=rgb(K.roadCase,K.snow?.9:.55);g.lineWidth=SAT_M(11);line(rd.pts);}
  for(const rd of dm.roads)if(rd.kind===1){g.strokeStyle=rgb(K.road);g.lineWidth=SAT_M(K.dirt?7:8);line(rd.pts);}
  for(const rd of dm.roads)if(rd.kind===2){g.strokeStyle=K.snow?rgb(K.roadCase,.95):'rgba(48,48,46,.7)';g.lineWidth=SAT_M(25);line(rd.pts);}
  for(const rd of dm.roads)if(rd.kind===2){g.strokeStyle=rgb(K.asphalt);g.lineWidth=SAT_M(22);line(rd.pts);
    g.strokeStyle='rgba(210,208,198,.45)';g.lineWidth=SAT_M(.6);g.setLineDash([SAT_M(9),SAT_M(12)]);line(rd.pts);g.setLineDash([]);}
  // bridges: a deck over the water with its shadow on the river below
  for(const b of dm.bridges){const w=SAT_M(b.kind===2?24:10),l=b.len+SAT_M(24);g.save();g.translate(b.x,b.y);g.rotate(b.ang);
    g.fillStyle='rgba(10,14,12,.45)';g.fillRect(-l/2+2,-w/2+2.5,l,w);g.fillStyle=K.snow?'rgb(214,218,224)':'rgb(162,160,154)';g.fillRect(-l/2,-w/2,l,w);
    g.strokeStyle='rgba(40,40,38,.6)';g.lineWidth=.8;g.strokeRect(-l/2,-w/2,l,w);g.restore();}
  M.satWater=K.ice?rgb(K.ice):rgb([(deep[0]+shal[0])/2,(deep[1]+shal[1])/2,(deep[2]+shal[2])/2]);M.satRubble=K.snow?'#5a5f66':K.dirt?'#8a7254':'#4f4538';}
const R2=(r,a,b)=>a+(b-a)*r(),bilw=(s,q,a,b,c,d,w)=>s[q]*a+s[q+1]*b+s[q+w]*c+s[q+w+1]*d;

