// COMPANY · src/net/transport.js
// The connection between the two players' browsers, behind one small interface so the service can change here alone.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
// openTransport(room) resolves to {kind, send(msg), onMessage, close()}: every message sent reaches the other
// browsers in the same room (not the sender). Messages are plain JSON objects.
function openTransport(room){return mpOnline()?openSupabase(room):openLocal(room);}
// Local mode: a BroadcastChannel reaches other tabs of this browser on the same site. Pages opened from a file
// (file://) can't share one, so there each message is written to localStorage and read from the storage event that
// the other tabs get (a counter makes every write a change, so repeated messages all arrive).
function openLocal(room){const t={kind:'local',onMessage:null};
  if(location.protocol!=='file:'){const bc=new BroadcastChannel('company-'+room);bc.onmessage=e=>{if(t.onMessage)t.onMessage(e.data);};
    t.send=m=>bc.postMessage(m);t.close=()=>bc.close();return Promise.resolve(t);}
  const key='company-mp-'+room;let n=0;
  const on=e=>{if(e.key===key&&e.newValue&&t.onMessage)try{t.onMessage(JSON.parse(e.newValue).m);}catch(err){}};addEventListener('storage',on);
  t.send=m=>{try{localStorage.setItem(key,JSON.stringify({m,n:++n,c:Math.floor(performance.now())}));}catch(e){}};
  t.close=()=>{removeEventListener('storage',on);try{localStorage.removeItem(key);}catch(e){}};return Promise.resolve(t);}
// Supabase Realtime: a broadcast channel per room. The library is only loaded the first time it's needed.
let supaLib=null,supaClient=null;
function loadSupabase(){return supaLib||(supaLib=new Promise((res,rej)=>{const s=document.createElement('script');s.src=MP.supabaseLib;
  s.onload=()=>window.supabase?res(window.supabase):rej(new Error('The multiplayer library didn’t load.'));
  s.onerror=()=>{supaLib=null;rej(new Error('Couldn’t load the multiplayer library. Check your connection.'));};document.head.appendChild(s);}));}
async function openSupabase(room){const lib=await loadSupabase();
  supaClient=supaClient||lib.createClient(MP.supabaseUrl,MP.supabaseKey,{realtime:{params:{eventsPerSecond:40}}});
  const ch=supaClient.channel('company-'+room,{config:{broadcast:{self:false,ack:false}}});
  const t={kind:'supabase',onMessage:null,send:m=>{ch.send({type:'broadcast',event:'m',payload:m});},close:()=>{supaClient.removeChannel(ch);}};
  ch.on('broadcast',{event:'m'},({payload})=>{if(t.onMessage)t.onMessage(payload);});
  await new Promise((res,rej)=>{const to=setTimeout(()=>rej(new Error('Timed out connecting to the multiplayer service.')),10000);
    ch.subscribe(st=>{if(st==='SUBSCRIBED'){clearTimeout(to);res();}else if(st==='CHANNEL_ERROR'||st==='TIMED_OUT'){clearTimeout(to);rej(new Error('Couldn’t connect to the multiplayer service ('+st.toLowerCase().replace('_',' ')+').'));}});});
  return t;}
