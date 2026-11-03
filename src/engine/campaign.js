// COMPANY · src/engine/campaign.js
// The campaign: a region of sectors on a hex grid, a company that carries over between battles (health, wounds,
// veterancy), days with the enemy's counterattacks, and a save in the browser. Tables: CAMP and VET in constants.js.
// The screens are in ui/campaign.js. A battle belongs to a campaign when G.camp is set (newGame's opts.camp); every
// other game leaves it null, and units outside a campaign never get vet or cid, so nothing else changes.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
let CP=null;                                   // the running campaign, or null
const CAMP_KEY='company.campaign',CAMP_FMT='company-campaign',CAMP_VER=1,CAMP_LIST='company.campaigns';
const ORD=n=>n+(n%10===1&&n%100!==11?'st':n%10===2&&n%100!==12?'nd':n%10===3&&n%100!==13?'rd':'th');
const UNIT_WORD={inf:'Platoon',tank:'Troop',art:'Battery',eng:'Section'};
const unitName=(type,n)=>`${ORD(n)} ${UNIT_WORD[type]}`;
const STR_N={light:0,standard:1,heavy:2},STR_K=['light','standard','heavy'];
// the hex grid: rows offset (odd rows shifted right), so sector i has up to six neighbours
function hexNeighbours(i){const c=i%CAMP.cols,r=Math.floor(i/CAMP.cols),odd=r&1,out=[];
  for(const [dx,dy] of odd?[[1,0],[-1,0],[0,-1],[1,-1],[0,1],[1,1]]:[[1,0],[-1,0],[-1,-1],[0,-1],[-1,1],[0,1]]){const x=c+dx,y=r+dy;if(x>=0&&y>=0&&x<CAMP.cols&&y<CAMP.rows)out.push(y*CAMP.cols+x);}
  return out;}
// The region from a seed: each sector's battlefield type (leaning toward its neighbours', so the region reads as
// terrain), what the fight there is for (kind), a name, the enemy garrison by row, and three strongholds in the two
// northern rows (different columns: a town, a crossing, and high ground or works where the region has them).
function campRegion(seed){const r=rng((seed*13+9001)>>>0),wp=o=>{const ks=Object.keys(o),t0=ks.reduce((a,k)=>a+o[k],0);let t=r()*t0;for(const k of ks){t-=o[k];if(t<=0)return k;}return ks[ks.length-1];};
  const n=CAMP.cols*CAMP.rows,S=[],used=new Set();
  for(let i=0;i<n;i++){const row=Math.floor(i/CAMP.cols),w={};for(const m in CAMP.modeW){let k=CAMP.modeW[m];for(const j of hexNeighbours(i))if(j<i&&S[j].mode===m)k*=2.2;w[m]=k;}
    const mode=wp(w),kinds=CAMP.kinds[mode],kind=kinds[r()*kinds.length|0];
    let base;do base=PRE[r()*PRE.length|0]+SUF[r()*SUF.length|0];while(used.has(base));used.add(base);
    const name=kind==='works'?base+' Works':kind==='crossing'?base+' Crossing':kind==='crossroads'?base+' Crossroads':kind==='hill'?base+(r()<.5?' Heights':' Hill'):kind==='woods'?base+' Wood':base;
    S.push({i,col:i%CAMP.cols,row,name,mode,kind,strength:wp(CAMP.strength[row]),owner:row===CAMP.rows-1?'A':'D',stronghold:false,seed:(seed*31+i+1)%900000000+1});}
  const north=S.filter(s=>s.row<=1),cols=new Set(),pickSH=f=>{const c=north.filter(s=>!s.stronghold&&!cols.has(s.col)&&f(s));if(!c.length)return false;const s=c[r()*c.length|0];s.stronghold=true;s.strength='heavy';cols.add(s.col);return true;};
  pickSH(s=>s.kind==='town')||pickSH(()=>true);pickSH(s=>s.kind==='crossing'||s.kind==='crossroads')||pickSH(()=>true);pickSH(s=>s.kind==='hill'||s.kind==='works')||pickSH(()=>true);
  return S;}
