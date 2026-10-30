// COMPANY · src/ui/depot.js
// Company Command's screens: the Depot card (resources, buying, the queue, the rally point) and the victory points.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
// The card shows the player's own depot. Buying, cancelling and the rally point go through act() like any order, so in
// multiplayer the host's battle decides; buttons are only disabled here, with the reason in their tooltip.
const BUY_KEY={inf:'4',tank:'5',art:'6',eng:'7'};
const RES_IC={mp:'<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="8" cy="5" r="2.6"/><path d="M3 14c.6-3 2.6-4.5 5-4.5s4.4 1.5 5 4.5"/></svg>',
  fuel:'<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M8 1.8C5.6 5 4 7.2 4 9.6a4 4 0 0 0 8 0C12 7.2 10.4 5 8 1.8z"/></svg>'};
// why a unit can't be bought now, or '' if it can
function buyBlock(e,t){const c=ECON.cost[t];if(G.phase!=='play')return 'The battle hasn’t started';
  if(e.q.length>=ECON.queue)return 'The queue is full';if(e.mp<c.mp)return `Need ${Math.ceil(c.mp-e.mp)} more manpower`;
  if(e.fuel<c.fuel)return `Need ${Math.ceil(c.fuel-e.fuel)} more fuel`;if(e.pop+c.pop>ECON.popCap)return 'Population cap reached';return '';}
function depotHTML(me){const e=G.econ[me],r=e.rate,pm=v=>(v>=0?'+':'')+Math.round(v);
  const tipMp=`Manpower a minute: ${Math.round(r.base)} base + ${Math.round(r.obj)} objectives + ${Math.round(r.terr)} territory − ${Math.round(r.gross-r.mp)} upkeep`;
  const res=`<div class="dRes"><div class="res" data-tip="${tipMp}">${RES_IC.mp}<b class="tn">${Math.floor(e.mp)}</b><span class="s2 tn">${pm(r.mp)}/min</span></div>
    <div class="res fuel" data-tip="Fuel a minute, mostly from objectives held: tanks and guns need it">${RES_IC.fuel}<b class="tn">${Math.floor(e.fuel)}</b><span class="s2 tn">${pm(r.fuel)}/min</span></div></div>`;
  const pop=`<div class="rw"><span class="s2">Population</span><span class="tn">${e.pop} / ${ECON.popCap}</span></div><div class="bar6"><i style="width:${Math.min(100,e.pop/ECON.popCap*100)}%"></i></div>`;
  const raid=e.raid?'<div class="dRaid">Depot under attack · production slowed</div>':'';
  const buy=`<div class="buy">${UNIT_TYPES.map(t=>{const c=ECON.cost[t],no=buyBlock(e,t);
    return `<button class="bt buyB" data-buy="${t}" ${no?'disabled ':''}data-tip="${no?esc(no):'Build '+TNAME[t].toLowerCase()}" data-key="${BUY_KEY[t]}" aria-label="Build ${TNAME[t].toLowerCase()}: ${c.mp} manpower${c.fuel?', '+c.fuel+' fuel':''}, ${c.t} seconds">
      ${uIco(t,me,14)}<b>${TNAME[t]}</b><span class="cost tn">${RES_IC.mp}${c.mp}${c.fuel?` ${RES_IC.fuel}${c.fuel}`:''}</span><span class="s2 tn">${c.t} s</span></button>`;}).join('')}</div>`;
  const q=e.q.length?`<div class="dq">${e.q.map((x,i)=>`<div class="dqI">${uIco(x.type,me,12)}<span>${TNAME[x.type]}</span>${i?'<span class="s2">waiting</span>':`<span class="bar6 acc"><i style="width:${Math.min(100,x.t/x.T*100)}%"></i></span><span class="s2 tn">${Math.ceil(x.T-x.t)} s</span>`}
      <button class="bt ic dqX" data-cancel="${i}" aria-label="Cancel and refund" data-tip="Cancel (refunded)"><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg></button></div>`).join('')}</div>`
    :'<p class="s2 dqE">Nothing in production</p>';
  const rally=`<button class="bt fill dRally${G.orderMode==='rally'?' on':''}" data-act="rally" data-tip="Choose where new units gather" data-key="G">Set rally point</button>`;
  return res+pop+raid+buy+q+rally;}
// the victory points in the status capsule: both sides, and who is losing points
function vpHTML(me){const E=G.econ,them=me==='A'?'D':'A',a=Math.ceil(E[me].vp),b=Math.ceil(E[them].vp),w=v=>Math.max(0,Math.min(100,v/ECON.vp0*100));
  return `<div class="vpx"><span class="vpS ${me}"><b class="tn">${a}</b><span>You</span></span><span class="vpBars"><i class="${me}" style="width:${w(a)}%"></i><i class="${them}" style="width:${w(b)}%"></i></span><span class="vpS ${them}"><b class="tn">${b}</b><span>Them</span></span></div>`;}
$('depot').onclick=e=>{const b=e.target.closest('[data-buy],[data-cancel],[data-act]');if(!b||!G||!G.econ)return;
  if(b.dataset.buy)act({k:'build',type:b.dataset.buy});else if(b.dataset.cancel)act({k:'cancel',i:+b.dataset.cancel});
  else if(b.dataset.act==='rally')setMode(G.orderMode==='rally'?'move':'rally');updateHUD(true);};
// a click on the map in rally mode
function rallyAt(x,y){const p=act({k:'rally',x,y});if(p)G.marks.push({x,y,t:.7,mode:'move'});
  // (a guest's rally goes to the host; it shows on its own screen at once)
  if(G.mp&&G.mp.role==='guest'&&G.econ){G.econ[G.player].rally={x,y};G.econ[G.player].rallyT=performance.now();}setMode('move');updateHUD(true);}
// keys: B opens or closes the Depot card, 4–7 build, G sets the rally point
function depotKey(k){if(!G||!G.econ||G.replay)return false;
  if(k==='b'){toggleCard('depot');return true;}
  const t=Object.keys(BUY_KEY).find(t=>BUY_KEY[t]===k);if(t){act({k:'build',type:t});updateHUD(true);return true;}
  if(k==='g'){setMode(G.orderMode==='rally'?'move':'rally');updateHUD(true);return true;}
  return false;}
