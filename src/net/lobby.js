// COMPANY · src/net/lobby.js
// The multiplayer session: hosting or joining a room, the lobby (the host's settings, the guest's Ready), and the start.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
// L is the session. role: 'host' | 'guest' | null. The host owns the settings; the guest sees them live (its own copy
// has the sides swapped) and must press Ready before the host can start. Any settings change un-readies the guest.
// Messages: {type, from, to?, ...}. host → guest: lobby, start, log, refuse, f (a battle frame, see sync.js). Both ways: chat. guest → host: hello, ready, cmd. Both ways:
// ping and pong (keep-alive and round trip), leave.
// time: the host may pause and change the speed in the battle (a lobby setting; off, the battle runs at 1× unpaused).
const L={role:null,room:null,t:null,cid:null,peer:null,host:null,peerSeen:0,ready:false,rtt:null,key:'',inGame:false,
  timer:null,joining:null,diff0:null,note:'',time:false,name:'',gid:'',game:null,gone:false};
// In a battle (see the battle section below): gid names this battle (a repeated start for it is ignored), game is the
// host's {opts, time} for resending to a guest who rejoins, and gone marks a player who left mid-battle (a host
// can't come back, a guest can).
try{L.name=localStorage.getItem('company.name')||'';}catch(e){}
const otherSide=s=>s==='A'?'D':'A';
const rid=(n,chars)=>[...crypto.getRandomValues(new Uint32Array(n))].map(v=>chars[v%chars.length]).join('');
const mpNow=()=>performance.now();
function mpSend(type,data){if(L.t)L.t.send(Object.assign({type,from:L.cid},data));}
function mpInviteURL(){return location.href.split('#')[0].split('?')[0]+'#room='+L.room;}

// Host a new room. The host's own settings carry on; difficulty doesn't apply (no computer player), so it is set
// to Normal for the lobby and put back on leaving.
async function mpCreate(){mpLeave();L.cid=rid(10,MP.codeChars);L.room=rid(MP.codeLen,MP.codeChars);L.role='host';
  try{L.t=await openTransport(L.room);}catch(e){mpReset();throw e;}
  L.t.onMessage=mpOnMessage;L.diff0=opts.diff;opts.diff='normal';L.key='';syncSegs();syncCode();
  L.timer=setInterval(mpTick,MP.tick*1000);L.note='Send the code or invite link to your opponent.';lobbyChanged();}
// Join a room by its code. Resolves once the host has let us in.
async function mpJoin(code){code=String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(code.length!==MP.codeLen)throw new Error(`A game code has ${MP.codeLen} letters and digits.`);
  mpLeave();const was=mpStored();L.cid=was&&was.room===code?was.cid:rid(10,MP.codeChars);L.room=code;L.role='guest';
  try{L.t=await openTransport(code);}catch(e){mpReset();throw e;}
  L.t.onMessage=mpOnMessage;L.timer=setInterval(mpTick,MP.tick*1000);
  return new Promise((res,rej)=>{L.joining={res,rej,until:mpNow()+MP.joinTimeout*1000};mpSend('hello',{v:MP.proto});});}
function mpJoinFailed(msg){const j=L.joining;L.joining=null;mpReset();if(j)j.rej(new Error(msg));}

