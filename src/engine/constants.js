// COMPANY · src/engine/constants.js
// Tunable numbers and tables: world size, unit types, movement and damage tables, forces, scenarios, climates, battlefields,
// game codes, colours.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
const W=2000,H=1400,C=8,GW=W/C,GH=H/C,N=GW*GH;
const OPEN=0,FIELD=1,FOREST=2,URBAN=3,WATER=4,STREAM=5,ROCK=6;
const M_PER_PX=2.5, TIME_LIMIT=15*60, STEP=1/20, ZONE=260;
const TYPES={
  inf:{name:'Infantry',hp:100,speed:15,range:85,vision:175},
  tank:{name:'Armor',hp:240,speed:27,range:125,vision:150},
  art:{name:'Artillery',hp:80,speed:12,range:430,minRange:90,vision:120},
  eng:{name:'Engineers',hp:80,speed:14,range:70,vision:140},
};
// the HUD fonts have no hexagon glyph, so engineers get an inline SVG
const HEX='<svg class="hex" viewBox="0 0 10 10"><polygon points="5,0 9.3,2.5 9.3,7.5 5,10 .7,7.5 .7,2.5"/></svg>';
const UNIT_TYPES=['inf','tank','art','eng'],SYM={inf:'●',tank:'■',art:'▲',eng:HEX};
// per terrain class: open, field, forest, urban, water, stream, rock (armor and guns can't climb rock)
const MOVE={inf:[1,.9,.6,.85,0,.45,.35],eng:[1,.9,.6,.85,0,.45,.35],tank:[.8,.7,.22,.5,0,.18,0],art:[.6,.5,.25,.6,0,.15,0]};
const ROADMOVE={inf:1.6,tank:2.3,art:2.0,eng:1.6},HIGHWAY=1.2;
const DPS={inf:{inf:3.6,tank:1.0,art:4.5,eng:4.0},tank:{inf:4.4,tank:5.5,art:6.5,eng:5.0},eng:{inf:1.6,tank:.3,art:2.5,eng:1.6}};
const FORCES={light:{inf:8,tank:2,art:1,eng:1},standard:{inf:11,tank:3,art:2,eng:1},heavy:{inf:14,tank:4,art:3,eng:1}};
const ATK={tank:4,inf:10,art:3,eng:2};
// pontoon: seconds for one engineer team to build, widest river it can span (px), how close the builder must stand to its bank end
const PONTOON={time:40,maxLen:150,reach:26};
// air strike: strikes per side, seconds from call to impact, bomb blast radius and center damage, bomb distance that drops a bridge, AI wait between strikes
// a unit standing in a stream fires at this fraction of its output, and takes this much more damage (no cover)
// capture: objective radius, how far out the owner's units still count (they hold the trenches around it), progress per unit per second
const CAPTURE={radius:75,hold:110,rate:.025};
// crossings have health: a bomb on the span drops it outright; a fire-mission shell within `hit` px of the span takes
// `bridge` (or `pontoon`) off it. Fire-mission shells that land on road crater it with probability `crater`.
const CROSSING_HP={bridge:100,pontoon:60};
const SHELL_VS={hit:14,bridge:10,pontoon:15,crater:.45};
// road damage: bombs crater road cells within `radius` px; a cratered cell moves at `move` × the off-road speed of the ground under it
// (so it's slower than leaving the road) but still carries supply;
// an engineer clears one cell every `cellTime` s, working on cells within `reach` px
const ROAD_DMG={radius:14,move:.5,cellTime:2.5,reach:22};
// high ground: bonuses grow with height from `from` to full at `to` (normalized height). At full height direct fire
// reaches `range` farther, artillery `artRange` farther, vision `vision` farther, and incoming fire is cut by `cover`.
const HILL={from:.62,to:.95,range:.4,artRange:.2,vision:.35,cover:.12};
// supply reach (px): around supplied highways, bridges and pontoons; around supplied minor roads; around the depot;
// how far a supplied pontoon's landing reaches to join roads; zone of control: an enemy unit holds the ground within this
// distance unless one of your units is closer, and supply can't pass through enemy-held ground
// claim: how far around each of your units ground on the enemy's half of the battlefield counts as taken (see updateClaim)
const SUPPLY={major:160,minor:96,depot:240,link:96,zoc:56,claim:140};
// Trenches. A unit is dug in when it stands on a trench (within about 12 px of the line) and isn't moving. Dug in, it
// takes `fire` × direct-fire damage, `shell` × artillery and `air` × bomb damage, and is seen at `hide` × enemy vision
// range. Orders aimed within `snap` px of a trench put the units onto the trench line, `gap` px apart, so a click next
// to a trench mans it.
// line of control, two-line style: depth of the no-man's land along each bank at the start
const FRONT_CLOSE=16,FRONT_GAP=110;
const TRENCH={fire:.42,shell:.45,air:.5,hide:.6,snap:40,gap:18};
const STREAM_FIRE=.5,STREAM_EXPOSED=1.15;
// Frozen rivers and lakes (climates with frozen:true, i.e. Winter). Infantry and engineers can cross on foot at ICE.move; the ice won't
// take armour or guns. Out on the ice there is nothing to hide behind: a unit there fires at ICE.fire, takes ICE.exposed
// times the damage from fire, shells and bombs, and is seen from ICE.seen times as far.
const ICE={move:.45,fire:.7,exposed:1.25,seen:1.25};
const AIR={count:2,delay:8,radius:38,dmg:85,bridgeHit:24,aiCooldown:60};
const BUDGET={light:1000,standard:800,heavy:600};
// Battlefields. Generation: `wet` (a river on the front line or not), river width (`rw` base and variation, `townBump`
// widening through town, `bump2` chance of a second wide reach), `lake` (one huge widening: amplitude and spread),
// `valley` (how strongly ground falls toward the front line), hills, `ridges` (rock walls on both flanks, rock above
// `rockH`), town size and extra quarters, extra downtown bridges, villages, streams, forest and field shares, and how far
// objective C may lie from the town. Rules: force changes per side, trench budget, vision, air strikes, and the attack
// plans the AI may draw. River Town keeps salt 0 so its maps match older seeds. `v2`: the ranges the new map generator
// (genMap2) rolls each map from: noise scale, river width and widenings, lakes, crossings, towns, villages, streams, hills,
// escarpment and massif chances, rock height, forest and field shares.
const MAP_MODES={
  river:{name:'River Town',desc:'A river town, its three bridges and the hill above it.',rules:'The classic: bridges, a town and a hill.',
    salt:0,wet:true,rw:[13,10],townBump:[30,55],bump2:.7,valley:.4,hills:5,hillAmp:1,town:{scale:1},villages:7,streams:9,forest:.17,field:.18,cDist:[260,720],
    forces:{},budget:1,vision:1,air:0,doctrines:['broad','feint','hook','bombard','crossing','probe'],
    desc2:'A river front with towns, villages and two to five bridges, laid out anew every map.',v2:{scale:[260,480],rw:[15,26],widen:[0,2],lakes:[0,2],cross:[2,5],towns:[0,2],villages:[5,9],streams:[6,10],hills:[3,7],escarp:.35,forest:[.1,.24],field:[.12,.24]}},
  lake:{name:'Lake Narrows',desc:'A lake splits the field. One long causeway crosses it; otherwise go round by the narrows at either end.',rules:'Pontoons can\'t span the lake. Flanks are long.',
    salt:7919,wet:true,rw:[12,8],lake:[[270,330],[250,300]],bump2:0,valley:.4,hills:5,hillAmp:1,town:{scale:.9},villages:7,streams:8,forest:.16,field:.18,cDist:[260,720],
    forces:{},budget:1,vision:1.05,air:0,doctrines:['hook','feint','bombard','probe'],
    desc2:'A great lake somewhere along the river, crossed by a causeway, with smaller lakes around it.',v2:{scale:[280,500],rw:[14,22],widen:[0,1],bigLake:true,lakes:[1,3],cross:[2,4],towns:[0,1],villages:[5,8],streams:[5,9],hills:[3,6],escarp:.3,forest:[.1,.22],field:[.12,.22]}},
  city:{name:'City Fight',desc:'A city sprawls over both banks, with extra bridges downtown.',rules:'Infantry-heavy forces. Street fighting, short trenches.',
    salt:15838,wet:true,rw:[13,8],townBump:[30,50],bump2:.4,valley:.4,hills:4,hillAmp:1,town:{scale:1.55,extra:true},cityBridges:2,villages:4,streams:6,forest:.1,field:.12,cDist:[180,460],
    forces:{A:{tank:-2,inf:3},D:{tank:-1,inf:2}},budget:.8,vision:.95,air:0,doctrines:['broad','bombard','probe','feint'],
    desc2:'A city along the river with several bridges and an industrial quarter.',v2:{scale:[300,520],rw:[18,30],widen:[0,1],city:true,townScale:1.1,lakes:[0,1],cross:[3,5],towns:[0,1],works:.85,villages:[3,6],streams:[3,6],hills:[2,5],escarp:.25,forest:[.06,.14],field:[.08,.16]}},
  steppe:{name:'Open Steppe',desc:'Dry rolling farmland with no river: a crossroads, scattered villages and long sightlines.',rules:'Armor country. Long sightlines, deeper trenches.',
    salt:23757,wet:false,rw:[0,0],townBump:[0,0],bump2:0,valley:.12,hills:4,hillAmp:.8,town:{scale:.8},villages:9,streams:5,forest:.05,field:.34,cDist:[260,720],
    forces:{A:{tank:2,inf:-2},D:{tank:1,inf:-1}},budget:1.4,vision:1.15,air:0,doctrines:['broad','hook','probe','feint'],
    desc2:'Dry open country: no river, scattered villages and ponds, crossroads on the front.',v2:{scale:[300,560],lakes:[1,3],towns:[1,2],villages:[7,11],streams:[3,6],hills:[2,5],escarp:.45,lateral:.7,forest:[.02,.08],field:[.25,.4]}},
  mountain:{name:'Mountain Pass',desc:'Rocky ridges wall both flanks. The valley road and two mountain passes are the only ways through.',rules:'Armor can\'t cross rock. High ground rules.',
    salt:31676,wet:true,rw:[10,6],townBump:[16,28],bump2:.3,valley:.3,hills:3,hillAmp:1,ridges:true,rockH:.64,town:{scale:.85},villages:5,streams:7,forest:.24,field:.1,cDist:[240,720],
    forces:{A:{tank:-2,inf:2},D:{tank:-1,inf:1}},budget:1,vision:1.05,air:0,doctrines:['probe','feint','bombard','hook'],
    desc2:'Rock massifs at any angle, with passes cut through them; armor keeps to the gaps.',v2:{scale:[220,400],rw:[12,20],widen:[0,1],lakes:[0,2],cross:[1,3],towns:[0,1],villages:[4,7],streams:[6,10],hills:[2,4],massif:[2,3],rockH:.66,escarp:.2,forest:[.16,.3],field:[.06,.12]}},
  forest:{name:'Deep Woods',desc:'Dense forest around a narrow river and a small town.',rules:'Short sightlines and ambushes. Armor is road-bound.',
    salt:39595,wet:true,rw:[11,6],townBump:[18,30],bump2:.5,valley:.4,hills:5,hillAmp:.9,town:{scale:.8},villages:6,streams:9,forest:.42,field:.07,cDist:[260,720],
    forces:{A:{tank:-1,inf:1}},budget:1,vision:.8,air:0,doctrines:['probe','hook','crossing','feint'],
    desc2:'Dense woods around a narrow river, with clearings, villages and few bridges.',v2:{scale:[240,420],rw:[12,20],widen:[0,1],lakes:[0,2],cross:[1,4],towns:[0,1],villages:[4,7],streams:[7,11],hills:[3,6],escarp:.3,forest:[.34,.5],field:[.04,.1]}},
};
// Difficulty changes only the computer's side: force size, air strikes, how often it calls them, and how soon an
// assault breaks off (the share of a group left when it falls back).
const DIFFICULTY={easy:{name:'Easy',force:.8,air:-1,cool:1.5,breakAt:.5},normal:{name:'Normal',force:1,air:0,cool:1,breakAt:.4},hard:{name:'Hard',force:1.2,air:1,cool:.75,breakAt:.3}};
// Scenarios: the goal and setup of a game, on any battlefield, played from either side. limit: seconds; need: how many
// objectives the attacker must hold when time runs out (3+ means it must take all three before then); holdA: seconds the
// attacker must hold objective A without a break to win; forces/air: changes per side; reinf: reinforcements reaching a
// side's depot at time t; counter: the attacker starts holding A and B; neutral: objectives start unowned and either side
// wins with more of them; deploy: false skips the defender's deployment; trenches: false means none; night: darker map,
// vision × vision, no air strikes.
const SCENARIOS={
  standard:{code:'ST',name:'Standard Battle',desc:'The full battle for the crossing, the town and the hill.',
    goal:{A:'Take all three objectives, or hold two of three when the clock runs out.',D:'Stop the attacker holding two of the three objectives when the clock runs out.'},limit:900,need:2},
  laststand:{code:'LS',name:'Last Stand',desc:'A bigger attack falls on the line. Defender reinforcements reach the defender’s depot at 4:00 and 8:00.',
    goal:{A:'Take all three objectives before 12:00.',D:'Hold out: keep at least one objective until 12:00.'},limit:720,need:3,forces:{A:{inf:3,tank:1}},
    reinf:[{t:240,side:'D',units:{inf:3,tank:1}},{t:480,side:'D',units:{inf:3,tank:2}}]},
  blitz:{code:'BZ',name:'Blitz',desc:'An armoured spearhead against a thin defence, racing the clock.',
    goal:{A:'Take all three objectives within 8:00.',D:'Keep at least one objective until 8:00.'},limit:480,need:3,forces:{A:{tank:2},D:{inf:-3}}},
  crossing:{code:'SC',name:'Seize the Crossing',desc:'Everything turns on objective A. The defender has an extra air strike to drop the bridge.',
    goal:{A:'Take objective A and hold it for 2 minutes without a break, within 10:00.',D:'Never let the attacker hold objective A for 2 minutes, until 10:00.'},limit:600,need:9,holdA:120,air:{D:1}},
  counter:{code:'CA',name:'Counterattack',desc:'The attacker has already taken the crossing and the town. The defender, pushed back, gets reinforcements at 3:00.',
    goal:{A:'Hold two of the three objectives until 15:00.',D:'Retake two of the three objectives before 15:00.'},limit:900,need:2,counter:true,deploy:false,
    reinf:[{t:180,side:'D',units:{inf:3,tank:1}}]},
  meeting:{code:'ME',name:'Meeting Engagement',desc:'Both forces start at their depots and race for unclaimed objectives. No trenches, even forces.',
    goal:{A:'Hold more objectives than the enemy at 12:00, or all three at once.',D:'Hold more objectives than the enemy at 12:00, or all three at once.'},limit:720,neutral:true,deploy:false,trenches:false,forces:{D:{tank:1,art:1}}},
  night:{code:'NA',name:'Night Assault',desc:'A larger infantry attack under darkness: sight cut to about half and no air strikes.',
    goal:{A:'Take all three objectives, or hold two of three when the clock runs out.',D:'Stop the attacker holding two of the three objectives when the clock runs out.'},limit:900,need:2,night:true,vision:.55,noAir:true,forces:{A:{inf:2}}},
};
// Game codes pack every setup option into a short shareable string: scenario-battlefield-climate-side/strength/difficulty-seed,
// for example LS-RT-DE-DSN-15RA-V2. The last part, V2, means the new map generator; a code without it (every code made
// before it existed) uses the legacy generator, so old links keep their maps. Pages opened with #game=CODE (or an older
// ?game=CODE link) start from those options.
const MODE_CODE={river:'RT',lake:'LN',city:'CF',steppe:'OS',mountain:'MP',forest:'DW'},CLIM_CODE={temperate:'TE',arid:'AR',desert:'DE',snow:'WI',tundra:'TU'};
const STR_CODE={light:'L',standard:'S',heavy:'H'},DIFF_CODE={easy:'E',normal:'N',hard:'H'};
const keyOf=(tbl,v)=>Object.keys(tbl).find(k=>tbl[k]===v);
function encodeGame(o){return [SCENARIOS[o.scen].code,MODE_CODE[o.mode],CLIM_CODE[o.climate],o.side+STR_CODE[o.strength]+DIFF_CODE[o.diff],o.seed.toString(36).toUpperCase()].join('-')+(o.gen2?'-V2':'');}
function decodeGame(code){const p=String(code||'').trim().toUpperCase().split('-');if(!(p.length===5||(p.length===6&&p[5]==='V2'))||p[3].length!==3)return null;
  const scen=Object.keys(SCENARIOS).find(k=>SCENARIOS[k].code===p[0]),mode=keyOf(MODE_CODE,p[1]),climate=keyOf(CLIM_CODE,p[2]),side=p[3][0],
    strength=keyOf(STR_CODE,p[3][1]),diff=keyOf(DIFF_CODE,p[3][2]),seed=parseInt(p[4],36);
  if(!scen||!mode||!climate||(side!=='A'&&side!=='D')||!strength||!diff||!(seed>0&&seed<1e9))return null;
  return{scen,mode,climate,side,strength,diff,seed,gen2:p.length===6};}