// a new campaign: o = {name, climate (null: seeded), diff, seed}
function campNew(o){const seed=o.seed>0?o.seed:1+Math.floor(Math.random()*99999),r=rng(seed>>>0);
  const climate=o.climate&&CLIMATES[o.climate]?o.climate:['temperate','temperate','arid','snow','tundra','desert'][r()*6|0];
  const company={name:(CAMP_NAMES.includes(o.name)?o.name:CAMP_NAMES[r()*CAMP_NAMES.length|0])+' Company',mp:CAMP.mp0,roster:[],fallen:[],next:{cid:0,inf:0,tank:0,art:0,eng:0}};
  CP={format:CAMP_FMT,version:CAMP_VER,saved:0,seed,climate,diff:DIFFICULTY[o.diff]?o.diff:'normal',day:1,phase:'plan',sectors:campRegion(seed),company,
    enemy:{reserve:1,lastCounter:-9},counter:null,fought:[],log:[],pending:null,over:null,stats:{battles:0,won:0,lost:0,unitsLost:0,enemyLost:0,rested:0}};
  for(const t of UNIT_TYPES)for(let k=0;k<CAMP.start[t];k++)campAddUnit(t);
  campLog(`${company.name} takes the field. Take the three strongholds (★) within ${CAMP.days} days to win the campaign.`);campSave();return CP;}
function campAddUnit(type){const c=CP.company,u={cid:++c.next.cid,name:unitName(type,++c.next[type]),type,hp:1,wounded:false,xp:0,vet:0,battles:0,dealt:0,rest:false};c.roster.push(u);return u;}
function campLog(text){CP.log.unshift({day:CP.day,text});if(CP.log.length>80)CP.log.length=80;}
const campHeld=()=>CP.sectors.filter(s=>s.owner==='A');
// enemy sectors next to a held one, when it's the player's move
function campAttackable(){if(!CP||CP.phase!=='plan'||CP.pending||CP.over)return[];const out=new Set();for(const s of campHeld())for(const j of hexNeighbours(s.i))if(CP.sectors[j].owner==='D')out.add(j);return[...out];}
// the units a battle takes: everyone not resting, up to CAMP.commit, in roster order
function campCommit(){return CP.company.roster.filter(u=>!u.rest).slice(0,CAMP.commit);}

/* --- saving: the main save, two backups behind it, a check on loading, and a record of finished campaigns --- */
function campValid(d){try{return !!d&&d.format===CAMP_FMT&&d.version===CAMP_VER&&Array.isArray(d.sectors)&&d.sectors.length===CAMP.cols*CAMP.rows&&d.sectors.every(s=>MAP_MODES[s.mode]&&(s.owner==='A'||s.owner==='D')&&typeof s.seed==='number')
    &&!!d.company&&Array.isArray(d.company.roster)&&d.company.roster.every(u=>UNIT_TYPES.includes(u.type)&&typeof u.cid==='number')&&Array.isArray(d.company.fallen)&&typeof d.day==='number'&&!!d.enemy&&Array.isArray(d.log)&&!!d.stats;}catch(e){return false;}}
let campLoadedFrom='';
function campSave(){if(!CP)return;CP.saved=Date.now();try{const cur=localStorage.getItem(CAMP_KEY),b1=localStorage.getItem(CAMP_KEY+'.bak1');
    if(b1)localStorage.setItem(CAMP_KEY+'.bak2',b1);if(cur)localStorage.setItem(CAMP_KEY+'.bak1',cur);localStorage.setItem(CAMP_KEY,JSON.stringify(CP));}catch(e){}}
