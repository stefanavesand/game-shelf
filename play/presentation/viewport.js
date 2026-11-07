// Safari browser chrome and the software keyboard change the visible viewport.
export function trackViewport(){
 let frame;
 const update=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>document.documentElement.style.setProperty('--viewport-height',`${Math.min(innerHeight,window.visualViewport?.height||innerHeight)}px`));};
 window.addEventListener('resize',update);window.visualViewport?.addEventListener('resize',update);window.addEventListener('pageshow',update);update();
}
