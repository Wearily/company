// COMPANY · src/ui/campaign.js
// The Campaign window: starting or continuing a campaign, the region map and the company panel between battles, the
// campaign's result, and the Withdraw sheet in a campaign battle. The campaign itself is engine/campaign.js.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
const UIC={view:'new',pick:-1,form:null,buy:false,fallen:false,sure:false};
// a sector's name on the map: the last word (Crossing, Works…) on its own line
const hexName=(s,cx,cy,R)=>{const w=s.name.split(' ');if(w.length<2)return `<text x="${cx.toFixed(1)}" y="${(cy+R*.52).toFixed(1)}" class="nm">${esc(s.name)}</text>`;
  const last=w.pop();return `<text x="${cx.toFixed(1)}" y="${(cy+R*.42).toFixed(1)}" class="nm">${esc(w.join(' '))}</text><text x="${cx.toFixed(1)}" y="${(cy+R*.42+12).toFixed(1)}" class="nm">${esc(last)}</text>`;};
const KIND_NAME={town:'Town',works:'Industrial works',crossing:'River crossing',crossroads:'Crossroads',hill:'High ground',woods:'Woods',village:'Village'};
// what the fight in a sector is for, as a small glyph (24 × 24, stroked)
const KIND_IC={town:'<rect x="3" y="10" width="6" height="10"/><rect x="10" y="5" width="6" height="15"/><rect x="17" y="12" width="4" height="8"/>',
  works:'<path d="M3 20V9l5 3V9l5 3V9l5 3v8z"/><rect x="17" y="3" width="3" height="6"/>',
  crossing:'<path d="M2 12h20M5 12V8c2.5-3 11.5-3 14 0v4M8 12V9M12 12V7.5M16 12V9"/><path d="M2 17c4-2 6 2 10 0s6 2 10 0"/>',
  crossroads:'<path d="M12 2v20M2 12h20"/><path d="M8 8l4-4 4 4M8 16l4 4 4-4"/>',
  hill:'<path d="M2 20c3-5 5-10 10-10s7 5 10 10z"/><path d="M8 20c1.5-3 2.5-5 4-5s2.5 2 4 5"/>',
  woods:'<path d="M7 20v-3M7 4l-4 7h2.5l-3 6h9l-3-6H11z"/><path d="M17 20v-3M17 7l-3 5h2l-2.5 5h7L18 12h2z"/>',
  village:'<path d="M3 20v-7l4-4 4 4v7zM13 20v-6l3.5-3.5L20 14v6z"/>'};
// veterancy chevrons, one per level
const vetChev=v=>v>0?`<svg class="chev" width="${8*v+2}" height="10" viewBox="0 0 ${8*v+2} 10" aria-label="${VET.name[v]}">${[...Array(v)].map((_,k)=>`<path d="M${k*8+1} 8l3.5-5 3.5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`:'';
const strWord={light:'Light',standard:'Standard',heavy:'Heavy'};
function openCamp(){if(!CP)campLoad();UIC.view=CP?(CP.over?'over':'map'):'new';UIC.sure=false;
  if(CP&&!CP.over){const a=campAttackable();UIC.pick=CP.phase==='counter'?CP.counter.sector:a.includes(UIC.pick)?UIC.pick:(a[0]??-1);}
  $('campModal').hidden=false;campRender();}
const closeCamp=()=>{$('campModal').hidden=true;};
function campRender(){$('campBody').innerHTML=UIC.view==='new'?campNewHTML():UIC.view==='over'?campOverHTML():campMapHTML();
  $('campExport').hidden=!CP;$('campTitle').textContent=UIC.view!=='new'&&CP?CP.company.name:'Campaign';$('campMsg').textContent=UIC.msg||'';UIC.msg='';}