function campLoad(){for(const k of [CAMP_KEY,CAMP_KEY+'.bak1',CAMP_KEY+'.bak2']){try{const d=JSON.parse(localStorage.getItem(k)||'null');if(campValid(d)){CP=d;campLoadedFrom=k===CAMP_KEY?'':k;return CP;}}catch(e){}}return null;}
function campClear(){CP=null;try{for(const k of [CAMP_KEY,CAMP_KEY+'.bak1',CAMP_KEY+'.bak2'])localStorage.removeItem(k);}catch(e){}}
function campRecords(){try{const L=JSON.parse(localStorage.getItem(CAMP_LIST)||'[]');return Array.isArray(L)?L:[];}catch(e){return [];}}
function campRecord(result){const L=campRecords();L.unshift({name:CP.company.name,result,day:Math.min(CP.day,CAMP.days),battles:CP.stats.battles,won:CP.stats.won,lost:CP.stats.lost,unitsLost:CP.stats.unitsLost,
    veterans:CP.company.roster.filter(u=>u.vet>0).length,sectors:campHeld().length,when:Date.now()});if(L.length>20)L.length=20;try{localStorage.setItem(CAMP_LIST,JSON.stringify(L));}catch(e){}}
function campAbandon(){if(!CP)return;if(!CP.over)campRecord('abandoned');campClear();}
// giving the campaign up: it goes on the record as lost
function campSurrender(){if(!CP)return;if(!CP.over)campRecord('lost');campClear();}

/* --- battles --- */
// the newGame options for a battle in a sector: the committed company as an absolute force (opts.forces), the scenario
// by what the sector is, night every fifth day, and for a defence the enemy's wave sized by its reserve
function campBattle(sec,kind){const me=kind==='attack'?'A':'D',units=campCommit(),counts={inf:0,tank:0,art:0,eng:0};for(const u of units)counts[u.type]++;
  const night=CP.day%5===0,res=CP.enemy.reserve;
  const scen=kind==='attack'?(sec.stronghold?'stronghold':sec.kind==='crossing'||sec.kind==='crossroads'?'crossing':night?'night':'standard'):(res>=CAMP.enemy.blitzAt?'blitz':night?'night':'standard');
  const forces={[me]:counts};
  if(kind==='defend'){const w=CAMP.enemy.wave[res>=CAMP.enemy.blitzAt?2:res>CAMP.enemy.counterAt?1:0];forces.A={};for(const t of UNIT_TYPES)forces.A[t]=Math.max(t==='inf'?3:1,Math.round(ATK[t]*w));}
  return{side:me,strength:kind==='attack'?sec.strength:'standard',seed:sec.seed,mode:sec.mode,gen2:3,diff:CP.diff,climate:CP.climate,scen,forces,
    camp:{id:Date.now()+'-'+sec.i,sector:sec.i,kind,day:CP.day,company:CP.company.name,name:sec.name,stronghold:!!sec.stronghold,units:units.map(u=>({...u})),state:sec.field||null}};}
function campLaunch(o){CP.pending={id:o.camp.id,sector:o.camp.sector,kind:o.camp.kind,day:CP.day,units:o.camp.units.map(u=>u.cid)};campSave();newGame(o);}
function campAttack(i){if(!campAttackable().includes(i))return false;campLaunch(campBattle(CP.sectors[i],'attack'));return true;}
function campDefend(){if(!CP||CP.phase!=='counter'||!CP.counter||CP.pending)return false;campLaunch(campBattle(CP.sectors[CP.counter.sector],'defend'));return true;}
// an interrupted battle (the page was closed mid-battle): fight it again from the start, with the same id
function campRefight(){const p=CP&&CP.pending;if(!p)return false;const o=campBattle(CP.sectors[p.sector],p.kind);o.camp.id=p.id;campSave();newGame(o);return true;}
// or give it up: a loss, with the company as it was
function campWithdrawPending(){const p=CP&&CP.pending;if(!p)return false;const sec=CP.sectors[p.sector];CP.stats.battles++;CP.stats.lost++;
  if(p.kind==='attack')campLog(`The attack on ${sec.name} was broken off.`);else{sec.owner='D';sec.strength='standard';campLog(`${sec.name} was lost to the counterattack.`);}
  const rested=!!(CP.counter&&CP.counter.rested);CP.pending=null;CP.counter=null;if(p.kind==='attack'){CP.phase='plan';campEnemyPhase(false);}else campUpkeep(rested);campSave();return true;}