function mpOnMessage(m){if(!m||m.from===L.cid||(m.to&&m.to!==L.cid))return;
  if(L.role==='host'){
    if(m.type==='hello'){
      if(m.v!==MP.proto)return mpSend('refuse',{to:m.from,why:'Your game is a different version from the host’s. Both of you reload the page and try again.'});
      // in a battle, the guest may come back: the same tab after a reload, or anyone once the guest has gone quiet
      if(L.inGame&&G&&G.mp&&G.phase!=='over'){if(m.from!==L.peer&&!mpPeerLost())return mpSend('refuse',{to:m.from,why:'That game has already started.'});
        L.peer=m.from;L.peerSeen=mpNow();L.gone=false;return mpResume();}
      if(L.peer&&L.peer!==m.from&&(L.inGame||mpNow()-L.peerSeen<MP.peerTimeout*1000))return mpSend('refuse',{to:m.from,why:'That game already has two players.'});
      if(L.inGame&&L.peer!==m.from)return mpSend('refuse',{to:m.from,why:'That game has already started.'});
      L.peer=m.from;L.peerSeen=mpNow();L.ready=false;L.note='';mpLobby();lobbyChanged();return;}
    if(m.from!==L.peer)return;L.peerSeen=mpNow();
    // a Ready counts only for the settings the guest saw (key), so one crossing a settings change is ignored
    if(m.type==='ready'&&!L.inGame){L.ready=!!m.ready&&m.key===L.key;mpLobby();lobbyChanged();}
    else if(m.type==='ping')mpSend('pong',{to:m.from,ts:m.ts});
    else if(m.type==='pong'){L.rtt=mpNow()-m.ts;if(!L.inGame)lobbyChanged();}
    else if(m.type==='leave'){if(L.inGame&&G&&G.mp&&G.phase!=='over'){L.gone=true;L.peerSeen=0;}else mpPeerGone('Your opponent left.');}
    else if(m.type==='cmd'&&L.inGame&&G&&G.mp)runCmd(otherSide(G.player),m.c);
    else if(m.type==='chat')mpHeard(m);}
  else if(L.role==='guest'){
    if(m.type==='refuse')return mpJoinFailed(m.why);
    // a host whose page was reloaded has lost the battle (its browser held the only copy), and says so
    if(m.type==='lost'){if(L.inGame&&G&&G.mp&&G.phase!=='over')L.gone=true;return;}
    // rejoining a battle in progress: the host answers the hello with the battle itself
    if(m.type==='start'&&L.joining){const j=L.joining;L.joining=null;L.host=m.from;L.peerSeen=mpNow();j.res();mpBeginGame(m.opts,!!m.time,m.gid,m.resume);return;}
    if(m.type==='lobby'){if(m.guest!==L.cid){if(!L.joining&&!L.inGame&&m.from===L.host)mpHostGone('The host let another player in.');return;}
      L.host=m.from;L.peerSeen=mpNow();if(L.joining){const j=L.joining;L.joining=null;j.res();}
      // (while still looking at the last battle, the guest picks up the host's settings only once back in the lobby)
      L.ready=!!m.ready;L.rtt=m.rtt;L.time=!!m.time;if(m.key!==L.key&&!L.inGame){L.key=m.key;mpApplyOpts(m.opts);}lobbyChanged();return;}
    if(m.from!==L.host)return;L.peerSeen=mpNow();
    if(m.type==='ping')mpSend('pong',{to:m.from,ts:m.ts});
    else if(m.type==='pong')L.rtt=mpNow()-m.ts;
    else if(m.type==='leave'){if(L.inGame&&G&&G.mp&&G.phase!=='over')L.gone=true;else mpHostGone('The host left.');}
    else if(m.type==='start'&&m.gid!==L.gid)mpBeginGame(m.opts,!!m.time,m.gid);
    else if(m.type==='log'&&L.inGame)addLog(m.msg,m.cls);
    else if(m.type==='f'&&L.inGame&&G&&G.mp)mpOnFrame(m.f);
    else if(m.type==='chat')mpHeard(m);}}

// Keep-alive: both sides ping every second and answer the other's pings at once, so a partner whose tab is in the
// background (where the browser slows timers down) still shows it's there by answering. Any message counts as a sign
// of life. In the lobby a partner silent for MP.peerTimeout is gone; in a battle, silence for MP.dropAfter holds the
// battle until they're back (see mpHoldCheck).
function mpTick(){if(!L.t)return;const now=mpNow();
  if(L.role==='host'){if(L.peer)mpSend('ping',{to:L.peer,ts:now});if(!L.inGame&&L.peer)mpLobby();
    if(L.peer&&!L.inGame&&now-L.peerSeen>MP.peerTimeout*1000)mpPeerGone('Lost touch with your opponent.');}
  else if(L.role==='guest'){if(L.joining){if(now>L.joining.until)mpJoinFailed('No game found with that code, or its host isn’t online.');else mpSend('hello',{v:MP.proto});}
    else{mpSend('ping',{to:L.host,ts:now});if(!L.inGame&&now-L.peerSeen>MP.peerTimeout*1000)mpHostGone('Lost touch with the host.');}}
  if(L.inGame){mpHoldCheck();if(L.role==='host')mpBgStep();}}

