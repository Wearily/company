// COMPANY · src/ui/input.js
// Camera, pointer, touch and keyboard input.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
const cam={x:0,y:0,z:.5};let vw=0,vh=0,dpr=1;
function resize(){const r=cv.getBoundingClientRect();vw=r.width;vh=r.height;dpr=Math.min(2,window.devicePixelRatio||1);cv.width=Math.round(vw*dpr);cv.height=Math.round(vh*dpr);clampCam();}
// the furthest zoom out shows a band of the scenery ring all round (it reaches 896 px east-west and 600 px north-south)
// The camera treats the battlefield and the scenery ring around it as one map: it pans and zooms the same everywhere
// and stops only at the ring's outer edge (EXT, a little inside it). Zooming out stops at 0.7 of the battlefield's fit
// level, or sooner if the screen's shape would otherwise show past the ring.
const EXT={x0:-OUT.mx+16,y0:-OUT.my+16,x1:W+OUT.mx-16,y1:H+OUT.my-16};
const minZ=()=>Math.max(Math.min(vw/W,vh/H)*.7,vw/(EXT.x1-EXT.x0),vh/(EXT.y1-EXT.y0));
function fit(){cam.z=Math.min(vw/W,vh/H)*1.02;cam.x=(W-vw/cam.z)/2;cam.y=(H-vh/cam.z)/2;clampCam();}
function clampCam(){cam.z=clamp(cam.z,minZ(),4);const ww=vw/cam.z,hh=vh/cam.z;
  cam.x=ww>=EXT.x1-EXT.x0?(EXT.x0+EXT.x1-ww)/2:clamp(cam.x,EXT.x0,EXT.x1-ww);
  cam.y=hh>=EXT.y1-EXT.y0?(EXT.y0+EXT.y1-hh)/2:clamp(cam.y,EXT.y0,EXT.y1-hh);}
const ws=(x,y)=>[(x-cam.x)*cam.z,(y-cam.y)*cam.z];
const s2w=(sx,sy)=>({x:cam.x+sx/cam.z,y:cam.y+sy/cam.z});
function zoomAt(sx,sy,f){const w=s2w(sx,sy);cam.z=clamp(cam.z*f,minZ(),4);cam.x=w.x-sx/cam.z;cam.y=w.y-sy/cam.z;clampCam();}
const unitR=()=>clamp(4.5+3.2*cam.z,5.5,11);
function pick(sx,sy){let best=null,bd=(unitR()+7)**2;for(const u of mine()){const [x,y]=ws(u.x,u.y),d=(x-sx)**2+(y-sy)**2;if(d<bd){bd=d;best=u;}}return best;}
function clearSel(){for(const u of mine())u.sel=false;}
function orderAt(sx,sy,shift,direct){const w=s2w(sx,sy);
  // past the border is scenery: no orders, strikes, pontoons or repairs there
  if(w.x<0||w.y<0||w.x>W||w.y>H)return;if(G.orderMode==='air'){if(G.phase==='play')airAt(w.x,w.y);return;}
  const sel=selected();if(!sel.length)return;
  const queue=shift&&G.phase==='play'&&(G.orderMode==='move'||G.orderMode==='amove');
  const dir=direct&&G.phase==='play'&&(G.orderMode==='move'||G.orderMode==='amove');
  if(act({k:'order',ids:sel.map(u=>u.id),x:w.x,y:w.y,mode:G.orderMode,direct:dir,queue}))G.marks.push({x:w.x,y:w.y,t:.7,mode:G.phase==='deploy'?'move':G.orderMode,direct:dir});}
// an air strike where the player clicked (the mode goes back to move after one strike)
function airAt(x,y){const a=act({k:'air',x,y});if(a)G.marks.push({x:a.x,y:a.y,t:.7,mode:'air'});setMode('move');}
// hold the selected units
function holdSel(){const sel=selected();if(sel.length)act({k:'hold',ids:sel.map(u=>u.id)});}
// Click a unit to select it (Shift adds or removes it); click the map to order the selection (Shift queues the order).
function clickAt(sx,sy,shift){if(G.orderMode==='air'&&G.phase==='play')return orderAt(sx,sy);const u=pick(sx,sy);
  if(u){if(!shift)clearSel();u.sel=shift?!u.sel:true;selectionChanged();}
  else if(selected().length&&(G.phase==='play'||G.phase==='deploy'))orderAt(sx,sy,shift);}
