// Preserve a reader's entry/offset through renders; follow only from the bottom.
export function createActivityScroll(){
 let remembered=null,observed=null,observer=null;
 const feed=()=>document.getElementById('activity-feed');
 function capture(){const el=feed();if(!el)return remembered;const bounds=el.getBoundingClientRect(),anchor=[...el.querySelectorAll('[data-entry]')].find(e=>e.getBoundingClientRect().bottom>bounds.top);remembered={key:el.dataset.scope,bottom:el.scrollHeight-el.clientHeight-el.scrollTop<24,top:el.scrollTop,anchor:anchor?.dataset.entry,offset:anchor?anchor.getBoundingClientRect().top-bounds.top:0};return remembered;}
 function jump(){const el=feed();if(!el)return;el.scrollTop=el.scrollHeight;update();}
 function update(){const el=feed(),button=document.getElementById('activity-jump');if(!el||!button)return;const hidden=el.scrollHeight-el.clientHeight-el.scrollTop<24,text=el.querySelector('.flow-controls button:not(:disabled)')?'Your action ↓':'New events ↓';if(button.hidden!==hidden)button.hidden=hidden;if(button.textContent!==text)button.textContent=text;}
 function restore(state){const el=feed();if(!el)return;const snapshot=state||remembered;if(!snapshot||snapshot.key!==el.dataset.scope||snapshot.bottom)el.scrollTop=el.scrollHeight;else{const anchor=[...el.querySelectorAll('[data-entry]')].find(e=>e.dataset.entry===snapshot.anchor);el.scrollTop=snapshot.top;if(anchor)el.scrollTop+=anchor.getBoundingClientRect().top-el.getBoundingClientRect().top-snapshot.offset;}
  el.onscroll=()=>{capture();update();};
  if(observed!==el){observer?.disconnect();observed=el;observer=new ResizeObserver(()=>{if(remembered?.key===el.dataset.scope&&remembered.bottom)el.scrollTop=el.scrollHeight;update();});observer.observe(el);}
  update();capture();
 }
 return {capture,restore,jump};
}
