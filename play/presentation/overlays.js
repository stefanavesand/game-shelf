// Native dialogs provide focus trapping/inert backgrounds. Layout never owns game state.
export function createOverlays({sheet,reply,drawer,closeSheet}){
 const openers=new WeakMap();
 function closeDrawer(){if(drawer.open)drawer.close();}
 function show(dialog,{stack=false}={}){closeDrawer();if(!stack&&dialog!==sheet&&sheet.open)closeSheet();if(!dialog.open){openers.set(dialog,document.activeElement);dialog.showModal();}}
 for(const dialog of [sheet,reply,drawer]){
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom)return;if(dialog===sheet)closeSheet();else dialog.close();});
  dialog.addEventListener('cancel',event=>{if(dialog===sheet){event.preventDefault();closeSheet();}});
  dialog.addEventListener('close',()=>{const el=openers.get(dialog);if(el?.isConnected&&!document.querySelector('dialog[open]'))el.focus({preventScroll:true});});
 }
 return {show,closeDrawer,showDrawer(){if(sheet.open||reply.open)return;show(drawer);}};
}