// after spawn(): the player's units become the committed company (one roster entry per unit of each type: health as
// a share of its cap, wounds, veterancy, name); any unit the force tables added beyond the roster is dropped. A
// stronghold's garrison, and the enemy's biggest counterattacks, are veterans.
function campPatch(){const c=G.camp,me=G.player,by={};for(const t of UNIT_TYPES)by[t]=c.units.filter(u=>u.type===t);
  for(const u of G.units){if(u.side!==me)continue;const r=by[u.type].shift();if(!r)continue;const cap=r.wounded?u.max*WOUND.cap:u.max;
    u.cid=r.cid;u.name=r.name;u.vet=r.vet;u.battles=r.battles;u.wounded=r.wounded;u.hp=Math.max(1,Math.min(cap,Math.round(cap*r.hp)));u.dealt=0;}
  G.units=G.units.filter(u=>u.side!==me||u.cid);G.stats.hp0[me]=G.units.reduce((a,u)=>a+(u.side===me?u.hp:0),0);
  const ev=c.kind==='attack'?(c.stronghold?1:0):(CP&&CP.enemy.reserve>=CAMP.enemy.blitzAt?1:0);if(ev)for(const u of G.units)if(u.side!==me)u.vet=ev;}
// What a battle leaves on the ground stays in the sector for the rest of the campaign (the user asked for it): craters,
// every trench (with whose it was, relative to the player, since the sides swap between an attack and a defence), dirt
// roads, fallen bridges, finished pontoons, and the trench stretches the attacker had seen. The next battle there starts
// from it (campRestore, in newGame before spawn, so the defenders man the trenches that are there).
function campSnapshot(){const me=G.player;return{dmg:G.dmgList.slice(),dirt:G.dirtList.slice(),roads:G.dirtRoads.map(r=>r.pts),
  trenches:G.trenches.map(t=>({pts:t.map(p=>({x:p.x,y:p.y})),mine:t.side?t.side===me:null})),
  bridges:G.bridges.filter(b=>b.down).map(b=>b.id),pontoons:G.pontoons.filter(p=>p.done).map(p=>({x:p.x,mine:p.side===me,hp:p.hp})),
  seen:me==='A'&&G.tSeen?[...G.tSeen]:[]};}
function campRestore(st){const me=G.player,them=me==='A'?'D':'A';
  G.trenches=(st.trenches||[]).map(t=>{const a=t.pts.map(p=>({x:p.x,y:p.y}));if(t.mine===true)a.side=me;else if(t.mine===false)a.side=them;return a;});
  G.userTrench=G.trenches.filter(t=>t.side===me);rebuildTrenchMask();
  for(const id of st.bridges||[]){const b=G.bridges[id];if(b){b.down=true;b.hp=0;}}
  for(const p of st.pontoons||[]){const s=pontoonSite(p.x);if(!s||s.err)continue;s.id=++G.pid;s.side=p.mine?me:them;s.hp=p.hp||CROSSING_HP.pontoon;s.max=CROSSING_HP.pontoon;s.done=true;s.progress=1;G.pontoons.push(s);}
  for(const i of st.dirt||[])G.dirt[i]=1;G.dirtRoads=(st.roads||[]).map(pts=>({pts}));G.dirtList=[];for(let i=0;i<N;i++)if(G.dirt[i])G.dirtList.push(i);
  applyCrossings();for(const i of st.dmg||[])G.dmg[i]=1;roadDamageChanged();
  if(me==='A'&&st.seen&&st.seen.length)G.tSeen=new Set(st.seen);}
