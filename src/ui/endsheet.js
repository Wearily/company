// COMPANY · src/ui/endsheet.js
// The end-of-battle sheet and resuming a game.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
// the end screen: the finished game's settings, so someone else can play the same battle
$('endURL').onclick=()=>{if(!G)return;const b=$('endURL'),o={scen:G.scen,mode:G.mode,climate:G.climate,side:G.player,strength:G.strength,diff:G.diff,seed:G.seed,gen2:G.gen2};
  copyText(gameURL(o),ok=>{const tip=$('tip');b.dataset.tip=ok?'Game URL copied':'Couldn’t copy the URL';tip.textContent=b.dataset.tip;const r=b.getBoundingClientRect(),ar=$('app').getBoundingClientRect();
    tip.hidden=false;tip.style.left=(r.left-ar.left+r.width/2-tip.offsetWidth/2)+'px';tip.style.top=(r.top-ar.top-tip.offsetHeight-8)+'px';
    setTimeout(()=>{b.dataset.tip='Copy game URL: a link that opens this game\'s settings';tip.hidden=true;},1600);});};
renderScens();
$('optSeed').onchange=()=>{const v=parseInt($('optSeed').value,10);if(v>0){opts.seed=v;preview();}};
$('optReroll').onclick=()=>{opts.seed=1+Math.floor(Math.random()*99999);preview();};
$('optStart').onclick=()=>{if(L.role)mpLeave();newGame({...opts});};
// (a multiplayer battle never pauses: it is the other player's battle too)
function showStart(){if(G&&G.phase==='play'&&!G.mp)G.paused=true;closePops();$('endModal').hidden=true;const back=!G||G.phase==='over';$('optResume').hidden=back;$('ngClose').hidden=back;
  $('startModal').hidden=false;renderMods();updateHUD(true);}
// (in a multiplayer battle it asks before leaving, which means surrendering; after it, it brings back the end sheet)
$('btnMenu').onclick=()=>{if(G&&G.mp&&L.inGame&&!G.replay){if(G.phase==='over')$('endModal').hidden=false;else openQuit();return;}showStart();};
// a map previewed from the menu replaces M, so restore the game's own map before resuming
$('optResume').onclick=$('ngClose').onclick=()=>{if(!G||G.phase==='over')return;const same=M.seed===G.seed&&M.mode===G.mode&&genV(M.gen2)===genV(G.gen2);if(!same||M.climate!==G.climate){if(!same)M=makeMap(G.seed,G.mode,G.gen2);setClimate(G.climate);renderTerrain();rebuildTrenchMask();M.dmg=G.dmg;applyCrossings();}
  $('startModal').hidden=true;$('startModal').classList.remove('showmap');updateHUD(true);};
$('ngShowMap').onclick=()=>{const on=$('startModal').classList.toggle('showmap');$('ngShowMapT').textContent=on?'Hide Map':'Show Map';renderSettings();scaleAnchor();};
$('zoomIn').onclick=()=>zoomAt(vw/2,vh/2,1.25);$('zoomOut').onclick=()=>zoomAt(vw/2,vh/2,1/1.25);$('zoomFit').onclick=fit;
// (after a multiplayer battle it's Back to Lobby, for a rematch)
$('endReplay').onclick=()=>G&&G.mp?mpToLobby():newGame({side:G.player,strength:G.strength,seed:G.seed,mode:G.mode,gen2:G.gen2,diff:G.diff,climate:G.climate,scen:G.scen});
// (after a multiplayer battle, both leave the session: a rematch from the lobby comes later)
$('endNew').onclick=()=>{if(L.role)mpLeave();opts.seed=1+Math.floor(Math.random()*99999);preview();$('endModal').hidden=true;$('optResume').hidden=true;$('ngClose').hidden=true;$('startModal').hidden=false;updateHUD(true);};
// the end-of-battle sheet
function showEnd(winner,reason){const me=G.player,them=me==='A'?'D':'A',win=winner===me,draw=winner===null;
  $('endIcon').className='resIc'+(draw?' draw':win?'':' loss');$('endIcon').innerHTML=draw?ICON.equal:win?ICON.check:ICON.cross;
  $('endTitle').textContent=draw?'Draw':win?'Victory':'Defeat';$('endReason').textContent=reason;
  $('endRings').innerHTML=G.objs.map(o=>ring(o,30)).join('');$('endRings').setAttribute('aria-label',G.objs.map(o=>`${o.key} ${ownerLabel(o)[0]}`).join(', '));
  const n=G.objs.filter(o=>o.owner==='A').length;
  $('endStats').innerHTML=`<div class="tiles3"><div class="grp"><div class="s2">Battle time</div><b class="tn">${fmt(G.time)}</b></div><div class="grp"><div class="s2">Your losses</div><b class="tn">${G.stats.lost[me]}</b></div><div class="grp"><div class="s2">Enemy losses</div><b class="tn" style="color:${them==='D'?'var(--defender-text)':'var(--ink)'}">${G.stats.lost[them]}</b></div></div>
    <div class="grp" style="margin-bottom:16px">${G.econ?`<div class="rw"><span>Victory points</span><span class="s2 tn">You ${Math.ceil(G.econ[me].vp)} · Them ${Math.ceil(G.econ[them].vp)}</span></div><div class="rw"><span>Units built</span><span class="s2 tn">You ${G.econ[me].built} · Them ${G.econ[them].built}</span></div><div class="rw"><span>You spent</span><span class="s2 tn">${Math.round(G.econ[me].spent.mp)} manpower · ${Math.round(G.econ[me].spent.fuel)} fuel</span></div>`
      :`<div class="rw"><span>Objectives held by attacker</span><span class="s2 tn">${n} of 3</span></div>`}<div class="rw"><span>Scenario</span><span class="s2">${SC().name}</span></div><div class="rw"><span>Battlefield</span><span class="s2">${MAP_MODES[G.mode].name}${genV(G.gen2)===2?' · old map':G.gen2?(M.look?' · '+M.look.name:''):' · legacy map'}</span></div><div class="rw"><span>Climate</span><span class="s2">${CLIMATES[G.climate].name}</span></div><div class="rw"><span>Difficulty</span><span class="s2">${DIFFICULTY[G.diff].name}</span></div></div>
    ${G.plan?`<div class="lb">The enemy’s plan</div><div class="grp planTx"><b>${G.plan.name}.</b> ${DOCTRINE_DESC[G.plan.key]||''}</div>`:''}`;
  $('endWatch').disabled=!(G.rec&&G.rec.frames.length>1);const inMp=!!(G.mp&&L.role);$('endReplay').hidden=!!G.mp&&!inMp;$('endReplay').textContent=inMp?'Back to Lobby':'Play Again';$('endNew').textContent=G.mp?'Leave':'New Map';closePops();$('endModal').hidden=false;updateHUD(true);}

