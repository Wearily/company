// COMPANY · src/engine/utils.js
// Small shared helpers: distances and the grid, seeded random (rng), noise, curves and polygons, place-name syllables,
// time format.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const cellOf=(x,y)=>clamp(Math.floor(y/C),0,GH-1)*GW+clamp(Math.floor(x/C),0,GW-1);
const cc=i=>({x:(i%GW)*C+C/2,y:Math.floor(i/GW)*C+C/2});
function rng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function makeNoise(r){const p=new Float32Array(65536);for(let i=0;i<65536;i++)p[i]=r();
  return(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
    const h=(i,j)=>p[((i&255)<<8)|(j&255)];const a=h(xi,yi),b=h(xi+1,yi),c=h(xi,yi+1),d=h(xi+1,yi+1);
    return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;};}
function catmull(P,step=6){const out=[];for(let i=0;i<P.length-1;i++){const p0=P[Math.max(0,i-1)],p1=P[i],p2=P[i+1],p3=P[Math.min(P.length-1,i+2)];
  const n=Math.max(2,Math.ceil(Math.hypot(p2.x-p1.x,p2.y-p1.y)/step));
  for(let k=0;k<n;k++){const t=k/n,t2=t*t,t3=t2*t;const f=(a,b,c,d)=>.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3);
    out.push({x:f(p0.x,p1.x,p2.x,p3.x),y:f(p0.y,p1.y,p2.y,p3.y)});}}
  out.push({x:P[P.length-1].x,y:P[P.length-1].y});return out;}
function blob(cx,cy,rx,ry,rot,irr,noise,k){const pts=[],n=40;for(let i=0;i<n;i++){const a=i/n*Math.PI*2;
  const m=1-irr/2+irr*noise(Math.cos(a)*1.3+k,Math.sin(a)*1.3+k*1.7);const lx=Math.cos(a)*rx*m,ly=Math.sin(a)*ry*m;
  pts.push({x:cx+lx*Math.cos(rot)-ly*Math.sin(rot),y:cy+lx*Math.sin(rot)+ly*Math.cos(rot)});}return pts;}
function bbox(p){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const q of p){x0=Math.min(x0,q.x);y0=Math.min(y0,q.y);x1=Math.max(x1,q.x);y1=Math.max(y1,q.y);}return{x0,y0,x1,y1,w:x1-x0,h:y1-y0};}
function inPoly(p,x,y){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if(((a.y>y)!==(b.y>y))&&(x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x))c=!c;}return c;}
function polyLen(p){let s=0;for(let i=1;i<p.length;i++)s+=dist(p[i-1],p[i]);return s;}
const PRE=['Mar','Vel','Ost','Kal','Lis','Dor','Hel','Tor','Bran','Sel','Rau','Wen','Kor','Alt','Zel','Grun','Pol','Ves'];
const SUF=['nach','den','berg','ova','itz','ford','heim','ec','ina','au','stadt','ice','ow','by','ach','en'];
const fmt=s=>{s=Math.max(0,Math.ceil(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};

