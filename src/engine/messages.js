// COMPANY · src/engine/messages.js
// Event-log messages worded for whoever reads them.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
// tell(f): f(reader) returns [text, cls] for that side's reader ('A' or 'D'), or nothing if that side isn't told.
// cls 'd' reads as good news (blue), 'a' as bad news (orange), '' as neutral. The local player's wording goes to the
// event log (addLog); in a multiplayer game the host also hands the opponent's wording to G.mp.tell to send on.
function tell(f){if(!G)return;const m=f(G.player);if(m)addLog(m[0],m[1]);
  if(G.mp&&G.mp.tell){const o=G.player==='A'?'D':'A',n=f(o);if(n)G.mp.tell(o,n[0],n[1]);}}
// a message for one side only (feedback on that side's own orders, for instance)
const tellTo=(side,text,cls)=>tell(r=>r===side?[text,cls]:null);