// The battle's outcome, once (the save's pending battle must be this one): survivors' health, wounds and experience go
// back to the roster, the fallen to the memorial; the sector changes hands; then the enemy's move and the day's end.
function campResolve(){if(!CP||!G.camp||!G.over||!CP.pending||CP.pending.id!==G.camp.id)return null;
  const me=G.player,them=me==='A'?'D':'A',win=G.over.winner===me,p=CP.pending,sec=CP.sectors[p.sector],c=CP.company,out={win,lost:[],wounded:[],promoted:[],lines:[]};
  sec.field=campSnapshot();
  const alive=new Map();for(const u of G.units)if(u.side===me&&u.cid)alive.set(u.cid,u);
  for(const cid of p.units){const r=c.roster.find(u=>u.cid===cid);if(!r)continue;const u=alive.get(cid);
    if(!u){c.roster.splice(c.roster.indexOf(r),1);c.fallen.push({name:r.name,type:r.type,vet:r.vet,battles:r.battles+1,day:CP.day,where:sec.name});out.lost.push(r.name);CP.stats.unitsLost++;continue;}
    const cap=u.wounded?u.max*WOUND.cap:u.max;r.hp=clamp(u.hp/cap,.05,1);if(u.wounded&&!r.wounded)out.wounded.push(r.name);r.wounded=!!u.wounded;r.battles++;r.dealt+=u.dealt||0;
    r.xp+=VET.battle+(u.dealt||0)/VET.perDmg;const lv=vetLevel(r.xp);if(lv>r.vet){r.vet=lv;out.promoted.push({name:r.name,vet:lv});}}
  CP.stats.battles++;CP.stats[win?'won':'lost']++;CP.stats.enemyLost+=G.stats.lost[them];CP.fought=p.units.slice();
  const rt=(G.mpRating&&G.mpRating[me])||battleRating(me);out.rating=rt;CP.stats.grades=CP.stats.grades||{};CP.stats.grades[rt.grade]=(CP.stats.grades[rt.grade]||0)+1;
  const bonus=RATING.campBonus[rt.grade]||0;if(bonus){c.mp+=bonus;out.bonus=bonus;}
  if(p.kind==='attack'){if(win){sec.owner='A';sec.strength='standard';out.lines.push(`${sec.name} taken.`);
      // the garrison's survivors fall back to the weakest neighbouring enemy sector and strengthen it
      const left=G.units.filter(u=>u.side===them).length,to=hexNeighbours(sec.i).map(j=>CP.sectors[j]).filter(s=>s.owner==='D').sort((a,b)=>STR_N[a.strength]-STR_N[b.strength])[0];
      if(left>=3&&to&&to.strength!=='heavy'){to.strength=STR_K[STR_N[to.strength]+1];out.lines.push(`Its survivors fell back to ${to.name}.`);}}
    else out.lines.push(`The attack on ${sec.name} failed.`);}
  else if(win){CP.enemy.reserve=Math.max(0,CP.enemy.reserve-CAMP.enemy.counterAt);out.lines.push(`${sec.name} held against the counterattack.`);}
  else{sec.owner='D';sec.strength='standard';out.lines.push(`${sec.name} lost to the counterattack.`);}
  out.lines.push(`Rated ${rt.mark}.${out.bonus?` Manpower +${out.bonus} for the showing.`:''}`);if(out.lost.length)out.lines.push(`Fallen: ${out.lost.join(', ')}.`);for(const q of out.promoted)out.lines.push(`${q.name} is now ${VET.name[q.vet]}.`);
  campLog(out.lines.join(' '));const rested=!!(CP.counter&&CP.counter.rested);CP.pending=null;CP.counter=null;
  if(p.kind==='attack'){CP.phase='plan';campEnemyPhase(false);}else campUpkeep(rested);
  G.camp.result=out;campSave();return out;}

/* --- the enemy's move and the end of the day --- */
// the reserve grows; from CAMP.enemy.counterAt the enemy may counterattack the most exposed held sector (not two days
// running), which the player must defend before the day ends
function campEnemyPhase(rested){const e=CP.enemy;e.reserve+=CAMP.enemy.growth[CP.diff];
  const front=campHeld().filter(s=>hexNeighbours(s.i).some(j=>CP.sectors[j].owner==='D')),p=CAMP.enemy.counterP[CP.diff]*Math.min(2,e.reserve/CAMP.enemy.counterAt);
  if(front.length&&e.reserve>=CAMP.enemy.counterAt&&CP.day-e.lastCounter>=2&&Math.random()<p){
    const exposed=s=>hexNeighbours(s.i).filter(j=>CP.sectors[j].owner==='D').length;front.sort((a,b)=>exposed(b)-exposed(a)||a.row-b.row);
    const t=front[0];CP.counter={sector:t.i,rested};CP.phase='counter';e.lastCounter=CP.day;campLog(`The enemy is counterattacking ${t.name}.`);campSave();return true;}
  campUpkeep(rested);return false;}
