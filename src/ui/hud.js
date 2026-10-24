// COMPANY · src/ui/hud.js
// The HUD overlay: preferences, layouts, status, rings, the selection card, popovers, settings.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
// The HUD is a DOM overlay on the canvas, built from the company-hud handoff: frosted-glass capsules over the map
// (Floating, the default) or bars docked to the screen edges (Docked), in Light or Dark. Every panel collapses to a pill,
// an icon or an edge tab. It only reads game state and calls the order functions.
const $=id=>document.getElementById(id);
function addLog(msg,cls){if(!G||G.replay)return;const c=cls==='a'?'a':cls==='d'?'d':'';if(G.rec)G.rec.log.push({t:G.time,msg,cls:c});G.log.unshift({t:G.time,msg,cls:c});if(G.log.length>40)G.log.length=40;G.logDirty=true;}
let lastHud=0,lastLogC=null,lastLogNew=null;
// set innerHTML only when it changed, so hover states and focus survive the 5-per-second refresh
const setH=(el,h)=>{if(el._h!==h){el._h=h;el.innerHTML=h;}};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MAC=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent||'');
const phone=()=>vw<600;
const TNAME={inf:'Infantry',tank:'Armor',art:'Artillery',eng:'Engineers'};
const UPATH={inf:'<circle cx="8" cy="8" r="6.3"/>',tank:'<rect x="2" y="2" width="12" height="12"/>',art:'<path d="M8 1.5L15 14H1z"/>',eng:'<path d="M8 1l6.2 3.5v7L8 15l-6.2-3.5v-7z"/>'};
const uIco=(t,s,px=12)=>`<svg class="ui ${s}" width="${px}" height="${px}" viewBox="0 0 16 16" aria-hidden="true">${UPATH[t]}</svg>`;
const ICON={pause:'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2.5" width="3.2" height="11" rx="1.2" fill="currentColor"/><rect x="9.3" y="2.5" width="3.2" height="11" rx="1.2" fill="currentColor"/></svg>',
  play:'<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.5 2.8v10.4c0 .5.6.9 1 .6l8-5.2c.4-.3.4-.9 0-1.2l-8-5.2c-.4-.3-1 0-1 .6z"/></svg>',
  down:'<svg class="chev" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>',
  up:'<svg class="chev more" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10l4-4 4 4"/></svg>',
  left:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5"/></svg>',
  check:'<svg width="26" height="26" viewBox="0 0 20 20" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 10.5l3.6 3.6 7.4-8"/></svg>',
  cross:'<svg width="26" height="26" viewBox="0 0 20 20" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/></svg>',
  equal:'<svg width="26" height="26" viewBox="0 0 20 20" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 8h10M5 12.5h10"/></svg>',
  tick:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg>'};
// what the enemy's plan was, for the end of battle (the doctrines planAttack draws from)
const DOCTRINE_DESC={broad:'All three crossings attacked at once.',feint:'A diversion at one crossing, then the main body at another.',
  hook:'A pinning group at the main bridge while the main body went round a flank.',bombard:'Artillery first, then two late waves.',
  crossing:'Engineers bridged the river far from the bridges while the main body waited.',probe:'Three small probes, with the reserve sent in behind the one that got furthest.'};

// Interface preferences: layout and appearance, which panels are collapsed, which sections are open. Kept between
// battles, and between visits where the browser allows it.
const ui={layout:'floating',appearance:'light',panel:'auto',left:false,tab:'sel',sec:{objs:true,forces:true,mods:true},
  compact:{scen:false,status:false,bottom:false,log:false,mods:false},hidden:false,dots:new Set()};
try{const s=JSON.parse(localStorage.getItem('company.ui')||'null');if(s){for(const k of ['layout','appearance','left'])if(k in s)ui[k]=s[k];Object.assign(ui.sec,s.sec||{});Object.assign(ui.compact,s.compact||{});}}catch(e){}
function saveUI(){try{localStorage.setItem('company.ui',JSON.stringify({layout:ui.layout,appearance:ui.appearance,left:ui.left,sec:ui.sec,compact:ui.compact}));}catch(e){}}
const darkMQ=window.matchMedia?matchMedia('(prefers-color-scheme: dark)'):{matches:false};
function applyAppearance(){document.documentElement.dataset.appearance=ui.appearance==='auto'?(darkMQ.matches?'dark':'light'):ui.appearance;if(RP)buildTimeline();}
try{darkMQ.addEventListener('change',()=>{if(ui.appearance==='auto')applyAppearance();});}catch(e){}
// Floating keeps each piece in its own capsule; Docked moves the same pieces into the top bar and the two side bars.
function applyLayout(){const d=ui.layout==='docked',hud=$('hud');document.documentElement.dataset.layout=ui.layout;
  if(d){$('barL').appendChild($('scenCard'));$('barC').appendChild($('status'));$('barR').appendChild($('ctrls'));
    $('sideL').append($('secObjs'),$('secForces'),$('secMods'));$('sideR').appendChild($('secSel'));}
  else{const lc=$('leftcol');lc.insertBefore($('scenCard'),lc.firstChild);hud.insertBefore($('status'),$('banner'));hud.insertBefore($('ctrls'),$('banner'));
    $('inspector').append($('secSel'),$('secObjs'),$('secMods'));$('forcesCard').append($('secForces'));}
  updateHUD(true);}

// an objective's ring: the owner's colour, filled as far as the owner's hold on it; orange while it's being taken
const takeFrac=o=>o.owner==='D'?(1-o.p)/2:o.owner==='A'?(1+o.p)/2:Math.abs(o.p);
function ring(o,px=30){const r=12.5,C=2*Math.PI*r,arc=(col,f)=>`<circle cx="15" cy="15" r="${r}" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="${f<1?'round':'butt'}" stroke-dasharray="${(clamp(f,.04,1)*C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 15 15)"/>`;
  let body,txt='var(--ink)';
  if(o.contested)body=`<circle cx="15" cy="15" r="${r}" fill="none" stroke="var(--track)" stroke-width="3"/>`+arc('var(--contested)',takeFrac(o));
  else if(o.owner==='N')body=`<circle cx="15" cy="15" r="${r}" fill="none" stroke="var(--neutral)" stroke-width="2.5" stroke-dasharray="2 3"/>`;
  else{const A=o.owner==='A',f=A?(1-o.p)/2:(1+o.p)/2;body=`<circle cx="15" cy="15" r="${r}" fill="${A?'var(--atk-disc)':'none'}" stroke="var(--track)" stroke-width="3"/>`+arc(A?'var(--atk-ring)':'var(--defender-ring)',f);if(A)txt='var(--atk-letter)';}
  return `<svg width="${px}" height="${px}" viewBox="0 0 30 30" aria-hidden="true">${body}<text x="15" y="19.5" text-anchor="middle" font-family="Inter, sans-serif" font-size="12.5" font-weight="700" fill="${txt}">${o.key}</text></svg>`;}
function ownerLabel(o){const pc=Math.round(takeFrac(o)*100);if(o.contested)return [pc?`Contested · ${pc}%`:'Contested','C'];if(o.owner==='N')return ['Neutral','N'];
  if(!G.replay&&o.owner===G.player)return ['Yours',o.owner];return [o.owner==='A'?'Attacker':'Defender',o.owner];}
const nextReinf=()=>(SC().reinf||[]).map((r,k)=>({r,k})).find(({r,k})=>r.side===G.player&&!G.reinfDone.has(k));
function panToObj(i){const o=G.objs[i];if(!o)return;cam.x=o.x-vw/2/cam.z;cam.y=o.y-vh/2/cam.z;clampCam();}

function updateHUD(force){
  document.body.classList.toggle('nogame',!G);document.body.classList.toggle('ngopen',!$('startModal').hidden);document.body.classList.toggle('endopen',!$('endModal').hidden);
  if(!G){scaleAnchor();return;}
  const me=G.player,them=me==='A'?'D':'A',sc=SC(),rp=!!G.replay,dep=G.phase==='deploy',play=G.phase==='play',docked=ui.layout==='docked';
  const sel=rp?[]:selected(),ns=sel.length,compactTop=ui.compact.status||phone();
  // scenario card: who you are, the goal, and the game code
  const word=G.over?(G.over.winner===null?'Draw':G.over.winner===me?'Victory':'Defeat'):'';
  const badge=rp?['Replay','R']:[me==='A'?'Attacking':'Defending',me];
  for(const id of ['sideBadge','sideBadge2']){const b=$(id);b.textContent=badge[0];b.className='side-badge '+badge[1];}
  $('scenName').textContent=sc.name;
  $('goalCard').textContent=rp?`${word} · ${G.over.reason}`:sc.goal[me];
  const meta=`${MAP_MODES[G.mode].name} · ${CLIMATES[G.climate].name} · ${G.code||''}`;$('sector').textContent=`${sc.name} · ${meta}`;$('sector2').textContent=meta;
  $('scenCard').hidden=!docked&&ui.compact.scen;if(docked)delete $('scenCard').dataset.tip;else $('scenCard').dataset.tip='Collapse';$('scenPill').hidden=docked||!ui.compact.scen;
  // status capsule: the clock, the three objectives, and the next reinforcements or the A hold timer
  const st=$('status'),cmp=compactTop&&!docked;st.classList.toggle('compact',cmp);
  let extra='',plus='';
  const nx=nextReinf();
  if(sc.holdA&&G.holdA>0){extra=`<b class="tn">${fmt(G.holdA)} / ${fmt(sc.holdA)}</b><span>attacker holding A</span>`;plus=`A ${fmt(G.holdA)}`;}
  else if(nx&&!rp){extra=`<b class="tn">${fmt(nx.r.t-G.time)}</b><span>reinforcements</span>`;plus='+'+fmt(nx.r.t-G.time);}
  const clock=dep?'':fmt(G.limit-G.time);
  if(cmp)setH(st,`<b class="tn" style="font-size:17px;font-weight:600;letter-spacing:-.02em">${dep?'Deployment':clock}</b><span class="rings">${G.objs.map(o=>ring(o,24)).join('')}</span>${plus?`<span class="plus tn">${plus}</span>`:''}${ICON.down}`);
  else setH(st,(dep?`<button class="clk dep" data-act="collapse" data-tip="Collapse"><b>Deployment</b><span class="tn">Clock starts at ${fmt(G.limit)}</span></button>`
      :`<button class="clk" data-act="collapse" data-tip="Collapse"><b class="tn">${clock}</b><span>remaining</span></button>`)+'<span class="dv"></span>'+
    G.objs.map((o,i)=>{const [l,c]=ownerLabel(o);return `<button class="bt obj" data-obj="${i}" aria-label="Objective ${o.key}, ${esc(o.name)}, ${l}" data-tip="${esc(o.name)} · ${l}">${ring(o)}<span class="on2"><span>${esc(o.name)}</span><span class="st ${c}">${l}</span></span></button>`;}).join('')+
    (extra?`<span class="dv"></span><div class="xtra">${extra}</div>`:''));
  st.setAttribute('aria-label',`${dep?'Deployment':clock+' remaining'}. ${G.objs.map(o=>o.key+' '+ownerLabel(o)[0]).join(', ')}`);
  // top-right controls
  $('ctrls').classList.toggle('compact',compactTop&&!docked);
  // (in multiplayer only a host given the time controls can pause or change speed; without them the speed is hidden)
  const tc=timeCtl(),pb=$('btnPause');setH(pb,G.paused?ICON.play:ICON.pause);pb.disabled=!play||!tc;pb.dataset.tip=G.paused?(G.time<1?'Start':'Resume'):'Pause';pb.setAttribute('aria-label',pb.dataset.tip+' (Space)');
  document.querySelectorAll('#speed button').forEach(b=>{b.disabled=!play||!tc;b.classList.toggle('on',+b.dataset.s===G.speed);});$('btnSpeedC').disabled=!play||!tc;$('btnSpeedC').textContent=G.speed+'×';
  const noSpeed=!!(G.mp&&!G.mp.hostTime);$('speed').style.display=noSpeed?'none':'';$('btnSpeedC').style.display=noSpeed?'none':'';
  // the inspector (Floating: the left panel; Docked: the right bar) opens with a selection unless you closed it; a new
  // battle starts with it folded ('folded'), and it stays folded until you open it from the rail
  if(ui.panel==='closed'&&!ns)ui.panel='auto';
  // (on a phone a selection doesn't pop the Selection sheet over another open sheet)
  const showInsp=!rp&&(ui.panel==='open'||(ui.panel==='auto'&&ns>0&&!(phone()&&(ui.forces||ui.modsG))));
  // Selection, Forces and Modifiers are separate cards beside the rail, each opened by its own rail button
  const showF=!rp&&!docked&&!!ui.forces;
  $('inspector').hidden=docked||!showInsp;$('forcesCard').hidden=!showF;$('rail').hidden=rp;
  {const bs=$('rail').querySelector('[data-open="sel"]'),bf=$('rail').querySelector('[data-open="forces"]');bs.classList.toggle('on',showInsp);bf.classList.toggle('on',showF);bs.setAttribute('aria-pressed',showInsp);bf.setAttribute('aria-pressed',showF);}
  $('sideR').classList.toggle('off',!showInsp);$('sideL').classList.toggle('off',rp||!ui.left);
  $('btnSideL').classList.toggle('on',ui.left);$('btnSideR').classList.toggle('on',showInsp);
  document.documentElement.style.setProperty('--logL',docked&&ui.left&&!rp?'272px':'0px');
  for(const s of ['objs','forces','mods'])$(s==='objs'?'secObjs':s==='forces'?'secForces':'secMods').classList.toggle('shut',!ui.sec[s]);
  // the Modifiers card; the docked outliner has its own Modifiers section
  {const open=!!ui.modsG&&!rp&&!docked;$('modsGame').hidden=!open;$('railMods').classList.toggle('on',open);$('railMods').setAttribute('aria-pressed',open);
    if(open||docked){const gm=gameMods();if(open){setH($('modsGameList'),gm.html);$('modsGameN').textContent=gm.n;}if(docked)setH($('modsSide'),gm.html);}}
  if(showInsp)setH($('panel'),selHTML(sel,me));
  // forces, the objectives list and the legend (in the Controls popover)
  const cnt=(side,f)=>{const o={inf:0,tank:0,art:0,eng:0};G.units.forEach(u=>{if(u.side===side&&f(u))o[u.type]++;});return o;};
  const own=cnt(me,()=>true),seen=rp?cnt(them,()=>true):cnt(them,u=>G.vis[me].has(u.id));
  const row=(o,s,all)=>{const ts=UNIT_TYPES.filter(t=>all||o[t]);return ts.length?`<span class="cnts tn ${s}">${ts.map(t=>`<span class="cnt">${uIco(t,s,10)}${o[t]}</span>`).join('')}</span>`:'<span class="s2">None</span>';};
  setH($('forces'),`<div class="rw"><span>${rp?(me==='A'?'Attacker':'Defender'):'Yours'}</span>${row(own,me,true)}</div><div class="rw"><span>${rp?(them==='A'?'Attacker':'Defender'):'Enemy in sight'}</span>${row(seen,them,false)}</div>
    <div class="rw"><span>Air strikes left</span><span class="tn" style="font-weight:600;color:var(--accent-text)">${G.air[me]}</span></div><div class="rw"><span>Losses</span><span class="tn s2">${rp?'Attacker':'You'} ${G.stats.lost[me]} · ${rp?'Defender':'Them'} ${G.stats.lost[them]}</span></div>`);
  if(docked){setH($('objList'),G.objs.map((o,i)=>{const [l,c]=ownerLabel(o);return `<button class="rw objRow" data-obj="${i}"><span>${ring(o,24)}${esc(o.name)}</span><span class="st ${c}" style="font-size:11.5px">${l}</span></button>`;}).join(''));$('goalLine').textContent=sc.goal[me];}
  setH($('legend'),`${UNIT_TYPES.map(t=>`<span>${uIco(t,me,12)}${TNAME[t]}</span>`).join('')}<span><svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true"><path d="M1 6l2.5-3 2.5 3 2.5-3 2.5 3 2.5-3" fill="none" stroke="#7a4a2a" stroke-width="1.6" stroke-linejoin="round"/></svg>Trench</span>
    <span><svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true"><path d="M1 5h14" stroke="#8e8e93" stroke-width="2"/><path d="M6 2.5l4 5M10 2.5l-4 5" stroke="var(--ink)" stroke-width="1.2"/></svg>Cratered road</span>${M.frozen?`
    <span style="grid-column:span 2"><svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true"><rect x=".5" y="1.5" width="15" height="7" rx="2" fill="#cfdae4" stroke="#8fa3b5"/><path d="M4 3.5l3 3M9 2.5l2 4" stroke="#8fa3b5" stroke-width=".8"/></svg>Ice: infantry and engineers only, exposed</span>`:''}
    <span style="grid-column:span 2"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="#ff3b30" stroke-width="1.6" stroke-dasharray="2.5 2"/></svg>Out of supply</span>`);
  // the command dock: select by type, the order tools (or the deployment tools), and the map overlays
  const mineAll=mine(),byType=cnt(me,()=>true),selType=t=>sel.some(u=>u.type===t);
  $('selAllN').textContent=mineAll.length;$('selPillN').textContent=mineAll.length;
  document.querySelectorAll('#selGrp [data-sel]').forEach(b=>{const t=b.dataset.sel;if(!TNAME[t])return;
    setH(b,`${uIco(t,me,14)}<span class="tn">${byType[t]}</span>`);b.disabled=!byType[t];b.classList.toggle('part',selType(t));b.setAttribute('aria-label',`Select ${TNAME[t].toLowerCase()}, ${byType[t]}${selType(t)?', '+sel.filter(u=>u.type===t).length+' selected':''}`);});
  $('selClear').hidden=!ns;
  const cb=ui.compact.bottom&&!docked&&!phone();$('selBar').hidden=cb;$('selPill').hidden=!cb;
  const md=$('modes');md.hidden=!play;md.classList.toggle('compact',cb);$('deployTools').hidden=!dep||me!=='D';
  const hasT=t=>sel.some(u=>u.type===t),air=G.air[me]||0;
  const can={move:ns>0,amove:ns>0,fire:hasT('art'),bridge:hasT('eng'),repair:hasT('eng'),air:air>0};
  document.querySelectorAll('#modes [data-mode]').forEach(b=>{const m=b.dataset.mode;b.disabled=!can[m];b.classList.toggle('on',can[m]&&G.orderMode===m);b.setAttribute('aria-pressed',b.classList.contains('on'));});
  $('btnHold').disabled=!ns;$('airLeft').textContent=air;$('airLeft').hidden=!air;
  const lt=$('btnOrdersCompact');lt.dataset.tip=cb?'Show labels':'Hide labels';lt.setAttribute('aria-label',lt.dataset.tip);lt.firstElementChild.style.transform=cb?'rotate(180deg)':'';
  $('btnSup').classList.toggle('on',!!G.showSup);$('btnFront').classList.toggle('on',!!settings.front);
  if(dep)updateBudget();
  // the hint: what a click on the map will do now
  const b=$('banner'),units=`${ns} selected unit${ns>1?'s':''}`;let lead='',bt='';
  // (in multiplayer the defender's deployment is timed, and both players see the clock)
  const dclk=G.mp&&G.mpDeploy!=null?` · ${fmt(G.mpDeploy)} left`:'';
  if(dep&&me!=='D'){lead='Deployment';bt='The defender is deploying. The battle starts when they’re ready'+dclk;}
  else if(dep){lead='Deployment';bt=(G.tool==='trench'?'Drag on the map to dig a trench':ns?`Click the map to place ${units}`:'Select units, click the map to place them north of the dashed line, then Begin Battle')+dclk;}
  else if(play){const om=G.orderMode,ne=sel.filter(u=>u.type==='eng').length,na=G.air[me];let hint;
    const name={move:'Move',amove:'Attack-move',fire:'Fire mission',bridge:'Pontoon',repair:'Repair road',air:'Air strike'}[om];
    if(om==='air')hint=na?`Click a target, or a bridge to destroy it · ${na} left`:'No air strikes left';
    else if(om==='repair')hint=ne?`Click cratered road to repair it with ${ne} engineer${ne>1?'s':''}`:'Select engineers, then click cratered road';
    else if(om==='bridge')hint=ne?`Click the river to build a pontoon bridge with ${ne} engineer${ne>1?'s':''}`:'Select engineers, then click the river';
    else hint=ns?`Click the map to ${{move:'move',amove:'attack-move',fire:'call a fire mission with'}[om]} ${units}${om==='move'||om==='amove'?' · Ctrl-click to go straight · Shift to queue':''}`:'Click a unit or drag a box to select';
    const special=om==='air'||om==='bridge'||om==='repair';
    if(G.paused&&G.mp&&G.mp.role==='guest'){lead='Paused';bt='The host has paused the battle';}
    else if(G.paused){lead='Paused';bt=`${ns||special?name+': '+hint:hint} · Space to ${G.time<1?'start':'resume'}`;}
    else if(ns||special){lead=name;bt=hint+(special?' · Esc to cancel':'');}}
  b.hidden=!bt||rp;setH(b,bt?`<b>${lead}</b><span class="s2"> · ${esc(bt)}</span>`:'');
  // the event log: white text on the map, newest at the bottom. Four lines show; it scrolls back through the last 40
  // events, and jumps back to the newest whenever a new one comes in (or it's collapsed or expanded)
  if(G.logDirty||force||lastLogC!==ui.compact.log){const jump=G.log[0]!==lastLogNew||lastLogC!==ui.compact.log;G.logDirty=false;lastLogC=ui.compact.log;lastLogNew=G.log[0];
    // the same message repeated within 2 s (several units cut off at once) shows once, with a count
    const L=[],lg=$('log');for(const l of G.log.slice().reverse()){const p=L[L.length-1];if(p&&p.msg===l.msg&&l.t-p.t<2)p.n++;else L.push({t:l.t,msg:l.msg,n:1});}
    lg.classList.toggle('compact',ui.compact.log);
    setH(lg,L.map((l,i)=>{const last=i===L.length-1;return `<li${last?` class="n" data-tip="${ui.compact.log?'Show events':'Collapse'}"`:''}><span class="t tn">${dep?'Setup':fmt(l.t)}</span><span>${esc(l.msg)}${l.n>1?` <span style="opacity:.75">×${l.n}</span>`:''}</span>${last?ICON.up:''}</li>`;}).join(''));
    if(jump)lg.scrollTop=lg.scrollHeight;}
  /* updateCallouts(); */scaleAnchor();}

// the selection inspector
function selHTML(sel,me){const close=`<button class="bt ic" data-act="closePanel" aria-label="Collapse inspector" data-tip="Collapse">${ICON.left}</button>`;
  if(!sel.length)return `<div class="selHd"><b>Nothing selected</b>${close}</div><div class="selNone">Click a unit or drag a box around several. Double-click a unit to select every unit of its type.</div>`;
  const c={inf:0,tank:0,art:0,eng:0};sel.forEach(u=>c[u.type]++);const hp=sel.reduce((s,u)=>s+u.hp/u.max,0)/sel.length,cut=sel.filter(u=>!u.sup).length,dug=sel.filter(dugIn).length;
  // best high-ground range bonus among the selection
  const hg=Math.max(...sel.map(u=>(u.type==='art'?HILL.artRange:HILL.range)*hillK(u.x,u.y)));
  const md=sel.some(u=>u.build)&&sel.every(u=>u.build||u.type!=='eng')?'bridging':sel.some(u=>u.repair)&&sel.every(u=>u.repair||u.type!=='eng')?'repairing':sel.every(u=>u.mode===sel[0].mode)?sel[0].mode:'mixed';
  const pct=Math.round(hp*100),hc=hp>.5?'var(--ok)':hp>.25?'var(--contested)':'var(--danger)',ice=sel.filter(onIce).length;
  return `<div class="selHd"><b class="tn">${sel.length} Selected</b>${close}</div>
    <div class="selTypes">${UNIT_TYPES.filter(t=>c[t]).map(t=>`<span>${uIco(t,me,13)}<b class="tn">${c[t]}</b><span class="s2">${TNAME[t]}</span></span>`).join('')}</div>
    <div class="selHp"><div><span class="s2">Average health</span><b class="tn">${pct}%</b></div><div class="bar6"><i style="width:${pct}%;background:${hc}"></i></div></div>
    <div class="secBody"><div class="grp">
      <div class="rw"><span>State</span><span class="s2">${{idle:'Ready',move:'Moving',amove:'Attacking',hold:'Holding',mixed:'Mixed',bridging:'Bridging',repairing:'Repairing'}[md]}</span></div>
      <div class="rw"><span>Supply</span>${cut?`<span class="warn" style="display:flex;align-items:center;gap:6px;font-weight:500"><span class="dot"></span>${cut} out of supply</span>`:`<span class="okt" style="display:flex;align-items:center;gap:6px;font-weight:500"><span class="dot" style="background:var(--ok)"></span>In supply</span>`}</div>
      <div class="rw"><span>Dug in</span><span class="s2 tn">${dug} of ${sel.length}</span></div>
      <div class="rw"><span>High ground</span><span class="s2">${hg>.05?`+${Math.round(hg*100)}% range`:'None'}</span></div>${ice?`
      <div class="rw"><span>On the ice</span><span class="tn" style="color:var(--contested-text);font-weight:500">${ice} of ${sel.length} · exposed</span></div>`:''}</div></div>`;}

// Callouts point at an objective that is being taken. Clicking one shrinks it to its dot.
// Turned off for now (the calls in updateHUD, frame and the #callouts click handler are commented out too).
/*
function updateCallouts(){const box=$('callouts'),sc=SC();let h='';
  if(G&&!G.replay)G.objs.forEach((o,i)=>{let t='',s='';
    if(sc.holdA&&i===0&&G.holdA>0){t=`Attacker holding ${o.name}`;s=`${fmt(G.holdA)} of ${fmt(sc.holdA)} to win`;}
    else if(o.contested){const taker=o.owner==='D'?'A':o.owner==='A'?'D':o.p<0?'A':'D';t=`${o.name} contested`;s=`${taker===G.player?'You are':'The enemy is'} taking it · ${Math.round(takeFrac(o)*100)}%`;}
    if(!t){ui.dots.delete(o.key);return;}
    h+=`<div class="callout${ui.dots.has(o.key)?' dot':''}" data-i="${i}"><div class="nub"></div><button class="gl" data-call="${o.key}" aria-label="${esc(t)}. ${esc(s)}"><span class="bang">!</span><span class="tx"><b>${esc(t)}</b><span>${esc(s)}</span></span></button></div>`;});
  setH(box,h);placeCallouts();}
function placeCallouts(){if(!G)return;for(const el of $('callouts').children){const o=G.objs[+el.dataset.i],[x,y]=ws(o.x,o.y),off=x<-40||y<-40||x>vw||y>vh;
  el.style.visibility=off?'hidden':'';el.style.transform=`translate(${Math.round(x+20)}px,${Math.round(y-17)}px)`;}}
*/

// where the canvas draws the scale bar: just above the command dock (or the replay bar)
let scaleAt=null;
function scaleAnchor(){const ar=$('app').getBoundingClientRect();
  if(!$('startModal').hidden||!$('endModal').hidden||!G||ui.hidden){scaleAt={x:vw-20,y:vh-(phone()?24:80)};return;}
  const el=RP?$('replayBar'):$('dock'),r=el.getBoundingClientRect();
  if(ui.layout==='docked'){scaleAt={x:vw-20-(RP||$('sideR').classList.contains('off')?0:272),y:r.top-ar.top-14};return;}
  scaleAt={x:(RP?vw-20:r.right-ar.left-4),y:r.top-ar.top-14};}

// popovers (Settings, Controls) and the More menu hang from the button that opened them
function closePops(){let any=false;for(const id of ['settingsModal','helpModal','moreMenu'])if(!$(id).hidden){$(id).hidden=true;any=true;}
  if($('scenCard').classList.contains('phoneOpen')){$('scenCard').classList.remove('phoneOpen');any=true;}
  for(const id of ['btnSettings','btnHelp','btnMore'])$(id).classList.remove('on');return any;}
function togglePop(id,btn){const open=$(id).hidden;closePops();if(!open)return;const p=$(id);p.hidden=false;
  const ar=$('app').getBoundingClientRect(),br=(btn&&btn.offsetParent?btn:$('btnMore')).getBoundingClientRect();
  p.style.setProperty('--nub',Math.max(16,Math.round(ar.right-16-(br.left+br.width/2)-6))+'px');
  if(btn&&btn.offsetParent)btn.classList.add('on');if(id==='settingsModal')renderSettings();
  if(id==='moreMenu')p.querySelector('[data-more="expand"]').hidden=!ui.compact.status||phone();}
function toggleUI(){ui.hidden=!ui.hidden;closePops();document.body.classList.toggle('hud-off',ui.hidden);$('btnShowUI').hidden=!ui.hidden;scaleAnchor();}

// tooltips: a label and its key, under the control (mouse only)
{let tipEl=null;const tip=$('tip');
  addEventListener('pointerover',e=>{if(e.pointerType!=='mouse')return;const el=e.target.closest&&e.target.closest('[data-tip]');if(el===tipEl)return;tipEl=el;
    if(!el||el.disabled||!el.dataset.tip){tip.hidden=true;return;}tip.innerHTML=esc(el.dataset.tip)+(el.dataset.key?`<span class="k">${esc(el.dataset.key)}</span>`:'');tip.hidden=false;
    const ar=$('app').getBoundingClientRect(),r=el.getBoundingClientRect(),tw=tip.offsetWidth,th=tip.offsetHeight;
    let x=r.left+r.width/2-tw/2-ar.left,y=r.bottom-ar.top+8;if(y+th>ar.height-8)y=r.top-ar.top-th-8;
    tip.style.left=clamp(x,8,ar.width-tw-8)+'px';tip.style.top=y+'px';});
  addEventListener('pointerdown',()=>{tip.hidden=true;tipEl=null;},true);}

const modalOpen=()=>!$('startModal').hidden;
// in a multiplayer game fog of war stays on (it decides what each side can target)
function toggleSetting(k){if(k==='fog'&&G&&G.mp)return;settings[k]=!settings[k];if(k==='fog'&&G){G.fog=settings.fog;computeVis();}renderSettings();}
// (in multiplayer fog of war is always on: its switch shows on, greyed out)
function renderSettings(){document.querySelectorAll('#settingsModal [data-set]').forEach(b=>{const lock=b.dataset.set==='fog'&&!!(G&&G.mp),on=lock||settings[b.dataset.set];
    b.classList.toggle('on',on);b.setAttribute('aria-checked',on);b.disabled=lock;});$('fogRow').classList.toggle('locked',!!(G&&G.mp));
  document.querySelectorAll('#setView [data-view],#ngView [data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===settings.style));
  document.querySelectorAll('#setFrontStyle [data-fs]').forEach(b=>b.classList.toggle('on',b.dataset.fs===settings.frontStyle));
  document.querySelectorAll('#settingsModal [data-layout]').forEach(b=>{b.classList.toggle('on',b.dataset.layout===ui.layout);b.setAttribute('aria-checked',b.dataset.layout===ui.layout);});
  document.querySelectorAll('#setAppear [data-ap]').forEach(b=>b.classList.toggle('on',b.dataset.ap===ui.appearance));}
document.querySelectorAll('#setFrontStyle [data-fs]').forEach(b=>b.onclick=()=>{settings.frontStyle=b.dataset.fs;renderSettings();if(G&&G.ctrl&&settings.front)frontShape(true);});
// map view: 'satellite' or 'paper' (shown as Strategic, the original printed map); only the terrain drawing changes
function setView(v){if(settings.style===v)return;settings.style=v;renderSettings();if(M)renderTerrain();}
document.querySelectorAll('#setView [data-view],#ngView [data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
document.querySelectorAll('#settingsModal [data-set]').forEach(b=>b.onclick=()=>toggleSetting(b.dataset.set));
// the popover is reopened after a layout change so it hangs from the gear button in its new place
document.querySelectorAll('#settingsModal [data-layout]').forEach(b=>b.onclick=()=>{ui.layout=b.dataset.layout;saveUI();applyLayout();closePops();togglePop('settingsModal',$('btnSettings'));});
document.querySelectorAll('#setAppear [data-ap]').forEach(b=>b.onclick=()=>{ui.appearance=b.dataset.ap;saveUI();renderSettings();applyAppearance();});
$('btnSettings').onclick=()=>{renderSettings();togglePop('settingsModal',$('btnSettings'));};
$('btnHelp').onclick=()=>togglePop('helpModal',$('btnHelp'));
$('btnMore').onclick=()=>togglePop('moreMenu',$('btnMore'));
$('btnHide').onclick=toggleUI;$('btnShowUI').onclick=toggleUI;
document.querySelectorAll('#moreMenu [data-more]').forEach(b=>b.onclick=()=>{const a=b.dataset.more;closePops();
  if(a==='settings')togglePop('settingsModal',$('btnMore'));else if(a==='help')togglePop('helpModal',$('btnMore'));else if(a==='hide')toggleUI();
  else if(a==='expand'){ui.compact.status=false;saveUI();updateHUD(true);}else if(a==='new')$('btnMenu').onclick();});
// collapsing and expanding the panels
$('scenCard').onclick=()=>{if(ui.layout==='docked')return;if($('scenCard').classList.contains('phoneOpen')){closePops();return;}ui.compact.scen=true;saveUI();updateHUD(true);};
$('scenPill').onclick=()=>{ui.compact.scen=false;saveUI();updateHUD(true);};
$('railInfo').onclick=()=>{const open=!$('scenCard').classList.contains('phoneOpen');closePops();$('scenCard').classList.toggle('phoneOpen',open);};
$('status').onclick=e=>{const o=e.target.closest('[data-obj]');if(o){panToObj(+o.dataset.obj);return;}
  if($('status').classList.contains('compact')){if(phone())return;ui.compact.status=false;saveUI();updateHUD(true);}
  else if(e.target.closest('[data-act="collapse"]')&&ui.layout!=='docked'){ui.compact.status=true;saveUI();updateHUD(true);}};
$('objList').onclick=e=>{const o=e.target.closest('[data-obj]');if(o)panToObj(+o.dataset.obj);};
$('panel').onclick=e=>{if(e.target.closest('[data-act="closePanel"]')){ui.panel='closed';updateHUD(true);}};
// each rail button opens or closes its own card; on a phone the cards are bottom sheets, so opening one closes the others
const cardOpen=c=>c==='sel'?!$('inspector').hidden:c==='forces'?!!ui.forces:!!ui.modsG;
function toggleCard(c){const on=!cardOpen(c);
  if(on&&phone()){if(c!=='sel'&&!$('inspector').hidden)ui.panel='closed';if(c!=='forces')ui.forces=false;if(c!=='mods')ui.modsG=false;}
  if(c==='sel')ui.panel=on?'open':'closed';else if(c==='forces')ui.forces=on;else ui.modsG=on;updateHUD(true);}
document.querySelectorAll('#rail [data-open]').forEach(b=>b.onclick=()=>toggleCard(b.dataset.open));
$('forcesX').onclick=()=>{ui.forces=false;updateHUD(true);};
document.querySelectorAll('.secHd[data-sec]').forEach(b=>b.onclick=()=>{const s=b.dataset.sec;ui.sec[s]=!ui.sec[s];saveUI();updateHUD(true);});
$('btnSideL').onclick=()=>{ui.left=!ui.left;saveUI();updateHUD(true);};
$('btnSideR').onclick=()=>{const vis=!$('sideR').classList.contains('off');ui.panel=vis?'closed':'open';updateHUD(true);};
$('selPill').onclick=$('btnOrdersCompact').onclick=()=>{ui.compact.bottom=!ui.compact.bottom;saveUI();updateHUD(true);};
$('log').onclick=()=>{ui.compact.log=!ui.compact.log;saveUI();updateHUD(true);};
// $('callouts').onclick=e=>{const c=e.target.closest('[data-call]');if(!c)return;const k=c.dataset.call;ui.dots.has(k)?ui.dots.delete(k):ui.dots.add(k);updateCallouts();};
$('undoKey').textContent=$('undoKbd').textContent=MAC?'⌘Z':'Ctrl Z';$('ctlStraight').textContent=MAC?'⌘- or Ctrl-click':'Ctrl-click';
$('btnUndo').dataset.tip='Undo';$('btnUndo').dataset.key=MAC?'⌘Z':'Ctrl Z';

function setMode(m){if(G)G.orderMode=m;document.querySelectorAll('#modes [data-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mode===m&&!b.disabled));}
function setTool(t){if(G)G.tool=t;$('btnTrench').classList.toggle('on',t==='trench');if(G&&G.phase==='deploy')updateBudget();}
function setSpeed(s){if(!timeCtl())return;if(G)G.speed=s;document.querySelectorAll('#speed button').forEach(b=>b.classList.toggle('on',+b.dataset.s===s));$('btnSpeedC').textContent=s+'×';}
const timeCtl=()=>!G||!G.mp||(G.mp.hostTime&&G.mp.role==='host');
function togglePause(){if(!G||G.phase!=='play'||!timeCtl())return;G.paused=!G.paused;updateHUD();}
function toggleSup(){if(!G)return;G.showSup=!G.showSup;$('btnSup').classList.toggle('on',G.showSup);}
function toggleFront(){settings.front=!settings.front;$('btnFront').classList.toggle('on',settings.front);if(G&&settings.front){if(!G.ctrl)updateFront();frontShape(true);}}
$('btnFront').onclick=toggleFront;
function updateBudget(){if(!G)return;const km=v=>(v*M_PER_PX/1000).toFixed(1),tot=G.budget0||G.budget;
  setH($('budget'),`<b>${km(G.budget)}</b><span class="s2"> of ${km(tot)} km</span>`);$('budgetBar').style.width=(tot?G.budget/tot*100:0)+'%';
  $('budgetSub').textContent=G.tool==='trench'?'Drag to draw trench':'Select units, click to place';}
$('btnPause').onclick=togglePause;$('btnSup').onclick=toggleSup;$('btnHold').onclick=()=>{holdSel();updateHUD();};
$('btnSpeedC').onclick=()=>{if(!G)return;const sp=[1,2,4];setSpeed(sp[(sp.indexOf(G.speed)+1)%3]);};
document.querySelectorAll('#speed button').forEach(b=>b.onclick=()=>setSpeed(+b.dataset.s));
document.querySelectorAll('#modes [data-mode]').forEach(b=>b.onclick=()=>{setMode(b.dataset.mode);updateHUD();});
document.querySelectorAll('[data-sel]').forEach(b=>b.onclick=()=>{if(!G)return;const t=b.dataset.sel;clearSel();if(t!=='none'){mine().forEach(u=>{if(t==='all'||u.type===t)u.sel=true;});selectionChanged();}updateHUD();});
$('btnTrench').onclick=()=>setTool(G.tool==='trench'?null:'trench');
$('btnUndo').onclick=()=>act({k:'undo'});
$('btnBegin').onclick=()=>{if(!act({k:'begin'})&&!(G.mp&&G.mp.role==='guest'))return;setTool(null);$('deployTools').hidden=true;updateHUD(true);};

