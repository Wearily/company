#!/usr/bin/env node
// Reads a COMPANY replay file (Settings → Replays → Download, or the download button on the end screen / replay bar)
// and prints what happened and what the computer was thinking, so a battle can be studied outside the game.
//
//   node tools/replay.mjs <replay.json.gz>                    overview, events and the AI's decisions over time
//   node tools/replay.mjs <file> --from 2:00 --to 4:30        only that stretch of the battle
//   node tools/replay.mjs <file> --at 3:15                    every unit at that moment: where, health, firing at whom
//   node tools/replay.mjs <file> --unit 23                    one unit's whole story: orders, position, health
//
// Coordinates are world pixels (1 px = 2.5 m, the map is 2000 × 1400, y grows southward); "near B 120" means 120 px
// from objective B. The map itself isn't in the file: open the replay in the game (Settings → Open a replay file) to
// see it, or rebuild it from the game code with the game's own generator.
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';

const args=process.argv.slice(2),file=args.find(a=>!a.startsWith('--')&&!/^\d/.test(a));
if(!file){console.error('usage: node tools/replay.mjs <replay.json.gz> [--from m:ss] [--to m:ss] [--at m:ss] [--unit id]');process.exit(1);}
const opt=k=>{const i=args.indexOf('--'+k);return i>=0?args[i+1]:null;};
const sec=s=>{if(s==null)return null;const [m,x]=String(s).split(':');return x==null?+m:(+m)*60+(+x);};
const fmt=t=>{t=Math.max(0,Math.round(t));return `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;};
let buf=readFileSync(file);if(buf[0]===0x1f&&buf[1]===0x8b)buf=gunzipSync(buf);
const d=JSON.parse(buf.toString('utf8'));
if(d.format!=='company-replay'){console.error('not a COMPANY replay');process.exit(1);}
const R=d.rec,o=d.opts,meta=new Map(R.meta.map(([id,side,type,max,died])=>[id,{side,type,max,died}]));
const objs=d.names.objs,TN={inf:'infantry',tank:'armor',art:'artillery',eng:'engineers'};
const near=(x,y)=>{let b=null,bd=1e9;for(const q of objs){const dd=Math.hypot(q.x-x,q.y-y);if(dd<bd){bd=dd;b=q;}}return `near ${b.key} ${Math.round(bd)}`;};
const who=id=>{const m=meta.get(id);return m?`${m.side}#${id} ${m.type}`:`#${id}`;};
const t0=sec(opt('from'))??0,t1=sec(opt('to'))??1e9,inRange=t=>t>=t0&&t<=t1;
const end=R.frames[R.frames.length-1].t;

// --- one moment
if(opt('at')){const t=sec(opt('at'));const f=R.frames.reduce((b,q)=>Math.abs(q.t-t)<Math.abs(b.t-t)?q:b,R.frames[0]);
  console.log(`State at ${fmt(f.t)}  objectives: ${f.obj.map((q,k)=>`${objs[k].key} ${q[0]}${q[2]?' contested':''} ${q[1].toFixed(2)}`).join(', ')}`);
  const fire=new Map();for(let k=0;k<f.fire.length;k+=2)fire.set(f.fire[k],f.fire[k+1]);
  for(const side of ['A','D']){console.log(`\n${side==='A'?'Attacker':'Defender'}${o.side===side?' (player)':' (computer)'}:`);
    for(let k=0;k<f.id.length;k++){const m=meta.get(f.id[k]);if(m.side!==side)continue;const fl=f.fl[k];
      console.log(`  #${f.id[k]} ${m.type.padEnd(4)} (${f.x[k]},${f.y[k]}) ${near(f.x[k],f.y[k]).padEnd(12)} hp ${Math.round(f.hp[k]/2.55)}%${fl&1?' OUT OF SUPPLY':''}${fl&2?' holding':''}${fl&4?' guns set up':''}${fire.has(f.id[k])?' firing at '+who(fire.get(f.id[k])):''}`);}}
  process.exit(0);}

// --- one unit
if(opt('unit')){const id=+opt('unit'),m=meta.get(id);if(!m){console.error('no such unit');process.exit(1);}
  console.log(`${who(id)} (${o.side===m.side?'player':'computer'})${m.died>=0?', lost at '+fmt(m.died):''}`);
  let lastPos=null;
  for(const e of R.ai){if(!inRange(e.t))continue;const u=e.units.find(v=>v[0]===id);
    const f=R.frames.reduce((b,q)=>Math.abs(q.t-e.t)<Math.abs(b.t-e.t)?q:b,R.frames[0]),k=f.id.indexOf(id);
    const pos=k>=0?`(${f.x[k]},${f.y[k]}) ${near(f.x[k],f.y[k])} hp ${Math.round(f.hp[k]/2.55)}%`:'gone';
    if(u){const [,role,grp,mode,goal,retake,sector,falling,tx,ty,tgt]=u;
      console.log(`${fmt(e.t).padStart(5)}  ${pos}  → ${mode}${tx>=0?` to (${tx},${ty}) ${near(tx,ty)}`:' (no route)'}${role?' role '+role:''}${grp>=0?' group '+grp:''}${goal?' goal '+goal:''}${sector>=0?' sector '+objs[sector].key:''}${retake>=0?' RETAKING '+objs[retake].key:''}${falling?' falling back':''}${tgt>=0?' target '+who(tgt):''}`);lastPos=pos;}
    else if(pos!==lastPos&&e.t%20<2){console.log(`${fmt(e.t).padStart(5)}  ${pos}`);lastPos=pos;}}
  process.exit(0);}

// --- overview
console.log(`COMPANY replay  ${d.code}  saved ${d.saved}`);
console.log(`${o.scen} · ${o.mode} · ${o.climate} · ${o.gen2?'new':'legacy'} map generation · seed ${o.seed} · player ${o.side==='A'?'attacks':'defends'} · ${o.strength} defense · ${o.diff}`);
console.log(`Length ${fmt(end)}${d.over?` · result: ${d.over.winner===null?'draw':d.over.winner==='A'?'attacker won':'defender won'} (${d.over.reason})`:' · not finished'}${d.plan?` · attacker plan: ${d.plan.name}`:''}`);
console.log('Objectives: '+objs.map(q=>`${q.key} ${q.name}${q.kind?' ('+q.kind+')':''} at (${Math.round(q.x)},${Math.round(q.y)})`).join('; '));
const cnt=s=>{const c={};for(const m of meta.values())if(m.side===s)c[m.type]=(c[m.type]||0)+1;return Object.entries(c).map(([k,v])=>`${v} ${TN[k]}`).join(', ');};
console.log(`Forces: attacker ${cnt('A')}; defender ${cnt('D')}`);
const lost=s=>[...meta].filter(([,m])=>m.side===s&&m.died>=0).map(([id,m])=>`${m.type}#${id} ${fmt(m.died)}`);
console.log(`Lost: attacker ${lost('A').length} [${lost('A').join(', ')}]; defender ${lost('D').length} [${lost('D').join(', ')}]`);
console.log('\nEvents and log:');
const lines=[...R.log.map(l=>[l.t,l.msg]),...R.events.filter(e=>e.k!=='cap').map(e=>[e.t,{air:`air strike (${e.side})`,bridge:'a bridge fell',pont:`pontoon finished (${e.side})`,reinf:`reinforcements (${e.side})`}[e.k]||e.k])].filter(([t])=>inRange(t)).sort((a,b)=>a[0]-b[0]);
for(const [t,m] of lines)console.log(`  ${fmt(t).padStart(5)}  ${m}`);
console.log('\nThe computer\'s decisions (only changes):');
let lastDef='',lastGroups=new Map();
for(const e of R.ai){if(!inRange(e.t))continue;const out=[];
  if(e.def){const s=`reserve ${e.def.mode}${e.def.ti>=0?' on '+objs[e.def.ti].key:''}`;if(s!==lastDef){out.push(`${s}; threat ${objs.map((q,k)=>q.key+' '+(e.def.threat?e.def.threat[k]:'?')).join(' ')}`);lastDef=s;}}
  if(e.att)for(const g of e.att.groups){const [i,axis,stance,state,ord,alive,size]=g,s=`${stance} ${state} via ${axis} objectives ${ord.split('').map(k=>objs[+k].key).join('')} ${alive}/${size}`;
    if(lastGroups.get(i)!==s){out.push(`group ${i}: ${s}`);lastGroups.set(i,s);}}
  const moves=e.units.filter(u=>u[8]>=0||u[5]>=0);
  if(moves.length)out.push(`${moves.length} unit order${moves.length>1?'s':''}: `+moves.slice(0,8).map(u=>`#${u[0]} ${u[3]}→${u[8]>=0?near(u[8],u[9]):'-'}${u[5]>=0?' (retake '+objs[u[5]].key+')':''}${u[4]?' ['+u[4]+']':''}`).join('; ')+(moves.length>8?` …+${moves.length-8}`:''));
  if(out.length)console.log(`  ${fmt(e.t).padStart(5)}  ${out.join('\n         ')}`);}