function tapAt(sx,sy){if(G.orderMode==='air'&&G.phase==='play')return orderAt(sx,sy);const u=pick(sx,sy);if(u){u.sel=!u.sel;selectionChanged();}else if(selected().length)orderAt(sx,sy);}
// An order mode that needs a unit type the selection doesn't have (engineers for pontoon and repair, artillery for a
// fire mission) drops back to move when the selection changes. The player can pick the mode again afterwards.
function selectionChanged(){const sel=selected();if(!G||!sel.length)return;const m=G.orderMode;
  if((m==='repair'||m==='bridge')&&!sel.some(u=>u.type==='eng'))setMode('move');
  else if(m==='fire'&&!sel.some(u=>u.type==='art'))setMode('move');}
const ptrs=new Map();let drag=null,tdraw=null;
function startTrench(p){tdraw=[];tdraw.budget0=G.budget;addTrenchPt(s2w(p.x,p.y));drag={kind:'trench'};}
function addTrenchPt(w){if(!tdraw||!inZone(w.x,w.y)||M.water(w.x,w.y))return;const last=tdraw[tdraw.length-1];
  if(last){const d=dist(last,w);if(d<12||d>G.budget)return;if(d>40){tdraw.push(null);}G.budget-=d;}tdraw.push({x:w.x,y:w.y});updateBudget();}
function endTrench(){if(!tdraw)return;let cur=[];const parts=[];for(const p of tdraw){if(!p){if(cur.length>1)parts.push(cur);cur=[];}else cur.push(p);}if(cur.length>1)parts.push(cur);
  if(!act({k:'trench',parts,spent:tdraw.budget0-G.budget,live:true}))G.budget=tdraw.budget0;
  tdraw=null;updateBudget();}
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);const p={x:e.offsetX,y:e.offsetY,sx:e.offsetX,sy:e.offsetY,moved:false};ptrs.set(e.pointerId,p);
  if(!G||G.phase==='over'||!$('startModal').hidden){drag={kind:'pan'};return;}
  const deployTrench=G.tool==='trench'&&G.phase==='deploy'&&G.player==='D';
  if(e.pointerType==='touch'){if(ptrs.size===2){if(drag&&drag.kind==='trench')endTrench();const [a,b]=[...ptrs.values()];
      drag={kind:'pinch',d0:Math.hypot(a.x-b.x,a.y-b.y),z0:cam.z,w:s2w((a.x+b.x)/2,(a.y+b.y)/2)};}
    else if(ptrs.size===1)deployTrench?startTrench(p):(drag={kind:'tpan'});return;}
  if(e.button===0&&!e.ctrlKey&&!e.metaKey)deployTrench?startTrench(p):(drag={kind:'box',x0:p.x,y0:p.y,x1:p.x,y1:p.y});
  else drag={kind:'rpan',btn:e.button===0?2:e.button,direct:e.ctrlKey||e.metaKey};});
// the mouse position over the map, for previews such as the air strike ring
let hoverPt=null;cv.addEventListener('pointerleave',()=>{hoverPt=null;});
cv.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')hoverPt={x:e.offsetX,y:e.offsetY};});
cv.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p)return;const dx=e.offsetX-p.x,dy=e.offsetY-p.y;p.x=e.offsetX;p.y=e.offsetY;
  if(Math.hypot(p.x-p.sx,p.y-p.sy)>6)p.moved=true;if(!drag)return;
  if(drag.kind==='pinch'){if(ptrs.size<2)return;const [a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    cam.z=clamp(drag.z0*d/Math.max(1,drag.d0),minZ(),4);cam.x=drag.w.x-mx/cam.z;cam.y=drag.w.y-my/cam.z;clampCam();}
  else if(drag.kind==='pan'||drag.kind==='tpan'||drag.kind==='rpan'){if(p.moved){cam.x-=dx/cam.z;cam.y-=dy/cam.z;clampCam();}}
  else if(drag.kind==='box'){drag.x1=p.x;drag.y1=p.y;}
  else if(drag.kind==='trench')addTrenchPt(s2w(p.x,p.y));});
function pointerEnd(e){const p=ptrs.get(e.pointerId);ptrs.delete(e.pointerId);if(!p||!drag)return;
  if(drag.kind==='box'){if(p.moved){const x0=Math.min(drag.x0,drag.x1),x1=Math.max(drag.x0,drag.x1),y0=Math.min(drag.y0,drag.y1),y1=Math.max(drag.y0,drag.y1);
      if(!e.shiftKey)clearSel();for(const u of mine()){const [x,y]=ws(u.x,u.y);if(x>=x0&&x<=x1&&y>=y0&&y<=y1)u.sel=true;}selectionChanged();}else clickAt(p.x,p.y,e.shiftKey);}
  else if(drag.kind==='rpan'){if(!p.moved&&drag.btn===2)orderAt(p.x,p.y,e.shiftKey,drag.direct);}
  else if(drag.kind==='tpan'){if(!p.moved)tapAt(p.x,p.y);}
  else if(drag.kind==='trench')endTrench();
  else if(drag.kind==='pinch'){drag=ptrs.size?{kind:'none'}:null;return;}
  if(!ptrs.size)drag=null;}
