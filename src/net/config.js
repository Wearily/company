// COMPANY · src/net/config.js
// Multiplayer settings, all in one place.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
// supabaseUrl / supabaseKey: the Supabase project's URL and public (anon) key, from the dashboard's Project Settings →
// API. With both set, players connect over the internet through Supabase Realtime (no tables or server code needed).
// Left empty, multiplayer runs in local mode: only other tabs in the same browser can join (for trying it out and tests).
const MP={
  supabaseUrl:'https://qkbjyfcjcjstnsvbjkuc.supabase.co',
  supabaseKey:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrYmp5ZmNqY2pzdG5zdmJqa3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NzE1MDYsImV4cCI6MjEwODQ0NzUwNn0.5Ok-wwNDDKK3P3OHlAZpkMyKbyXpPqf2TU9vDKNmD1M',
  supabaseLib:'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js',
  proto:7,                                   // bumped when the messages change; players on different versions can't join
  codeLen:6,codeChars:'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',   // room codes: no 0/O or 1/I to mix up
  tick:1,                                    // seconds between keep-alive pings
  peerTimeout:15,                            // seconds without a word before the other player counts as gone
  joinTimeout:6,                             // seconds a join waits for the host to answer
  snapHz:10,                                 // battle frames the host sends each second
  fullEvery:3,                               // seconds between full refreshes (routes, trenches, road damage, supply)
  deployTime:180,                            // seconds the defender has to deploy before the battle begins by itself
  dropAfter:5,                               // seconds of silence in a battle before it's held for the missing player
  claimAfter:90,                             // seconds the one still there waits before they can claim the victory
};
const mpOnline=()=>!!(MP.supabaseUrl&&MP.supabaseKey);