// the host's lobby state, sent on every change and once a second
function mpLobby(){if(L.role==='host')mpSend('lobby',{guest:L.peer,ready:L.ready,rtt:L.rtt,key:L.key,time:L.time,opts:{...opts}});}
// called by syncCode whenever the New game settings change: the host passes them on, and the guest must Ready again
// (the key is the game code plus the lobby's own settings, so changing any of them un-readies the guest)
const mpKey=()=>encodeGame(opts)+(L.time?'/T':'');
function mpOptsChanged(){if(L.role!=='host'||L.inGame)return;const k=mpKey();if(k===L.key)return;L.key=k;L.ready=false;mpLobby();lobbyChanged();}
// the guest's copy of the host's settings, with the sides swapped; the preview map is only rebuilt if the map changed
function mpApplyOpts(o){const mine={...o,side:otherSide(o.side)},newMap=!M||mine.seed!==opts.seed||mine.mode!==opts.mode||!!mine.gen2!==!!opts.gen2,newLook=mine.climate!==opts.climate;
  Object.assign(opts,mine);syncSegs();renderModes();renderClimates();renderScens();
  if(newMap)preview();else{if(newLook){setClimate(opts.climate);renderTerrain();}$('optSeed').value=opts.seed;syncCode();}}
function mpSetTime(b){if(L.role!=='host'||L.inGame)return;L.time=!!b;mpOptsChanged();lobbyChanged();}
function mpSetReady(b){if(L.role!=='guest'||L.inGame)return;L.ready=!!b;mpSend('ready',{to:L.host,ready:L.ready,key:L.key});lobbyChanged();}

// Chat, in a battle: each message carries its sender's name and goes into both event logs (and so into the replays)
// as "name: text". The name is the one typed in the lobby, or Host / Guest.
const mpName=()=>(L.name||'').trim()||(L.role==='host'?'Host':'Guest');
function mpChat(text){text=String(text).trim().slice(0,160);if(!text||!L.inGame||!G||!G.mp)return;
  mpSend('chat',{to:L.role==='host'?L.peer:L.host,name:mpName(),text});addLog(mpName()+': '+text);}
function mpHeard(m){if(!L.inGame||!G||!G.mp||G.replay)return;addLog(String(m.name||'').slice(0,16)+': '+String(m.text||'').slice(0,160));}
const mpPeerLost=()=>L.gone||!(L.role==='host'?L.peer:L.host)||mpNow()-L.peerSeen>MP.dropAfter*1000;
function mpPeerGone(note){L.peer=null;L.ready=false;L.rtt=null;L.note=note;if(L.inGame){addLog(note,'a');return;}mpLobby();lobbyChanged();}
function mpHostGone(note){const was=L.inGame;mpReset();if(was)addLog(note,'a');else lobbyChanged(note);}
// leave the session (telling the other player), and put the host's difficulty back
function mpLeave(){if(!L.role)return;mpSend('leave',{});mpReset();}
// (the connection closes a moment later, so a last message such as leave still goes out)
function mpReset(){if(L.timer)clearInterval(L.timer);mpStore(null);if(L.t){const t=L.t;t.onMessage=null;setTimeout(()=>{try{t.close();}catch(e){}},400);}
  if(L.role==='host'&&L.diff0){opts.diff=L.diff0;syncSegs();syncCode();}
  Object.assign(L,{role:null,room:null,t:null,peer:null,host:null,ready:false,rtt:null,key:'',inGame:false,timer:null,joining:null,diff0:null,note:'',time:false,gid:'',game:null,gone:false});closeChat();mpHoldUI();lobbyChanged();}

// the host starts once the guest is Ready; both build the same battle, each from its own side
function mpStart(){if(L.role!=='host'||!L.peer||!L.ready)return;const o={...opts},gid=rid(8,MP.codeChars);L.game={opts:o,time:L.time};
  mpSend('start',{to:L.peer,opts:o,time:L.time,gid});mpBeginGame(o,L.time,gid);}
