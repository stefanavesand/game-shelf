// A sole mandatory victim is not a player decision. Preserve reducer/revision checks.
export function automaticSteal(view){
 if(view?.state.game.phase!=='robber-steal')return null;
 const choices=view.choices.filter(c=>c.type==='STEAL_RESOURCE');
 return choices.length===1?choices[0]:null;
}
