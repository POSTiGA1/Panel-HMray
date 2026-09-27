import { PwaManager } from "./PwaManager";
import { AppBrandSync } from "./AppBrandSync";
import { APP_BRAND_STORAGE_KEY } from "@/lib/app-brand";

/**
 * Applies the cached agency brand (apple-touch-icon, theme-color, standalone flag) before
 * React hydrates, so iOS "Add to Home Screen" picks the right icon on the first paint.
 */
const bootScript = `(function(){try{
var d=document,h=d.documentElement;
var sa=window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
if(sa)h.setAttribute('data-standalone','');
var b=JSON.parse(localStorage.getItem('${APP_BRAND_STORAGE_KEY}')||'null');
if(!b||!b.custom)return;
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
      <PwaManager />
      <AppBrandSync />
    </>
  );
}
