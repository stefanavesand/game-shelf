// Original deterministic nicknames; names travel in the initial seat configuration.
const NAMES=['Captain Turnip','Baron Brick','Woolly Bandit','Granny Grain','Sir Sheepish','Lady Lumber','Ore Goblin','Duke of Dice'];
export function botName(seed,index,used=[]){
 const occupied=new Set(used.map(s=>s.toLowerCase()));
 for(let i=0;i<NAMES.length;i++){const name=NAMES[(seed+index+i)%NAMES.length];if(!occupied.has(name.toLowerCase()))return name;}
 return `Dice Pal ${index+1}`;
}