/* --- the views --- */
function campNewHTML(){const f=UIC.form||(UIC.form={name:CAMP_NAMES[Math.random()*6|0],climate:'auto',diff:'normal',seed:1+Math.floor(Math.random()*99999)});
  const seg=(key,opts)=>`<div class="seg wide" data-seg="${key}">${opts.map(([v,l])=>`<button data-v="${v}" class="${f[key]===v?'on':''}" aria-pressed="${f[key]===v}">${l}</button>`).join('')}</div>`;
  const live=CP&&!CP.over,cont=CP?`<div class="campCard"><div class="lb">${live?'Campaign in progress':'Last campaign'}</div><b>${esc(CP.company.name)}</b><p class="s2">Day ${Math.min(CP.day,CAMP.days)} · ${campHeld().length} of ${CP.sectors.length} sectors · ${CP.company.roster.length} units, ${CP.company.roster.filter(u=>u.vet>0).length} veterans · ${DIFFICULTY[CP.diff].name}${CP.pending?' · a battle was interrupted':''}${CP.over?' · '+(CP.over.win?'won':'lost'):''}</p>
      <div class="row8"><button class="cta" data-act="continue">${live?'Continue':'See the Result'}</button>${live?`<button class="bt lg${UIC.sure==='abandon'?' danger':''}" data-act="abandon">${UIC.sure==='abandon'?'Really abandon it?':'Abandon'}</button>`:''}</div></div>`:'';
  const recs=campRecords();
  return `${cont}<div class="campCard"><div class="lb">${CP?'Start a new campaign':'New campaign'}</div>${live?'<p class="s2 warn">Starting a new campaign ends the one in progress.</p>':''}
    <div class="rw"><span>Company</span>${seg('name',CAMP_NAMES.slice(0,6).map(n=>[n,n]))}</div>
    <div class="rw"><span>Climate</span>${seg('climate',[['auto','Auto'],...Object.entries(CLIMATES).map(([k,c])=>[k,c.name])])}</div>
    <div class="rw"><span>Difficulty</span>${seg('diff',Object.entries(DIFFICULTY).map(([k,d])=>[k,d.name]))}</div>
    <div class="rw"><span>Region seed</span><div class="row8"><input class="fld tn" id="campSeed" type="number" min="1" max="999999" value="${f.seed}" aria-label="Region seed"><button class="bt" data-act="reseed">New Region</button></div></div>
    <p class="s2">A region of ${CAMP.cols*CAMP.rows} sectors. Your company holds the southern row; take the three strongholds (★) within ${CAMP.days} days. Each day you attack one sector or rest, and the enemy may counterattack. Your units carry their health, wounds and experience from battle to battle, and manpower buys reinforcements. Progress is saved in this browser after every move; Export keeps a copy as a file.</p>
    <div class="campFoot"><button class="cta${UIC.sure==='start'?' danger':''}" data-act="start">${UIC.sure==='start'?'Really start over?':'Start Campaign'}</button></div></div>
    ${recs.length?`<div class="campCard"><div class="lb">Past campaigns</div>${recs.slice(0,6).map(r=>`<div class="rw"><span>${esc(r.name)} <span class="s2">· ${r.result==='won'?'Victory':r.result==='lost'?'Defeat':'Abandoned'}</span></span><span class="s2 tn">Day ${r.day} · ${r.won}–${r.lost} battles · ${r.unitsLost} lost</span></div>`).join('')}</div>`:''}`;}
// what a battle in a sector would be
function campBriefText(s,kind){const night=CP.day%5===0,parts=[`${KIND_NAME[s.kind]} · ${MAP_MODES[s.mode].name} battlefield.`];
  if(kind==='attack'){parts.push(`${strWord[s.strength]} garrison${s.stronghold?', fortified':''}.`);
    parts.push(s.stronghold?'A stronghold: all three objectives must fall.':s.kind==='crossing'||s.kind==='crossroads'?'Take objective A and hold it for 2 minutes without a break.':'Hold two of the three objectives when the clock runs out, or all three at once.');}
  else{const r=CP.enemy.reserve,big=r>=CAMP.enemy.blitzAt;parts.push(big?'An armoured spearhead is coming: a short, hard fight.':'The enemy is attacking in strength.');
    parts.push('You deploy and dig in, then stop the attacker holding two of the three objectives.');}
  if(night&&!s.stronghold&&!(kind==='attack'&&(s.kind==='crossing'||s.kind==='crossroads')))parts.push('A night battle: sight is cut to about half and there are no air strikes.');
  return parts.join(' ');}
function campCommitLine(){const u=campCommit(),rest=CP.company.roster.length-u.length,c={inf:0,tank:0,art:0,eng:0};for(const x of u)c[x.type]++;
  return `<p class="s2">Going in: ${UNIT_TYPES.filter(t=>c[t]).map(t=>`${c[t]} ${TNAME[t].toLowerCase()}`).join(', ')||'nobody'} (${u.length} unit${u.length===1?'':'s'}${rest?`, ${rest} resting or held back`:''}).</p>`;}