cv.addEventListener('pointerup',pointerEnd);cv.addEventListener('pointercancel',pointerEnd);
cv.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.offsetX,e.offsetY,Math.exp(-e.deltaY*(e.ctrlKey?.01:.0015)));},{passive:false});
// double-click a unit to select every unit of its type; any click on the map closes an open popover
cv.addEventListener('dblclick',e=>{if(!G||G.phase==='over'||G.replay||!$('startModal').hidden)return;const u=pick(e.offsetX,e.offsetY);if(!u)return;if(!e.shiftKey)clearSel();mine().forEach(v=>{if(v.type===u.type)v.sel=true;});selectionChanged();updateHUD();});
cv.addEventListener('pointerdown',()=>closePops());
addEventListener('resize',()=>{scaleAnchor();if(G)updateHUD(true);});
const keys=new Set();
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;keys.add(e.key);const k=e.key.toLowerCase();
  if(!$('startModal').hidden){if(k==='escape'&&G&&G.phase!=='over')$('optResume').onclick();return;}
  if(!G)return;
  // T opens the chat in a multiplayer battle
  if(k==='t'&&!e.metaKey&&!e.ctrlKey&&G.mp&&openChat()){e.preventDefault();keys.delete(e.key);return;}
  // Esc closes an open popover first; ? opens Controls; U hides or shows the whole interface
  if(k==='escape'&&closePops())return;
  if(k==='escape'&&ui.modsG){ui.modsG=false;updateHUD(true);return;}
  if(e.key==='?'){e.preventDefault();togglePop('helpModal',$('btnHelp'));return;}
  if(k==='u'&&!e.metaKey&&!e.ctrlKey){toggleUI();return;}
  if(RP){if(e.code==='Space'){e.preventDefault();rpToggle();}else if(e.key==='.'||e.key==='>')rpSpeedStep(1);else if(e.key===','||e.key==='<')rpSpeedStep(-1);
    else if(e.key==='[')rpSeek(RP.t-15);else if(e.key===']')rpSeek(RP.t+15);else if(e.key==='Home')rpSeek(0);else if(e.key==='Escape')exitReplay();return;}
  if(e.metaKey||e.ctrlKey){if(k==='a'){e.preventDefault();mine().forEach(u=>u.sel=true);selectionChanged();}
    else if(k==='z'&&!e.shiftKey){e.preventDefault();act({k:'undo'});}return;}
  if(e.code==='Space'){e.preventDefault();togglePause();}
  else if(k==='m')setMode('move');else if(k==='a')setMode('amove');else if(k==='f')setMode('fire');else if(k==='p')setMode('bridge');else if(k==='x')setMode('air');else if(k==='r')setMode('repair');else if(k==='h')holdSel();
  else if(k==='s')toggleSup();else if(k==='q'){mine().forEach(u=>u.sel=true);selectionChanged();}
  else if(k==='o')toggleSetting('arrows');else if(k==='v')toggleSetting('fog');else if(k==='y')setView(settings.style==='paper'?'satellite':'paper');
  else if(k==='escape'){clearSel();setMode('move');setTool(null);updateHUD();}
  else if(k==='1'||k==='2'||k==='3')setSpeed([1,2,4][+k-1]);
  // . and , step the speed up and down
  else if(e.key==='.'||e.key==='>'||e.key===','||e.key==='<'){const sp=[1,2,4],i=Math.max(0,sp.indexOf(G.speed)),up=e.key==='.'||e.key==='>';setSpeed(sp[clamp(i+(up?1:-1),0,2)]);}
  else if(k==='l')toggleFront();
  else if(k==='+'||k==='=')zoomAt(vw/2,vh/2,1.2);else if(k==='-')zoomAt(vw/2,vh/2,1/1.2);});
// Space on a focused button would click it on keyup and undo the pause toggle
addEventListener('keyup',e=>{keys.delete(e.key);if(e.code==='Space'&&e.target.tagName==='BUTTON')e.preventDefault();});
addEventListener('blur',()=>keys.clear());
// the hint banner fades while the mouse is over or near it, so it never hides units underneath
addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;const b=$('banner');if(b.hidden)return;const r=b.getBoundingClientRect(),m=40;
  b.classList.toggle('faded',e.clientX>r.left-m&&e.clientX<r.right+m&&e.clientY>r.top-m&&e.clientY<r.bottom+m);});