function campIncome(){let gross=CAMP.income.base;for(const s of campHeld())gross+=CAMP.income.sector[s.kind]||30;let up=0;for(const u of CP.company.roster)up+=CAMP.upkeep[u.type];return{gross,up,net:Math.max(CAMP.income.floor,gross-up)};}
// income, healing for the units that didn't fight (more on a rest day, which also clears some wounds), the next day
function campUpkeep(rested){const c=CP.company,inc=campIncome();c.mp+=inc.net;const fought=new Set(CP.fought||[]),heal=rested?CAMP.rest.restHeal:CAMP.rest.heal;
  for(const u of c.roster)if(rested||!fought.has(u.cid))u.hp=Math.min(1,u.hp+heal);
  if(rested){let n=Math.max(1,Math.floor(c.roster.length/4));for(const u of c.roster.slice().sort((a,b)=>b.vet-a.vet)){if(!n)break;if(u.wounded){u.wounded=false;n--;}}CP.stats.rested++;}
  CP.fought=[];CP.counter=null;CP.phase='plan';CP.day++;
  campLog(`Manpower +${Math.round(inc.net)} (${Math.round(inc.gross)} income − ${Math.round(inc.up)} upkeep).`);campCheckOver();campSave();}
function campCheckOver(){const held=campHeld(),sh=CP.sectors.filter(s=>s.stronghold);
  if(sh.every(s=>s.owner==='A'))return campFinish(true,`All three strongholds fell on day ${CP.day-1}.`);
  if(!held.length)return campFinish(false,'The company was driven out of the region.');
  if(CP.company.roster.length<2&&CP.company.mp<ECON.cost.inf.mp)return campFinish(false,'The company was destroyed.');
  if(CP.day>CAMP.days)return campFinish(false,`Day ${CAMP.days} passed with the strongholds still in enemy hands.`);}
function campFinish(win,reason){CP.over={win,reason,day:Math.min(CP.day,CAMP.days)};CP.phase='over';campLog((win?'Victory. ':'Defeat. ')+reason);campRecord(win?'won':'lost');}
// giving a counterattacked sector up without a fight: it changes hands, the company loses nothing, the day ends
function campConcede(){if(!CP||CP.phase!=='counter'||!CP.counter||CP.pending)return false;const s=CP.sectors[CP.counter.sector];s.owner='D';s.strength='standard';
  campLog(`${s.name} given up to the counterattack without a fight.`);const rested=!!CP.counter.rested;CP.counter=null;campUpkeep(rested);return true;}
function campRest(){if(!CP||CP.phase!=='plan'||CP.pending||CP.over)return false;campLog('The company rests.');campEnemyPhase(true);return true;}

/* --- the company between battles --- */
function campBuy(type){if(!CP||CP.pending||CP.over||!ECON.cost[type])return null;const cost=ECON.cost[type].mp;if(CP.company.mp<cost)return null;CP.company.mp-=cost;const u=campAddUnit(type);campSave();return u;}
function campRefit(cid){const u=CP&&CP.company.roster.find(x=>x.cid===cid);if(!u||!u.wounded||CP.company.mp<CAMP.refit||CP.pending||CP.over)return false;CP.company.mp-=CAMP.refit;u.wounded=false;u.hp=1;campSave();return true;}
function campRestToggle(cid){const u=CP&&CP.company.roster.find(x=>x.cid===cid);if(!u||CP.pending||CP.over)return false;u.rest=!u.rest;campSave();return true;}
