import { PwaManager } from "./PwaManager";
import { AppBrandSync } from "./AppBrandSync";
import { BootSplash } from "./BootSplash";
import { APP_BRAND_STORAGE_KEY, BOOT_SPLASH_SESSION_KEY } from "@/lib/app-brand";

/**
 * Applies the cached agency brand (apple-touch-icon, splash colors, standalone flag) before
 * React hydrates, so iOS "Add to Home Screen" picks the right icon on the first paint.
 */
const bootScript = `(function(){try{
var d=document,h=d.documentElement;
var sa=window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
if(sa)h.setAttribute('data-standalone','');
try{if(sessionStorage.getItem('${BOOT_SPLASH_SESSION_KEY}'))h.setAttribute('data-boot-seen','');}catch(e){}
var b=JSON.parse(localStorage.getItem('${APP_BRAND_STORAGE_KEY}')||'null');
if(!b||!b.custom)return;
var bg=b.backgroundColor;
if(/^#[0-9a-f]{6}$/i.test(bg||'')){
var n=parseInt(bg.slice(1),16),l=(0.2126*(n>>16&255)+0.7152*(n>>8&255)+0.0722*(n&255))/255;
h.style.setProperty('--brand-bg',bg);h.style.setProperty('--brand-fg',l>0.6?'#1e293b':'#f1f5f9');
}
var q=function(s){return d.head.querySelector(s)};
var a=q('link[rel="apple-touch-icon"]');
if(!a){a=d.createElement('link');a.rel='apple-touch-icon';d.head.appendChild(a);}
if(b.icons&&b.icons.apple180)a.href=b.icons.apple180+'?v='+encodeURIComponent(b.rev||'');
var t=q('meta[name="apple-mobile-web-app-title"]');if(t&&b.shortName)t.content=b.shortName;
}catch(e){}})();`;

export function PwaHead() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      <BootSplash />
      <PwaManager />
      <AppBrandSync />
    </>
  );
}