function campMapHTML(){const c=CP.company,inc=campIncome(),held=campHeld(),sh=CP.sectors.filter(s=>s.stronghold),counter=CP.phase==='counter'&&CP.counter?CP.sectors[CP.counter.sector]:null;
  const head=`<div class="campHead"><div class="campStat"><span class="s2">Day</span><b class="tn">${Math.min(CP.day,CAMP.days)}<span class="s2"> / ${CAMP.days}</span></b></div><div class="campStat"><span class="s2">Manpower</span><b class="tn">${Math.round(c.mp)}<span class="s2 tn"> +${Math.round(inc.net)}/day</span></b></div><div class="campStat"><span class="s2">Sectors held</span><b class="tn">${held.length}<span class="s2"> / ${CP.sectors.length}</span></b></div><div class="campStat"><span class="s2">Strongholds</span><b class="tn">★ ${sh.filter(s=>s.owner==='A').length}<span class="s2"> / 3</span></b></div></div>`;
  let brief;
  if(CP.over)brief=`<div class="campBrief"><div class="lb">Campaign over</div><b>${CP.over.win?'Victory':'Defeat'}</b><p class="s2">${esc(CP.over.reason)}</p><div class="row8"><button class="cta" data-act="showover">The Result</button></div></div>`;
  else if(CP.pending){const s=CP.sectors[CP.pending.sector];brief=`<div class="campBrief"><div class="lb">Interrupted battle</div><b>${CP.pending.kind==='attack'?'The attack on':'The defence of'} ${esc(s.name)}</b><p class="s2">The page was closed during the battle. Fight it again from the start, or withdraw: the battle counts as lost, and the company keeps its units as they were.</p><div class="row8"><button class="cta" data-act="refight">Refight</button><button class="bt lg" data-act="withdrawp">Withdraw</button></div></div>`;}
  else if(counter)brief=`<div class="campBrief threat"><div class="lb">Counterattack</div><b>The enemy is attacking ${esc(counter.name)}</b><p class="s2">${campBriefText(counter,'defend')}</p>${campCommitLine()}<div class="row8"><button class="cta" data-act="defend">Defend ${esc(counter.name)}</button><button class="bt lg" data-act="concede" data-tip="Give the sector up without a battle: the company keeps every unit">Retreat</button></div></div>`;
  else{const s=UIC.pick>=0?CP.sectors[UIC.pick]:null,can=!!s&&campAttackable().includes(s.i);
    brief=s?`<div class="campBrief"><div class="lb">${s.owner==='A'?'Held sector':can?'Attack':'Enemy sector · not adjacent'}</div><b>${esc(s.name)}${s.stronghold?' ★':''}</b><p class="s2">${s.owner==='A'?`${KIND_NAME[s.kind]} · ${MAP_MODES[s.mode].name} battlefield · ${CAMP.income.sector[s.kind]||30} manpower a day.`:campBriefText(s,'attack')}</p>${can?campCommitLine():''}<div class="row8">${can?`<button class="cta" data-act="attack">Attack ${esc(s.name)}</button>`:''}<button class="bt lg" data-act="rest" data-tip="End the day without fighting: the company heals faster and some wounds clear">Rest a Day</button></div></div>`
      :`<div class="campBrief"><div class="lb">Orders</div><p class="s2">Pick a sector on the map. You can attack any enemy sector next to one you hold.</p><div class="row8"><button class="bt lg" data-act="rest">Rest a Day</button></div></div>`;}
  const busy=!!(CP.pending||CP.over);
  const roster=`<div class="lb campLb">Company <span class="s2">${c.roster.length} units · ${campCommit().length} go into battle</span></div>
    ${!busy?`<div class="lb campLb" style="margin-top:2px">Reinforce <span class="s2">manpower ${Math.round(c.mp)}</span></div><div class="campBuy">${UNIT_TYPES.map(t=>{const cost=ECON.cost[t].mp,no=c.mp<cost;return `<button class="bt buyB" data-act="buy" data-t="${t}" ${no?'disabled ':''}data-tip="${no?'Not enough manpower':'Add a new '+TNAME[t].toLowerCase()+' unit'}">${uIco(t,'A',14)}<b>${TNAME[t]}</b><span class="s2 tn">${cost} mp</span></button>`;}).join('')}</div>`:''}
    <div class="campRoster">${c.roster.map(u=>{const hp=u.hp*(u.wounded?WOUND.cap:1);return `<div class="cu${u.rest?' rest':''}">${uIco(u.type,'A',13)}<span class="nm">${esc(u.name)}${vetChev(u.vet)}</span><span class="s2 tn" data-tip="Battles fought">${u.battles}×</span><span class="bar6 hpb" data-tip="Health ${Math.round(hp*100)}%${u.wounded?' · wounded: heals to '+Math.round(WOUND.cap*100)+'% at most':''}"><i style="width:${Math.round(hp*100)}%;background:${hp>.5?'var(--ok)':hp>.25?'var(--contested)':'var(--danger)'}"></i>${u.wounded?`<em style="left:${WOUND.cap*100}%"></em>`:''}</span>${busy?'':`${u.wounded?`<button class="bt sm" data-act="refit" data-cid="${u.cid}" ${c.mp<CAMP.refit?'disabled ':''}data-tip="Clear the wound and heal in full: ${CAMP.refit} manpower">Refit</button>`:''}<button class="bt sm${u.rest?' on':''}" data-act="resttg" data-cid="${u.cid}" data-tip="${u.rest?'Resting: stays out of the next battle and heals':'Goes into battle; click to rest it instead'}">${u.rest?'Resting':'Rest'}</button>`}</div>`;}).join('')}</div>`;
  const log=`<div class="lb campLb">Log</div><div class="campLog">${CP.log.slice(0,12).map(l=>`<div><span class="s2 tn">Day ${l.day}</span>${esc(l.text)}</div>`).join('')}</div>`;
  const fallen=c.fallen.length?`<div class="lb campLb">Fallen <span class="s2">${c.fallen.length}</span><button class="bt" data-act="fallenT">${UIC.fallen?'Hide':'Show'}</button></div>${UIC.fallen?`<div class="campLog">${c.fallen.slice().reverse().map(f=>`<div>${esc(f.name)} ${vetChev(f.vet)} <span class="s2">· ${TNAME[f.type].toLowerCase()} · ${f.battles} battle${f.battles===1?'':'s'} · fell at ${esc(f.where)}, day ${f.day}</span></div>`).join('')}</div>`:''}`:'';
  const foot=CP.over?'':`<div class="campFoot"><button class="bt lg${UIC.sure==='surrender'?' danger':''}" data-act="surrender" data-tip="Give up the campaign: it counts as lost">${UIC.sure==='surrender'?'Really surrender the campaign?':'Surrender Campaign'}</button></div>`;
  return `${head}<div class="campGrid"><div class="campMap">${campMapSVG()}<div class="campKey"><span><i class="mine"></i>Held</span><span><i class="foe"></i>Enemy</span><span><i class="can"></i>Can attack</span><span>★ Stronghold</span><span class="pipsK"><i></i><i></i><i></i>&nbsp; Garrison</span></div></div><div class="campSide">${brief}${roster}${log}${fallen}${foot}</div></div>`;}
