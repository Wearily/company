// COMPANY · src/render/terrain.js
// The canvases (cv on screen, tc for the prerendered terrain), renderTerrain, which draws the battlefield once in the
// chosen map view, and the Strategic (paper) map style.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
const cv=document.getElementById('cv'),ctx=cv.getContext('2d');
const tc=document.createElement('canvas'),tg=tc.getContext('2d');
// the terrain prerender in the chosen map style (Settings: satellite or paper)
function renderTerrain(){if(settings.style==='paper')renderPaper();else renderSatellite();renderOuter();}
// The battlefield as a domain for the terrain renderers; the scenery ring (genOuter) has the same shape.
function innerDom(){return{x0:0,y0:0,gw:GW,gh:GH,n:N,cls:M.cls,lu:M.lu,hgt:M.hgt,road:M.road,ry:M.ry,rw:M.rw,water:M.water,wet:M.wet,
  streets:M.streets,roads:M.roads,bridges:M.bridges,streams:M.streams,contours:M.contours,D:M.D,lakes:M.lakes,cellOf,outer:false};}
function renderPaper(){paperRender(innerDom(),tc,(window.devicePixelRatio||1)>1.5?1.5:1.25);}
// The paper map of a domain (the battlefield, or the scenery ring around it), into a canvas at TS pixels per world px.
function paperRender(dm,cvs,TS){
  const cw=Math.round(dm.gw*C*TS),ch=Math.round(dm.gh*C*TS);
  cvs.width=cw;cvs.height=ch;const g=cvs.getContext('2d'),GWd=dm.gw,GHd=dm.gh,Nd=dm.n,skip=dm.outer;
  // fields and forests: each class mask is blurred and thresholded per pixel, which rounds the outlines
  // and leaves a thin white margin wherever two classes meet
  const blur=a=>{const b=new Float32Array(Nd),c=new Float32Array(Nd);
    for(let j=0;j<GHd;j++)for(let i=0;i<GWd;i++){const k=j*GWd+i;b[k]=(a[k]+a[i>0?k-1:k]+a[i<GWd-1?k+1:k])/3;}
    for(let j=0;j<GHd;j++)for(let i=0;i<GWd;i++){const k=j*GWd+i;c[k]=(b[k]+b[j>0?k-GWd:k]+b[j<GHd-1?k+GWd:k])/3;}return c;};
  const mask=v=>{const a=new Float32Array(Nd);for(let i=0;i<Nd;i++)a[i]=dm.lu[i]===v?1:0;return blur(blur(a));};
  const F=mask(2),P=mask(1),Rk=mask(3),img=g.createImageData(cw,ch),px=img.data,k=1/(TS*C),edge=24;
  // lakes and ponds away from the river (new map generation only), filled in the river's colour
  const Lk=dm.lakes?blur(blur(Float32Array.from(dm.lakes))):null,lc=M.frozen?[169,197,242]:[11,87,240];
  const fc=[13,122,46],pc=[248,201,160],rc=[200,193,182];
  for(let y=0;y<ch;y++){const gy=clamp((y+.5)*k-.5,0,GHd-1.001),j=gy|0,v=gy-j,wy=dm.y0+(y+.5)/TS;
    for(let x=0;x<cw;x++){
      // the ring leaves the battlefield itself transparent; that part is drawn by the battlefield canvas on top
      if(skip){const wx=dm.x0+(x+.5)/TS;if(wx>1&&wx<W-1&&wy>1&&wy<H-1){px[(y*cw+x)*4+3]=0;continue;}}
      const gx=clamp((x+.5)*k-.5,0,GWd-1.001),i=gx|0,u=gx-i,q=j*GWd+i;
      const w00=(1-u)*(1-v),w10=u*(1-v),w01=(1-u)*v,w11=u*v;
      const f=F[q]*w00+F[q+1]*w10+F[q+GWd]*w01+F[q+GWd+1]*w11,p=P[q]*w00+P[q+1]*w10+P[q+GWd]*w01+P[q+GWd+1]*w11,rk=Rk[q]*w00+Rk[q+1]*w10+Rk[q+GWd]*w01+Rk[q+GWd+1]*w11;
      const af=clamp((f-.6)*edge+.5,0,1),ap=clamp((p-.6)*edge+.5,0,1),ar=clamp((rk-.6)*edge+.5,0,1),o=(y*cw+x)*4;
      for(let c=0;c<3;c++)px[o+c]=255+(fc[c]-255)*af+(pc[c]-255)*ap+(rc[c]-255)*ar;px[o+3]=255;
      if(Lk){const al=Lk[q]*w00+Lk[q+1]*w10+Lk[q+GWd]*w01+Lk[q+GWd+1]*w11,aw=clamp((al-.6)*edge+.5,0,1);if(aw>0)for(let c=0;c<3;c++)px[o+c]+=(lc[c]-px[o+c])*aw;}}}
  g.setTransform(1,0,0,1,0,0);g.putImageData(img,0,0);
  g.setTransform(TS,0,0,TS,-dm.x0*TS,-dm.y0*TS);g.lineJoin='round';g.lineCap='round';
  const strokeLine=p=>{g.beginPath();p.forEach((q,i)=>i?g.lineTo(q.x,q.y):g.moveTo(q.x,q.y));g.stroke();};
  for(const s of dm.contours){g.strokeStyle=s[4]===.7||s[4]===.9?'rgba(140,98,56,.6)':'rgba(150,108,64,.38)';g.lineWidth=s[4]===.7||s[4]===.9?1.1:.8;
    g.beginPath();g.moveTo(s[0],s[1]);g.lineTo(s[2],s[3]);g.stroke();}
  // streams widen from source to mouth; frozen water is pale blue
  const wcol=M.frozen?COL.ice:COL.water;g.strokeStyle=wcol;
  for(const s of dm.streams)for(let k=0;k<s.length-1;k++){g.lineWidth=1.1+1.5*k/s.length;g.beginPath();g.moveTo(s[k].x,s[k].y);g.lineTo(s[k+1].x,s[k+1].y);g.stroke();}
  g.fillStyle=wcol;g.beginPath();
  const xa=dm.x0-10,xb=dm.x0+GWd*C+10;
  for(let x=xa;x<=xb;x+=5){const y=dm.ry(x)-dm.rw(x)/2;x===xa?g.moveTo(x,y):g.lineTo(x,y);}
  for(let x=xb;x>=xa;x-=5)g.lineTo(x,dm.ry(x)+dm.rw(x)/2);g.closePath();g.fill();
  g.strokeStyle='#fff';g.lineWidth=4;dm.streets.forEach(strokeLine);
  g.strokeStyle=COL.road;g.lineWidth=1.6;dm.streets.forEach(strokeLine);
  for(const pass of [0,1])for(const kind of [1,2])for(const rd of dm.roads){if(rd.kind!==kind)continue;
    g.strokeStyle=pass?COL.road:'#fff';g.lineWidth=pass?(kind===2?5:1.9):(kind===2?11:6);strokeLine(rd.pts);}
  g.strokeStyle=COL.ink;g.lineWidth=1.6;
  for(const b of dm.bridges){g.save();g.translate(b.x,b.y);g.rotate(b.ang);const hl=b.len/2+6,o=b.kind===2?6.5:3.5;
    for(const s of [-1,1]){g.beginPath();g.moveTo(-hl-4,s*(o+4));g.lineTo(-hl,s*o);g.lineTo(hl,s*o);g.lineTo(hl+4,s*(o+4));g.stroke();}g.restore();}
}

