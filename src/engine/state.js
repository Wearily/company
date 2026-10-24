// COMPANY · src/engine/state.js
// The shared state every other file reads: G (the battle in progress), M (the generated map) and the game settings.
// Loaded as a classic script in the order index.html lists: the files share one scope.
'use strict';
// G is replaced by newGame (and swapped for a view object while a replay plays); M by makeMap, the preview and replays.
let M=null,G=null;
// game settings (Settings popover): order arrows, fog of war (it changes what each side can see), map view, line of control
const settings={arrows:true,fog:true,style:'satellite',front:false,frontStyle:'two'};