function campOverHTML(){const o=CP.over,st=CP.stats;return `<div class="campOver"><span class="resIc${o.win?'':' loss'}">${o.win?ICON.check:ICON.cross}</span><h2>${o.win?'Campaign won':'Campaign lost'}</h2><p>${esc(o.reason)}</p>
  <div class="tiles3"><div class="grp"><div class="s2">Days</div><b class="tn">${o.day}</b></div><div class="grp"><div class="s2">Battles won</div><b class="tn">${st.won} / ${st.battles}</b></div><div class="grp"><div class="s2">Units lost</div><b class="tn">${st.unitsLost}</b></div></div>
  <div class="grp"><div class="rw"><span>Company</span><span class="s2">${esc(CP.company.name)} · ${DIFFICULTY[CP.diff].name}</span></div><div class="rw"><span>Sectors held</span><span class="s2 tn">${campHeld().length} of ${CP.sectors.length}</span></div><div class="rw"><span>Enemy units destroyed</span><span class="s2 tn">${st.enemyLost}</span></div><div class="rw"><span>Veterans in the company</span><span class="s2 tn">${CP.company.roster.filter(u=>u.vet>0).length}</span></div></div>
  <div class="campFoot"><button class="bt lg" data-act="showmap">See the Map</button><button class="cta" data-act="newcamp">New Campaign</button></div></div>`;}

