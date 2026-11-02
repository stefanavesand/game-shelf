// Original Game Shelf vector artwork. No external assets or upstream code.
export function symbol(resource){
  const art={
    brick:'<path d="M5 14 19 7l13 7-14 8zM5 14v11l13 8V22m0 11 14-8V14M12 11l13 7M12 18v11"/>',
    wood:'<path d="m8 22 15-12a6 6 0 0 1 8 8L15 30a6 6 0 0 1-7-8Z"/><ellipse cx="11" cy="26" rx="5" ry="6"/><path d="m17 18 11-8M20 22l12-10"/>',
    grain:'<path d="M19 34V8m0 9C8 17 8 9 8 9c10 0 11 8 11 8Zm0 8C8 25 8 17 8 17c10 0 11 8 11 8Zm0-8c11 0 11-8 11-8-10 0-11 8-11 8Zm0 8c11 0 11-8 11-8-10 0-11 8-11 8Z"/>',
    wool:'<path d="M9 27v6m16-6v6"/><path d="M9 25a6 6 0 0 1-3-10 6 6 0 0 1 8-7 7 7 0 0 1 12 3 6 6 0 0 1 3 12c-1 6-15 7-20 2Z"/><path d="M28 13h5v10h-7"/>',
    ore:'<path d="m4 29 7-17 11-6 12 24-16 4zM11 12l7 22 4-28m0 0 4 22-8 6"/>',
  };
  return `<svg viewBox="0 0 38 40" aria-hidden="true" class="resource-icon ${resource}">${art[resource]||''}</svg>`;
}
export function tileArt(type){
  if(type==='wood')return '<path d="m-23 7 8-22 8 22zm22-4 8-23 8 23zm21 10 7-20 8 20z" fill="#376d4e"/><path d="M-15 7v8M7 3v9M27 13v5" stroke="#4b5941" stroke-width="3"/>';
  if(type==='ore')return '<path d="m-31 17 17-34L1 17zm18 0 20-40 24 40z" fill="#717d7d"/><path d="m-19-8 5-9 5 9M1-10l6-13 8 13" stroke="#d4d7d0" stroke-width="2" fill="#d4d7d0"/>';
  if(type==='grain')return '<g stroke="#ac883b" stroke-width="2" fill="none"><path d="M-20 15V-12M-20 0l-7-8m7 16-7-8m7-2 7-8m-7 16 7-8M7 15v-34M7-7l-7-8m7 16L0-7m7 0 7-8M7 1l7-8M28 13v-19"/></g>';
  if(type==='brick')return '<g fill="#a96347" stroke="#cb8661" stroke-width="2"><path d="M-30-10h18V0h-18zM-12-10H6V0h-18zM6-10h18V0H6zM-21 0h18v10h-18zM-3 0h18v10H-3zM-24 10h18v10h-18zM-6 10h18v10H-6z"/></g>';
  if(type==='wool')return '<g fill="#f7f5e6" stroke="#87996d" stroke-width="1.5"><ellipse cx="-19" cy="0" rx="9" ry="6"/><ellipse cx="13" cy="11" rx="9" ry="6"/></g><g fill="#5f6e52"><circle cx="-10" cy="0" r="3"/><circle cx="22" cy="11" r="3"/></g><path d="M-24 4v4m7-4v4M8 15v4m7-4v4" stroke="#5f6e52" stroke-width="2"/>';
  return '<path d="M-10 14 0-15l10 29z" fill="#8d8b72"/><path d="M0-15v29" stroke="#b0a98a" stroke-width="2"/>';
}