// (resume: a guest rejoining a battle in progress; the host's next frames bring everything else)
function mpBeginGame(o,time,gid,resume){L.inGame=true;L.gid=gid||'';L.gone=false;const side=L.role==='host'?o.side:otherSide(o.side),mp={role:L.role,room:L.room,hostTime:!!time};
  if(L.role==='host')mp.tell=(s,msg,cls)=>mpSend('log',{to:L.peer,msg,cls});else mp.send=c=>mpSend('cmd',{to:L.host,c});
  mpStore({room:L.room,cid:L.cid,role:L.role});
  lobbyChanged();newGame({...o,side,diff:'normal',mp});renderSettings();
  if(resume){if(resume.seen)G.tSeen=new Set(resume.seen);addLog('Back in the battle','d');}}

/* --- the battle: leaving, rejoining, and holding while a player is missing --- */
// The guest's tab remembers which battle it is in (sessionStorage lasts through a reload of that tab), so a reload
// rejoins it as the same player.
function mpStore(v){try{if(v)sessionStorage.setItem('company.mp',JSON.stringify(v));else sessionStorage.removeItem('company.mp');}catch(e){}}
function mpStored(){try{return JSON.parse(sessionStorage.getItem('company.mp')||'null');}catch(e){return null;}}
// the host sends a rejoining guest the battle: its settings, and what the attacker has already seen of the trenches
function mpResume(){if(!L.game||!G||!G.mp)return;const gs=otherSide(G.player);
  mpSend('start',{to:L.peer,opts:L.game.opts,time:L.game.time,gid:L.gid,resume:{seen:gs==='A'&&G.tSeen?[...G.tSeen]:null}});
  if(G.mpS)G.mpS.full=0;G.mpHold=false;tellTo(G.player,'Your opponent is back','d');mpHoldUI();}
// Holding: a battle stops while the other player is missing (silent for MP.dropAfter, or gone), on both screens.
// After MP.claimAfter (at once if the host left, since the battle can't go on without it) the one still here may
// claim the victory.
function mpHoldCheck(){if(!G||!G.mp||G.replay||G.phase==='over'||G.mp.room!==L.room)return mpHoldUI();
  const lost=mpPeerLost();if(lost&&!G.mpHold){G.mpHold=true;G.mpHoldAt=mpNow();}else if(!lost&&G.mpHold){G.mpHold=false;}mpHoldUI();}
const mpClaimIn=()=>L.role==='guest'&&L.gone?0:Math.max(0,MP.claimAfter-(mpNow()-(G.mpHoldAt||0))/1000);
// the one still here wins; on the guest's side the battle ends on its own screen (the host is gone)
function mpClaim(){if(!G||!G.mp||!G.mpHold||mpClaimIn()>0)return;G.mpHold=false;
  if(L.role==='host'){end(G.player,`The ${G.player==='A'?'defender':'attacker'} left the battle.`);}
  else{if(G.rec)recFrame();G.phase='over';G.over={winner:G.player,reason:`The ${G.player==='A'?'defender':'attacker'} left the battle.`};mpReset();showEnd(G.over.winner,G.over.reason);}
  mpHoldUI();}
// back to the lobby after a battle, for a rematch: both keep the session; the host may change the settings, and the
// guest has to press Ready again
function mpToLobby(){if(!L.role||!G||G.phase!=='over')return;L.inGame=false;L.ready=false;L.gid='';
  if(L.role==='guest'){L.key='';mpSend('ready',{to:L.host,ready:false,key:''});}
  if(RP)exitReplay();$('endModal').hidden=true;showStart();if(L.role==='host')mpLobby();lobbyChanged();}
// a page closing tells the other player at once
addEventListener('pagehide',()=>{if(L.role&&L.t)mpSend('leave',{});});
// A host page that is reloaded mid-battle has lost it: it tells the guest, so the guest can claim the win straight away.
function mpAnnounceLost(){const s=mpStored();if(!s||s.role!=='host')return;mpStore(null);
  openTransport(s.room).then(t=>{t.send({type:'lost',from:rid(10,MP.codeChars)});setTimeout(()=>{try{t.close();}catch(e){}},600);}).catch(()=>{});}
