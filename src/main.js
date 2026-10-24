// COMPANY · src/main.js
// Startup and the frame loop. Loaded last: everything it starts is defined by the files before it.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
let last=performance.now(),acc=0,lastErr='';
// Schedule the next frame first and catch errors, so one bad frame pauses the game and reports it instead of freezing everything.
function frame(ts){requestAnimationFrame(frame);const dt=Math.min(.1,(ts-last)/1000);last=ts;
  try{
    const pan=600/cam.z*dt;if(keys.has('ArrowLeft'))cam.x-=pan;if(keys.has('ArrowRight'))cam.x+=pan;if(keys.has('ArrowUp'))cam.y-=pan;if(keys.has('ArrowDown'))cam.y+=pan;if(keys.size)clampCam();
    if(RP){if(RP.playing&&!RP.drag){RP.t=Math.min(RP.end,RP.t+dt*RP.speed);if(RP.t>=RP.end)RP.playing=false;}replayView(RP.t);drawTimelineHead();}
    if(G&&G.phase==='deploy'&&ts-(G._supT||0)>500){G._supT=ts;computeSupply('A');computeSupply('D');}
    if(G&&G.phase==='deploy'&&settings.front&&ts-(G._frontT||0)>500){G._frontT=ts;G.ctrl=null;updateFront();frontShape(true);}
    if(G){if(G.phase==='play'&&!G.paused&&!G.mpHold&&(G.mp||!modalOpen())&&!(G.mp&&G.mp.role==='guest')){acc+=dt*G.speed;let n=0;while(acc>=STEP&&n<16){step(STEP);acc-=STEP;n++;}if(n>=16)acc=0;}else acc=0;
      if(G.mp)mpFrame(dt);
      for(const m of G.marks)m.t-=dt;G.marks=G.marks.filter(m=>m.t>0);
      if(ts-lastHud>200){lastHud=ts;updateHUD();}}
    draw();/* if(G&&$('callouts').firstChild)placeCallouts(); */
  }catch(err){reportFrameError(err);}}
function reportFrameError(err){console.error(err);const msg=String(err&&err.message||err);if(G&&G.phase==='play'&&!G.mp)G.paused=true;
  if(msg!==lastErr){lastErr=msg;addLog('Error: '+msg,'a');}}
addEventListener('resize',resize);
try{const m=gameCode(),o=m&&decodeGame(decodeURIComponent(m));
  if(o){Object.assign(opts,o);syncSegs();
    renderModes();renderClimates();renderScens();$('codeMsg').textContent='Game options loaded from the link. Press Start to play.';}}catch(e){}
// a code typed or pasted into the address bar (only the #game= part changing) opens New game with it, without a reload
addEventListener('hashchange',()=>{const m=gameCode(),o=m&&decodeGame(decodeURIComponent(m));if(!o||encodeGame(o)===encodeGame(opts))return;
  if($('startModal').hidden)showStart();applyOptions(o);$('codeMsg').textContent='Game options loaded from the link. Press Start to play.';});
initReplayUI();applyAppearance();applyLayout();renderSettings();
// Show the interface as soon as it's filled in, then build and draw the preview map behind the New game sheet once the
// sheet has painted (the map takes a second or so); the map fades in with its first frame. A battle started in that
// moment builds its own map, so the preview is skipped then.
resize();$('optSeed').value=opts.seed;syncCode();document.documentElement.classList.add('ready');
requestAnimationFrame(()=>setTimeout(()=>{if(!G){preview();fit();}scaleAnchor();requestAnimationFrame(frame);mpCheckLink();
  requestAnimationFrame(()=>document.documentElement.classList.add('mapready'));},0));
