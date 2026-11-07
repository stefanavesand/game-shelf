// Paged views keep every resource/control reachable without scrolling the page.
export function createTradePages(dialog){
 let page=0,settings=false,frame;
 function fit(){
  cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
   if(!dialog.open||!['composer','live'].includes(dialog.dataset.trade))return;
   const form=dialog.querySelector('.trade-composer-form'),scroll=form?.querySelector('.trade-scroll');if(!scroll)return;
   const rows=[...scroll.querySelectorAll('[data-resource]')],head=scroll.querySelector('.trade-row-head');if(!rows.length)return;
   form.querySelector('.resource-pages')?.remove();form.querySelector('.trade-settings-toggle')?.remove();
   const meta=[...scroll.children].filter(el=>el!==head&&!el.matches('[data-resource]'));
   const short=window.innerHeight<500;
   for(const el of [...meta,head,...rows])el.hidden=false;
   if(short){
    const toggle=document.createElement('button');toggle.type='button';toggle.className='trade-settings-toggle';toggle.textContent=settings?'Back to resources':'Trade settings';toggle.onclick=()=>{settings=!settings;fit();};form.prepend(toggle);
    for(const el of meta)el.hidden=!settings;for(const el of [head,...rows])el.hidden=settings;
    if(settings){scroll.dataset.settings='true';return;}
   }
   delete scroll.dataset.settings;
   const style=getComputedStyle(dialog),heading=dialog.querySelector('.sheet-heading'),footer=form.querySelector('.trade-footer'),toggle=form.querySelector('.trade-settings-toggle');
   const outer=el=>{if(!el||el.hidden)return 0;const s=getComputedStyle(el);return el.getBoundingClientRect().height+parseFloat(s.marginTop||0)+parseFloat(s.marginBottom||0);};
   const columns=innerHeight<500&&innerWidth>=600;
   const available=parseFloat(style.maxHeight)-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)-outer(heading)-(columns?0:outer(footer)+outer(toggle))-8,metaHeight=meta.filter(el=>!el.hidden).reduce((sum,el)=>sum+el.getBoundingClientRect().height+12,0),rowHeight=Math.max(48,rows[0].getBoundingClientRect().height);
   let count=Math.floor((available-metaHeight-(head?.getBoundingClientRect().height||0))/rowHeight);
   if(count>=rows.length){page=0;return;}
   count=Math.max(1,Math.floor((available-metaHeight-(head?.getBoundingClientRect().height||0)-44)/rowHeight));
   const total=Math.ceil(rows.length/count);page=Math.min(page,total-1);
   rows.forEach((row,i)=>{row.hidden=Math.floor(i/count)!==page;});
   const pager=document.createElement('div');pager.className='resource-pages';pager.setAttribute('aria-label','Resource pages');
   const back=document.createElement('button'),next=document.createElement('button'),label=document.createElement('span');back.type=next.type='button';back.textContent='←';next.textContent='→';back.setAttribute('aria-label','Previous resources');next.setAttribute('aria-label','Next resources');back.disabled=page===0;next.disabled=page===total-1;label.textContent=`${page+1} / ${total}`;
   back.onclick=()=>{page--;fit();};next.onclick=()=>{page++;fit();};pager.append(back,label,next);scroll.append(pager);
  });
 }
 new MutationObserver(fit).observe(dialog.querySelector('#sheet-body'),{childList:true});
 const resize=()=>fit();window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);
 return {fit,reset(){page=0;settings=false;}};
}
export function itemPages(container,selector,{label='Page',labels,perPage=1}={}){
 const items=[...container.querySelectorAll(selector)];if(items.length<2)return;
 const field=document.createElement('label'),select=document.createElement('select');field.textContent=label+' ';select.setAttribute('aria-label',label);field.append(select);container.prepend(field);
 const controller=new AbortController();let count=1;
 const show=()=>items.forEach((item,i)=>{item.hidden=Math.floor(i/count)!==Number(select.value);});
 const fit=()=>{if(!items[0].isConnected){controller.abort();return;}count=typeof perPage==='function'?perPage():perPage;const pages=Math.ceil(items.length/count),page=Math.min(Number(select.value)||0,pages-1);select.replaceChildren();for(let i=0;i<pages;i++){const option=document.createElement('option');option.value=i;option.textContent=labels?.[i]||`${i+1} / ${pages}`;select.append(option);}select.value=page;field.hidden=pages===1;show();};
 select.onchange=show;window.addEventListener('resize',fit,{signal:controller.signal});window.visualViewport?.addEventListener('resize',fit,{signal:controller.signal});container.closest('dialog')?.addEventListener('close',()=>controller.abort(),{once:true});fit();
}
