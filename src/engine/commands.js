// COMPANY · src/engine/commands.js
// Commands: every action a player takes on the battle, as plain data (unit ids and map points).
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
// The interface calls act(c) for anything that changes the battle; in a single-player game (and for a multiplayer
// host) that runs the command here at once. A multiplayer guest sends it to the host instead (G.mp.send), and the host
// runs it with runCmd for the guest's side. Commands, all with k (the kind):
//   order  {ids, x, y, mode, direct, queue}  move, attack-move, fire mission, pontoon, repair; teleports while deploying
//   hold   {ids}                             stop and hold
//   air    {x, y}                            call an air strike (returns the aim point, or null)
//   trench {parts, spent, live}              dug trench lines; live: the budget was already spent while drawing
//   undo   {}                                undo the last order or trench
//   begin  {}                                the defender ends deployment and the battle starts
function act(c){if(!G)return null;
  // the guest's screen sends the order to the host, whose battle carries it out (a trench's cost is charged there)
  if(G.mp&&G.mp.role==='guest'){G.mp.send(c.k==='trench'?{...c,live:false}:c);return c.k==='air'?(G.air[G.player]>0?airAim(c.x,c.y):null):true;}
  return runCmd(G.player,c);}
// Runs command c for side; only that side's own units take part (ids of other units are ignored).
function runCmd(side,c){if(!G||G.phase==='over')return null;
  // giving up (multiplayer: leaving a battle) ends it at once, whatever the phase
  if(c.k==='surrender')return end(side==='A'?'D':'A',`The ${side==='A'?'attacker':'defender'} surrendered.`),true;
  // deployment belongs to the defender: the attacker can't move, dig or start anything until the battle begins
  if(G.phase==='deploy'&&side!=='D')return null;
  const us=()=>{const by=new Map(G.units.map(u=>[u.id,u]));return(c.ids||[]).map(id=>by.get(id)).filter(u=>u&&u.side===side);};
  switch(c.k){
    case 'order':{const units=us();if(!units.length)return null;pushUndo(units);
      return c.queue?queueOrder(units,c.x,c.y,c.mode,c.direct):order(units,c.x,c.y,c.mode,c.direct);}
    case 'hold':return hold(us());
    case 'air':return G.phase==='play'?sideAir(side,c.x,c.y):null;
    case 'trench':{if(G.phase!=='deploy'||side!=='D')return null;const parts=c.parts||[];
      if(!c.live){if(!(c.spent>=0&&c.spent<=G.budget))return null;G.budget-=c.spent;}
      for(const t of parts){G.trenches.push(t);G.userTrench.push(t);}
      if(parts.length){rebuildTrenchMask();G.undo.push({side,trench:parts,spent:c.spent});}return parts.length>0;}
    case 'undo':return undo(side);
    case 'begin':{if(G.phase!=='deploy')return null;G.phase='play';recInit();G.ctrl=null;updateFront();if(settings.front)frontShape(true);G.undo=[];G.paused=false;
      tell(()=>['The attack has begun','a']);return true;}}
  return null;}
