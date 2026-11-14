export function recentGames(games,currentRoom){
 return games.map((game,index)=>({game,index})).sort((a,b)=>(Number(b.game.lastPlayedAt)||0)-(Number(a.game.lastPlayedAt)||0)||Number(b.game.roomId===currentRoom)-Number(a.game.roomId===currentRoom)||b.index-a.index).map(x=>x.game);
}