/* --- the region map --- */
function hexPts(cx,cy,R){const p=[];for(let k=0;k<6;k++){const a=Math.PI/180*(60*k-30);p.push([cx+R*Math.cos(a),cy+R*Math.sin(a)]);}return p;}
function campMapSVG(){const R=58,w=Math.sqrt(3)*R,ctr=i=>{const c=i%CAMP.cols,r=Math.floor(i/CAMP.cols);return[w*(c+.5+(r&1?.5:0))+12,R*(1.5*r+1)+10];};
  const W=w*(CAMP.cols+.5)+24,H=R*(1.5*(CAMP.rows-1)+2)+20,can=new Set(campAttackable()),threat=CP.phase==='counter'&&CP.counter?CP.counter.sector:-1;
  let hex='',front='';
  CP.sectors.forEach((s,i)=>{const [cx,cy]=ctr(i),pts=hexPts(cx,cy,R-3).map(p=>p.map(v=>v.toFixed(1)).join(',')).join(' ');
    const cls=['hx',s.owner==='A'?'mine':'foe',can.has(i)?'can':'',i===UIC.pick?'pick':'',i===threat?'threat':''].filter(Boolean).join(' ');
    const pips=s.owner==='D'?`<g class="pips">${[...Array(STR_N[s.strength]+1)].map((_,k)=>`<rect x="${(cx-9+k*7).toFixed(1)}" y="${(cy+2).toFixed(1)}" width="5" height="5" rx="1"/>`).join('')}</g>`:'';
    const tip=`${s.name}: ${KIND_NAME[s.kind]}, ${MAP_MODES[s.mode].name}${s.owner==='D'?', '+strWord[s.strength].toLowerCase()+' garrison':', held'}${s.stronghold?', stronghold':''}`;
    hex+=`<g class="${cls}" data-i="${i}" tabindex="0" role="button" aria-label="${esc(tip)}"><title>${esc(tip)}</title><polygon points="${pts}"/><g class="kic" transform="translate(${(cx-12).toFixed(1)},${(cy-27).toFixed(1)})"><svg width="24" height="24" viewBox="0 0 24 24">${KIND_IC[s.kind]}</svg></g>${pips}${s.stronghold?`<path class="star" transform="translate(${(cx+R*.5).toFixed(1)},${(cy-R*.6).toFixed(1)}) scale(.9)" d="M0-7l2 4.3 4.7.7-3.4 3.3.8 4.7L0 3.8l-4.2 2.2.8-4.7-3.4-3.3 4.7-.7z"/>`:''}${hexName(s,cx,cy,R)}</g>`;
    // the front: the edges between held and enemy sectors
    if(s.owner==='A')for(const j of hexNeighbours(i)){if(CP.sectors[j].owner==='A')continue;const a=hexPts(cx,cy,R),[dx,dy]=ctr(j),b=hexPts(dx,dy,R),sh=a.filter(p=>b.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1));
      if(sh.length===2)front+=`<line x1="${sh[0][0].toFixed(1)}" y1="${sh[0][1].toFixed(1)}" x2="${sh[1][0].toFixed(1)}" y2="${sh[1][1].toFixed(1)}"/>`;}});
  return `<svg class="campSvg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="The region">${hex}<g class="front">${front}</g></svg>`;}

/* --- actions --- */
function campAfterTurn(){if(CP.over)UIC.view='over';else{const a=campAttackable();UIC.pick=CP.phase==='counter'?CP.counter.sector:(a[0]??-1);}campRender();}
$('campBody').addEventListener('click',e=>{const h=e.target.closest('[data-i]');if(h&&UIC.view==='map'){UIC.pick=+h.dataset.i;campRender();return;}
  const b=e.target.closest('[data-act],[data-seg] button');if(!b)return;
  const sg=b.closest('[data-seg]');if(sg){UIC.form[sg.dataset.seg]=b.dataset.v;campRender();return;}
  const a=b.dataset.act;if(a!=='start'&&a!=='abandon'&&a!=='surrender')UIC.sure=false;
  if(a==='reseed'){UIC.form.seed=1+Math.floor(Math.random()*99999);campRender();}
  else if(a==='start'){const f=UIC.form,sv=parseInt($('campSeed').value,10);if(sv>0)f.seed=sv;
    if(CP&&!CP.over&&UIC.sure!=='start'){UIC.sure='start';campRender();return;}
    if(CP&&!CP.over)campRecord('abandoned');UIC.sure=false;campNew({name:f.name,climate:f.climate==='auto'?null:f.climate,diff:f.diff,seed:f.seed});UIC.form=null;UIC.view='map';UIC.pick=campAttackable()[0]??-1;campRender();}
  else if(a==='continue'){UIC.view=CP.over?'over':'map';const at=campAttackable();UIC.pick=CP.phase==='counter'?CP.counter.sector:(at[0]??-1);campRender();}
  else if(a==='surrender'){if(UIC.sure!=='surrender'){UIC.sure='surrender';campRender();return;}UIC.sure=false;campSurrender();UIC.view='new';UIC.form=null;campRender();}
  else if(a==='abandon'){if(UIC.sure!=='abandon'){UIC.sure='abandon';campRender();return;}UIC.sure=false;campAbandon();UIC.view='new';campRender();}
  else if(a==='attack'){closeCamp();if(!campAttack(UIC.pick))openCamp();}
  else if(a==='defend'){closeCamp();if(!campDefend())openCamp();}
  else if(a==='refight'){closeCamp();if(!campRefight())openCamp();}
  else if(a==='withdrawp'){campWithdrawPending();campAfterTurn();}
  else if(a==='rest'){campRest();campAfterTurn();}
  else if(a==='concede'){campConcede();campAfterTurn();}
  else if(a==='buy'){campBuy(b.dataset.t);campRender();}
  else if(a==='refit'){campRefit(+b.dataset.cid);campRender();}
  else if(a==='resttg'){campRestToggle(+b.dataset.cid);campRender();}
  else if(a==='fallenT'){UIC.fallen=!UIC.fallen;campRender();}
  else if(a==='showmap'){UIC.view='map';campRender();}
  else if(a==='showover'){UIC.view='over';campRender();}
  else if(a==='newcamp'){UIC.view='new';UIC.form=null;campRender();}});