const SC=()=>SCENARIOS[(G&&G.scen)||'standard'];
const COL={A:'#17181c',D:'#7a2cbf',N:'#5f635d',sel:'#ffc400',road:'#e3120b',water:'#0b57f0',ice:'#a9c5f2',forest:'#0d7a2e',field:'#f8c9a0',ink:'#1b1d1a',trench:'#4a3523'};
const SIDE_NAME={A:'Attacker',D:'Defender'};

// Climates change how the ground is drawn and add small movement and vision rules; the map underneath is the same.
//   offroad: movement multiplier off roads; vision: sight multiplier
const CLIMATES={
  temperate:{name:'Temperate',desc:'Green farmland, hedgerows and broadleaf woods.',rules:'No climate effects.',offroad:1,vision:1},
  arid:{name:'Arid',desc:'Dusty plots, irrigated fields, olive orchards, greenhouses and flat-roofed villages.',rules:'Sightlines 5% longer.',offroad:1,vision:1.05},
  desert:{name:'Desert',desc:'Dune seas and gravel plains, crop circles, palm groves and a green irrigated river valley.',rules:'Soft sand: off-road movement 10% slower. Sightlines 15% longer.',offroad:.9,vision:1.15},
  snow:{name:'Winter',desc:'Deep snow on fields and roofs, dark snowy forest, cleared roads and a frozen river.',rules:'Deep snow: off-road movement 20% slower, vision 10% shorter. Infantry and engineers can cross the frozen river and lakes on foot, slowly and in the open.',offroad:.8,vision:.9,frozen:true},
  tundra:{name:'Tundra',desc:'Moss, lichen and bog, sparse taiga, gravel roads and bright metal roofs.',rules:'Boggy ground: off-road movement 15% slower.',offroad:.85,vision:1.05},
};
