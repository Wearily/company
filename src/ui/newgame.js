// COMPANY · src/ui/newgame.js
// The New game sheet: pickers, game codes and links, the Modifiers panel.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
/* the New game sheet */
const opts={side:'A',strength:'standard',seed:1+Math.floor(Math.random()*99999),mode:'river',diff:'normal',climate:'temperate',scen:'standard',gen2:true};
const segInit=(id,key)=>document.querySelectorAll(`#${id} button`).forEach(b=>b.onclick=()=>{opts[key]=b.dataset.v;document.querySelectorAll(`#${id} button`).forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-checked',x===b);});syncCode();});
segInit('optSide','side');segInit('optStr','strength');segInit('optDiff','diff');
function syncSegs(){const gb=$('optGen');gb.classList.toggle('on',!!opts.gen2);gb.setAttribute('aria-checked',!!opts.gen2);for(const [id,key] of [['optSide','side'],['optStr','strength'],['optDiff','diff']])document.querySelectorAll(`#${id} button`).forEach(b=>{b.classList.toggle('on',b.dataset.v===opts[key]);b.setAttribute('aria-checked',b.dataset.v===opts[key]);});}
// battlefield picker: one tile per map type; choosing one redraws the preview behind the sheet
function renderModes(){$('optMode').innerHTML=Object.entries(MAP_MODES).map(([k,m])=>`<button class="tile${k===opts.mode?' on':''}" role="radio" aria-checked="${k===opts.mode}" data-v="${k}" title="${esc((opts.gen2&&m.desc2||m.desc)+' '+m.rules)}">${m.name}</button>`).join('');
  document.querySelectorAll('#optMode button').forEach(b=>b.onclick=()=>{if(opts.mode===b.dataset.v)return;opts.mode=b.dataset.v;renderModes();preview();});}
renderModes();
// climate picker: changing it redraws the preview's look without changing the map
function renderClimates(){$('optClimate').innerHTML=Object.entries(CLIMATES).map(([k,c])=>`<button class="${k===opts.climate?'on':''}" role="radio" aria-checked="${k===opts.climate}" data-v="${k}" title="${esc(c.desc+' '+c.rules)}">${c.name}</button>`).join('');
  document.querySelectorAll('#optClimate button').forEach(b=>b.onclick=()=>{if(opts.climate===b.dataset.v)return;opts.climate=b.dataset.v;renderClimates();if(M){setClimate(opts.climate);renderTerrain();}syncCode();});}
renderClimates();
// the map's climate sets its look and its off-road movement
function setClimate(c){M.climate=c;M.offroad=CLIMATES[c].offroad;M.frozen=!!CLIMATES[c].frozen;fieldCache.clear();}
function preview(){M=makeMap(opts.seed,opts.mode,opts.gen2);setClimate(opts.climate);renderTerrain();fieldCache.clear();$('optSeed').value=opts.seed;syncCode();}
// scenario picker: one row each, with its description
function renderScens(){$('optScen').innerHTML=Object.entries(SCENARIOS).map(([k,c])=>`<button class="sr${k===opts.scen?' on':''}" role="radio" aria-checked="${k===opts.scen}" data-v="${k}"><span><b>${c.name}</b><span class="s2">${esc(c.desc)}</span></span>${ICON.tick}</button>`).join('');
  renderScensRule();
  document.querySelectorAll('#optScen button').forEach(b=>b.onclick=()=>{if(opts.scen===b.dataset.v)return;opts.scen=b.dataset.v;renderScens();syncCode();});}
// the game code for the current options, shown on the setup screen. The page address is left alone: a game URL
// (#game=CODE, or an older ?game=CODE) is read when the page opens or the hash changes, and Copy Game URL makes one
function syncCode(){const code=encodeGame(opts);$('optCode').value=code;renderScensRule();renderMods();if(typeof mpOptsChanged==='function')mpOptsChanged();}
const gameURL=o=>location.href.split('#')[0].split('?')[0]+'#game='+encodeGame(o);
// copy text, with the old textarea way as a fallback where the clipboard API isn't allowed (a local file, an old browser)
function copyText(txt,done){const fallback=()=>{const t=document.createElement('textarea');t.value=txt;document.body.appendChild(t);t.select();let ok=false;try{ok=document.execCommand('copy');}catch(e){}t.remove();done(ok);};
  // (if the clipboard doesn't answer quickly, e.g. waiting on a permission, use the fallback instead)
  let settled=false;const once=f=>(...a)=>{if(settled)return;settled=true;f(...a);};const ok=once(()=>done(true)),fb=once(fallback);
  try{navigator.clipboard.writeText(txt).then(ok,fb);setTimeout(fb,700);}catch(e){fb();}}
const gameCode=()=>(location.hash.match(/game=([\w-]+)/)||location.search.match(/[?&]game=([\w-]+)/)||[])[1];
/* Game modifiers: what the chosen setup changes, from the player's side, listed at the top right of the New game screen.
   Forces and air strikes come from the same forceFor / airFor the game uses, so the numbers match what spawns. */
const MODIC={clock:'<circle cx="10" cy="10" r="7"/><path d="M10 6v4.3l2.8 1.8"/>',
  goal:'<circle cx="10" cy="10" r="7"/><circle cx="10" cy="10" r="3"/><circle cx="10" cy="10" r=".7" fill="currentColor"/>',
  force:'<circle cx="6" cy="6" r="3"/><rect x="11" y="3" width="6" height="6" rx=".8"/><path d="M6 11.5l3.4 5.5H2.6z"/><path d="M14 11l3 1.7v3.6L14 18l-3-1.7v-3.6z"/>',
  air:'<path fill="currentColor" stroke="none" d="M10 1.8c.9 0 1.4.9 1.4 2v3.7l6.3 3.7v1.8l-6.3-1.9v3.6l2.1 1.6V18L10 17.3 6.5 18v-1.7l2.1-1.6v-3.6l-6.3 1.9v-1.8l6.3-3.7V3.8c0-1.1.5-2 1.4-2z"/>',
  noair:'<path fill="currentColor" stroke="none" opacity=".55" d="M10 1.8c.9 0 1.4.9 1.4 2v3.7l6.3 3.7v1.8l-6.3-1.9v3.6l2.1 1.6V18L10 17.3 6.5 18v-1.7l2.1-1.6v-3.6l-6.3 1.9v-1.8l6.3-3.7V3.8c0-1.1.5-2 1.4-2z"/><path d="M3 3l14 14"/>',
  eye:'<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.4"/>',
  moon:'<path d="M15.8 12.6A6.8 6.8 0 0 1 7.4 4.2a6.8 6.8 0 1 0 8.4 8.4z"/>',
  speed:'<path d="M3.2 14.5a7 7 0 1 1 13.6 0"/><path d="M10 13.4l3.6-4.2"/>',
  ice:'<path d="M10 2.5v15M3.5 6.25l13 7.5M3.5 13.75l13-7.5M8 3.8l2 1.6 2-1.6M8 16.2l2-1.6 2 1.6"/>',
  river:'<path d="M2.5 7.5c1.9-1.3 3.6-1.3 5 0s3.1 1.3 5 0 3.6-1.3 5 0M2.5 12.5c1.9-1.3 3.6-1.3 5 0s3.1 1.3 5 0 3.6-1.3 5 0"/>',
  lake:'<ellipse cx="10" cy="10" rx="7.5" ry="4.8"/><path d="M6.5 10c1-.7 2-.7 3 0s2 .7 3 0"/>',
  dry:'<path d="M10 2.5v15M2.5 10h15"/><circle cx="10" cy="10" r="2.2"/>',
  rock:'<path d="M2 16l5.5-9 3.5 5.5 2-3 5 6.5z"/>',
  city:'<path d="M3 17V8l4-2v11M7 17V4h6v13M13 17V9l4 2v6M2 17h16"/>',
  woods:'<path d="M10 2.5l5 7h-3l3.5 5h-11L8 9.5H5z"/><path d="M10 14.5v3"/>',
  trench:'<path d="M2 12l2.7-4 2.7 4 2.6-4 2.7 4 2.6-4 2.7 4"/>',
  flag:'<path d="M5 17.5V3M5 3.5h9.5l-2.2 3.5 2.2 3.5H5"/>',
  reinf:'<path d="M10 4v12M4 10h12"/>',
  diff:'<path d="M4 16v-3M8 16v-6M12 16V7M16 16V4"/>',
  neutral:'<circle cx="10" cy="10" r="7" stroke-dasharray="2.5 2.6"/>',
  counter:'<path d="M4 7h11l-3-3M16 13H5l3 3"/>',
  map:'<path d="M2.5 5l5-2 5 2 5-2v12l-5 2-5-2-5 2z"/><path d="M7.5 3v12M12.5 5v12"/>'};
// coloured glyph inline with the text
const modIcon=(k,col)=>`<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="color:${col}" aria-hidden="true">${MODIC[k]}</svg>`;
// Only what differs from a standard game (Standard Battle, River Town, Temperate, Normal, standard defense) is listed.
// Each row: icon, what changes, the value; the reason is in its tooltip.
function setupMods(o){const sc=SCENARIOS[o.scen],mm=MAP_MODES[o.mode],cl=CLIMATES[o.climate],dif=DIFFICULTY[o.diff],me=o.side,them=me==='A'?'D':'A',R=[];
  const ctx={mode:o.mode,scen:o.scen,player:me,diff:o.diff},sideCol={A:'var(--atk-ring)',D:'var(--defender-ring)'};
  const pct=v=>{const p=Math.round((v-1)*100);return (p>0?'+':p<0?'−':'')+Math.abs(p)+'%';},tone=v=>v>1?'up':v<1?'down':'';
  const TN={inf:'infantry',tank:'armor',art:'artillery',eng:'engineers'};
  // a force as changes against the standard one: +2 armor, −2 infantry
  const delta=(fs,base,s)=>{const d=UNIT_TYPES.filter(t=>(fs[t]||0)!==(base[t]||0));return d.length?{val:`<span class="cnts">${d.map(t=>{const n=(fs[t]||0)-(base[t]||0);return `<span class="cnt">${n>0?'+':'−'}${Math.abs(n)}${uIco(t,s,9)}</span>`;}).join('')}</span>`,
    tip:d.map(t=>{const n=(fs[t]||0)-(base[t]||0);return `${n>0?'+':'−'}${Math.abs(n)} ${TN[t]}`;}).join(', ')+` (${UNIT_TYPES.map(t=>`${fs[t]||0} ${TN[t]}`).join(', ')})`}:null;};
  if(!o.gen2)R.push({ic:'map',col:'#8e8e93',label:'Map generation',val:'Legacy',tip:'The original generator: one river through the middle, the town at the main bridge, a hill behind it. Older game codes use it.'});
  if(sc.limit!==900)R.push({ic:'clock',col:'#007aff',label:'Time limit',val:fmt(sc.limit)});
  if(sc.neutral||sc.holdA||sc.need!==2)R.push({ic:'goal',col:'#ff3b30',label:'To win',tip:sc.goal[me],
    val:sc.neutral?'Most objectives':sc.holdA?(me==='A'?'Hold A ':'Deny A ')+fmt(sc.holdA):sc.need>=3?(me==='A'?'Take all 3':'Keep 1 of 3'):(me==='A'?'Hold 2 of 3':'Keep 2 of 3')});
  for(const [s,who] of [[me,'Your force'],[them,'Enemy force']]){const d=delta(forceFor(s,s==='D'?FORCES[o.strength]:ATK,ctx),s==='D'?FORCES.standard:ATK,s);
    if(d)R.push({ic:'force',col:sideCol[s],label:who,val:d.val,tip:d.tip});}
  const aMe=airFor(me,ctx),aThem=airFor(them,ctx);
  if(sc.noAir)R.push({ic:'noair',col:'#8e8e93',label:'Air strikes',val:'None',tone:'down',tip:'None in this scenario'});
  else if(aMe!==AIR.count||aThem!==AIR.count)R.push({ic:'air',col:'#32ade6',label:'Air strikes',val:`You ${aMe} · Enemy ${aThem}`,tip:`Standard is ${AIR.count} each`});
  const vis=mm.vision*cl.vision*(sc.vision||1);
  if(Math.round((vis-1)*100))R.push({ic:sc.night?'moon':'eye',col:sc.night?'#5856d6':'#af52de',label:sc.night?'Vision (night)':'Vision',val:pct(vis),tone:tone(vis),
    tip:[sc.night?'Darkness '+pct(sc.vision):'',mm.vision!==1?mm.name+' '+pct(mm.vision):'',cl.vision!==1?cl.name+' '+pct(cl.vision):''].filter(Boolean).join(' · ')});
  if(cl.offroad!==1)R.push({ic:'speed',col:'#ff9500',label:'Off-road movement',val:pct(cl.offroad),tone:'down',tip:`${cl.rules.split(':')[0]}; roads unaffected`});
  if(cl.frozen&&mm.wet)R.push({ic:'ice',col:'#5ac8fa',label:'Frozen water',val:'Infantry cross',
    tip:`Infantry and engineers cross the frozen river and lakes on foot. On the ice: fire ${pct(ICE.fire)}, damage taken ${pct(ICE.exposed)}, seen ${Math.round((ICE.seen-1)*100)}% farther`});
  if(!mm.wet)R.push({ic:'dry',col:'#a2845e',label:'No river',val:'Open front',tip:mm.rules});
  if(mm.lake)R.push({ic:'lake',col:'#30b0c7',label:'Lake',val:'No pontoons',tip:mm.rules});
  if(mm.ridges)R.push({ic:'rock',col:'#7d7461',label:'Rock ridges',val:'No armor',tip:'Armor and artillery can\'t cross rock; infantry climbs slowly'});
  const km=v=>(v*M_PER_PX/1000).toFixed(1),bud=BUDGET[o.strength]*mm.budget,bud0=BUDGET.standard;
  if(sc.trenches===false)R.push({ic:'trench',col:'#a2845e',label:'Trenches',val:'None',tip:'Nobody starts dug in'});
  // a defender who deploys always sees how much trench there is to dig; it's coloured only when it differs from standard
  else if(me==='D'&&sc.deploy!==false){const d=Math.abs(bud-bud0)>1;R.push({ic:'trench',col:'#a2845e',label:'Trench budget',val:km(bud)+' km',tone:d?tone(bud/bud0):'',
    tip:'To dig before the battle, on top of the trenches already at A, B and C'+(d?`. Standard is ${km(bud0)} km`:'')});}
  if(me==='D'&&sc.deploy===false)R.push({ic:'flag',col:'#5856d6',label:'Deployment',val:'None',tip:'The battle starts at once'});
  if(sc.counter)R.push({ic:'counter',col:'#ff9500',label:'Attacker holds A, B',val:'At start',tip:'The attacker starts holding A and B'});
  if(sc.neutral)R.push({ic:'neutral',col:'#8e8e93',label:'Objectives',val:'Neutral',tip:'Both sides start at their depots and race for them'});
  for(const r of sc.reinf||[]){const d=delta(r.units,{},r.side);R.push({ic:'reinf',col:'#34c759',label:`Reinforcements ${fmt(r.t)}`,val:d.val,tip:`${r.side===me?'Yours':'The enemy\'s'}, at their depot: `+d.tip.split(' (')[0]});}
  if(o.diff!=='normal')R.push({ic:'diff',col:'#8e8e93',label:'Difficulty',val:dif.name,
    tip:`Computer: ${pct(dif.force)} units, ${dif.air>0?'+':'−'}${Math.abs(dif.air)} air strike, calls one every ${Math.round(AIR.aiCooldown*dif.cool)} s`});
  return R;}
function renderMods(){const R=setupMods(opts),el=$('mods'),shut=!!ui.compact.mods;el.classList.toggle('shut',shut);$('modsN').textContent=R.length;
  $('modsHd').setAttribute('aria-expanded',!shut);$('modsHd').dataset.tip=shut?'Show modifiers':'Collapse';
  setH($('modsList'),modsRows(R));}
const modsRows=R=>R.length?R.map(r=>`<div class="mrow"${r.tip?` data-tip="${esc(r.tip)}"`:''}>${modIcon(r.ic,r.col)}<span class="ml">${r.label}</span><span class="mv tn${r.tone?' '+r.tone:''}">${r.val}</span></div>`).join('')
  :'<div class="mnone">None: standard rules</div>';
// the battle in progress as a setup, for the in-game Modifiers card (rail button) and the docked outliner's section
const gameSetup=()=>({scen:G.scen,mode:G.mode,climate:G.climate,diff:G.diff,side:G.player,strength:G.strength,gen2:G.gen2});
function gameMods(){if(!G._mods){const R=setupMods(gameSetup());G._mods={n:R.length,html:modsRows(R)};}return G._mods;}
$('railMods').onclick=()=>toggleCard('mods');
$('modsGameX').onclick=()=>{ui.modsG=false;updateHUD(true);};
$('modsHd').onclick=()=>{ui.compact.mods=!ui.compact.mods;saveUI();renderMods();};
function renderScensRule(){const c=SCENARIOS[opts.scen];$('scenRule').textContent=`You ${opts.side==='A'?'attack':'defend'}: ${c.goal[opts.side]}`;}
// the New map generation switch: a different generator is a different map, so the preview is rebuilt
$('optGen').onclick=()=>{opts.gen2=!opts.gen2;syncSegs();renderModes();preview();};
function applyOptions(o){Object.assign(opts,o);syncSegs();renderModes();renderClimates();renderScens();preview();}
$('optCode').onchange=()=>{const o=decodeGame($('optCode').value);if(o){applyOptions(o);$('codeMsg').textContent='Game code loaded.';}else{$('codeMsg').textContent='That isn’t a valid game code.';$('optCode').value=encodeGame(opts);}};
$('optCode').onkeydown=e=>{if(e.key==='Enter')$('optCode').onchange();};
$('optCopy').onclick=()=>copyText(gameURL(opts),ok=>{$('codeMsg').textContent=ok?'Game URL copied: anyone who opens it gets this game.':'Copy the code above to share it.';});