// Enter or Space on a focused sector picks it
$('campBody').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('[data-i]')){e.preventDefault();e.target.click();}});
$('campX').onclick=closeCamp;
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('campModal').hidden){e.stopImmediatePropagation();closeCamp();}},true);
$('optCampaign').onclick=()=>openCamp();
// a copy of the save as a file, and reading one back
function campExport(){if(!CP)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(CP)],{type:'application/json'}));
  a.download=`company-campaign-${CP.company.name.replace(/\W+/g,'-').toLowerCase()}-day${Math.min(CP.day,CAMP.days)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);}
$('campExport').onclick=campExport;
$('campImport').onclick=()=>$('campFile').click();
$('campFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const d=JSON.parse(await f.text());if(!campValid(d))throw new Error('not a COMPANY campaign save');if(CP&&!CP.over&&CP.seed!==d.seed)campRecord('abandoned');CP=d;campSave();openCamp();}
  catch(err){UIC.msg='That file couldn’t be opened as a campaign ('+err.message+').';campRender();}};
// in a campaign battle the New game button offers to withdraw: a loss, but every unit still alive gets away
function openWithdraw(){closePops();const q=$('mpQuit');q.querySelector('h1').textContent='Retreat from the battle?';q.querySelector('p').textContent='The battle counts as lost, but every unit still alive gets away and stays with the company.';$('quitGo').textContent='Retreat';q.hidden=false;}
// the end sheet's company lines after a campaign battle
function campEndHTML(r){if(!r)return '';const rows=[];
  rows.push(`<div class="rw"><span>Outcome</span><span class="s2">${esc(r.lines[0]||'')}</span></div>`);
  if(r.rating)rows.push(`<div class="rw"><span>Rated</span><span class="s2">${r.rating.mark}${r.bonus?` · manpower +${r.bonus}`:''}</span></div>`);
  rows.push(`<div class="rw"><span>Fallen</span><span class="s2">${r.lost.length?esc(r.lost.join(', ')):'None'}</span></div>`);
  if(r.wounded.length)rows.push(`<div class="rw"><span>Newly wounded</span><span class="s2">${esc(r.wounded.join(', '))}</span></div>`);
  if(r.promoted.length)rows.push(`<div class="rw"><span>Promoted</span><span class="s2">${r.promoted.map(q=>esc(q.name)+' → '+VET.name[q.vet]).join(', ')}</span></div>`);
  if(CP&&CP.phase==='counter'&&CP.counter)rows.push(`<div class="rw"><span>Next</span><span class="s2" style="color:var(--danger)">The enemy is counterattacking ${esc(CP.sectors[CP.counter.sector].name)}.</span></div>`);
  else if(CP&&CP.over)rows.push(`<div class="rw"><span>Campaign</span><span class="s2">${CP.over.win?'Won':'Lost'} · ${esc(CP.over.reason)}</span></div>`);
  return `<div class="lb">${esc(CP?CP.company.name:'The company')}</div><div class="grp endCo">${rows.join('')}</div>`;}
campLoad();
