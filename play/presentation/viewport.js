// Safari browser chrome and the keyboard change the usable game viewport.
export function trackViewport(){
 let frame;
 function measure(){
  const root=document.documentElement;
  root.style.setProperty('--viewport-height',`${Math.min(innerHeight,window.visualViewport?.height||innerHeight)}px`);
  const app=document.getElementById('app');if(!app)return;
  const style=getComputedStyle(app);
  const width=app.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
  const height=app.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
  const landscape=innerWidth>=600&&innerWidth>=innerHeight;
  // Reserve the fixed controls specified in game-layout.css, then fit a square.
  const size=landscape?Math.min(height,width-(innerHeight<=500?280:324)-16):Math.min(width,height-44-248-16);
  root.style.setProperty('--board-size',`${Math.max(120,Math.floor(size))}px`);
 }
 function update(){cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);}
 new ResizeObserver(update).observe(document.getElementById('app'));
 window.addEventListener('resize',update);window.visualViewport?.addEventListener('resize',update);window.addEventListener('pageshow',update);update();
}
