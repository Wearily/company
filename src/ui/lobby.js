// COMPANY · src/ui/lobby.js
// The multiplayer screens: the Multiplayer window (host or join) and the New game sheet in lobby mode.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
const sideNm=s=>s==='A'?'Attacker':'Defender';
const fmtRoom=c=>c?c.slice(0,3)+'·'+c.slice(3):'';
// the Multiplayer window: Create Game, or join with a code
function openMp(msg,code){$('mpModal').hidden=false;$('mpMsg').textContent=msg||'';$('mpLocal').hidden=mpOnline();if(code)$('mpCode').value=code;
  setTimeout(()=>$('mpCode').focus(),0);}
const closeMp=()=>{$('mpModal').hidden=true;};
function mpBusy(b){for(const id of ['mpCreate','mpJoin'])$(id).disabled=b;}
$('optMulti').onclick=()=>openMp();
$('mpCancel').onclick=closeMp;
$('mpCreate').onclick=async()=>{mpBusy(true);$('mpMsg').textContent='';try{await mpCreate();closeMp();}catch(e){$('mpMsg').textContent=e.message;}mpBusy(false);};
$('mpJoin').onclick=async()=>{mpBusy(true);$('mpMsg').textContent='Joining…';try{await mpJoin($('mpCode').value);closeMp();}catch(e){$('mpMsg').textContent=e.message;}mpBusy(false);};
$('mpCode').onkeydown=e=>{if(e.key==='Enter')$('mpJoin').onclick();};
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('mpModal').hidden){e.stopImmediatePropagation();closeMp();}},true);
// lobby mode of the New game sheet
$('mpLeave').onclick=()=>mpLeave();
$('mpReady').onclick=()=>mpSetReady(!L.ready);
$('mpStart').onclick=()=>mpStart();
$('mpTime').onclick=()=>mpSetTime(!L.time);
$('lbName').value=L.name;$('lbName').oninput=()=>{L.name=$('lbName').value.slice(0,16);try{localStorage.setItem('company.name',L.name);}catch(e){}};
// chat: T opens a message box at the foot of the event log; Enter sends, Esc closes
function openChat(){if(!(G&&G.mp&&L.inGame)||G.replay)return false;const c=$('chatIn'),cs=getComputedStyle($('log'));
  c.style.left=cs.left;c.style.bottom=cs.bottom;c.hidden=false;document.body.classList.add('chatting');c.focus();return true;}
function closeChat(){const c=$('chatIn');c.value='';c.hidden=true;document.body.classList.remove('chatting');c.blur();}
$('chatIn').addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){mpChat($('chatIn').value);closeChat();}else if(e.key==='Escape')closeChat();});
$('chatIn').addEventListener('blur',()=>{if(!$('chatIn').value.trim())closeChat();});
$('lbCopy').onclick=()=>copyText(mpInviteURL(),ok=>{$('lbNote').textContent=ok?'Invite link copied. Anyone who opens it joins this lobby.':'Copy the code to share it.';});
const codeMsg0=$('codeMsg').textContent;
// redraws everything the session shows; note: a message to show (on leaving, in the Multiplayer window)
function lobbyChanged(note){const on=!!L.role&&!L.inGame,b=document.body;
  b.classList.toggle('mp-lobby',on);b.classList.toggle('mp-host',on&&L.role==='host');b.classList.toggle('mp-guest',on&&L.role==='guest');
  $('lobbyBar').hidden=!on;document.querySelector('#startModal h1').textContent=on?'Multiplayer Lobby':'New Game';
  if(L.role!=='guest'&&$('codeMsg').textContent==='Only the host can change the settings.')$('codeMsg').textContent=codeMsg0;
  if(!on){if(note&&!$('startModal').hidden)openMp(note);return;}
  if(L.role==='guest')$('codeMsg').textContent='Only the host can change the settings.';
  $('lbRoom').textContent=fmtRoom(L.room);$('lbName').placeholder=L.role==='host'?'Host':'Guest';$('mpTime').classList.toggle('on',L.time);$('mpTime').setAttribute('aria-checked',L.time);
  const me=opts.side,them=otherSide(me),ms=L.rtt!=null?` · ${Math.round(L.rtt)} ms`:'';
  const other=L.role==='host'?(L.peer?`<b>Opponent</b><span class="s2">${sideNm(them)}${ms}</span><span class="lbSt${L.ready?' ok':''}">${L.ready?'Ready':'Not ready'}</span>`
      :`<b>Opponent</b><span class="s2">Waiting for someone to join…</span>`)
    :`<b>Host</b><span class="s2">${sideNm(them)}${ms}</span>`;
  $('lbPlayers').innerHTML=`<div class="lbP"><b>You</b><span class="s2">${L.role==='host'?'Host':'Guest'} · ${sideNm(me)}</span>${L.role==='guest'?`<span class="lbSt${L.ready?' ok':''}">${L.ready?'Ready':'Not ready'}</span>`:''}</div><div class="lbP">${other}</div>`;
  $('mpStart').disabled=!(L.peer&&L.ready);$('mpStart').dataset.tip=L.peer?(L.ready?'Start the battle for both players':'Waiting for your opponent to press Ready'):'Waiting for an opponent to join';
  $('mpReady').textContent=L.ready?'Ready ✓':'Ready';$('mpReady').classList.toggle('on',L.ready);$('mpReady').dataset.tip=L.ready?'Click to cancel':'Tell the host you’re ready to start';
  $('lbNote').textContent=L.note||(mpOnline()?'':'Local test mode: only other tabs in this browser can join.');}
// an invite link (…#room=CODE) opens the Multiplayer window and joins that room; a guest whose tab was reloaded
// mid-battle rejoins its battle the same way (and a host's reloaded tab tells its guest the battle is lost)
function mpCheckLink(){const m=location.hash.match(/room=([A-Za-z0-9]+)/),s=mpStored();if(L.role)return;
  if(s&&s.role==='host'){mpAnnounceLost();if(!m)return;}
  const code=m?m[1].toUpperCase():s&&s.role==='guest'?s.room:null;if(!code)return;
  if($('startModal').hidden)showStart();openMp(m?'':'Rejoining your battle…',code);$('mpJoin').onclick();}
addEventListener('hashchange',mpCheckLink);
// a battle held while a player is missing: who's missing, and Claim Victory once it's allowed
function mpHoldUI(){const on=!!(G&&G.mp&&G.mpHold&&L.inGame&&G.phase!=='over'&&!G.replay);$('mpHold').hidden=!on;if(!on)return;
  const host=L.role==='host',left=L.gone,c=Math.ceil(mpClaimIn());
  $('holdTitle').textContent=host?'Waiting for your opponent':'Waiting for the host';
  $('holdText').textContent=host?(left?'Your opponent left the battle. It’s paused, and they can come back with the invite link.':'Your opponent lost connection. The battle is paused until they’re back.')
    :(left?'The host left, so the battle can’t go on.':'Lost touch with the host. The battle is paused until they’re back.');
  const b=$('holdClaim');b.disabled=c>0;b.textContent=c>0?`Claim Victory in ${fmt(c)}`:'Claim Victory';}
$('holdClaim').onclick=()=>mpClaim();
// leaving a battle: the New game button (and More → New game) asks first, and leaving means surrendering
function openQuit(){closePops();$('mpQuit').hidden=false;}
const closeQuit=()=>{$('mpQuit').hidden=true;};
$('quitX').onclick=$('quitStay').onclick=closeQuit;
$('quitGo').onclick=()=>{closeQuit();act({k:'surrender'});};
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('mpQuit').hidden){e.stopImmediatePropagation();closeQuit();}},true);
