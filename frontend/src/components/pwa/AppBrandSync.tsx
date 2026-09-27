"use client";

import { useEffect } from "react";
import { useAppBrand } from "@/hooks/useAppBrand";
import { PANEL_BRAND } from "@/lib/panel-brand";

const DEFAULT_TITLES = [PANEL_BRAND.title, PANEL_BRAND.titleFa, PANEL_BRAND.name, PANEL_BRAND.nameFa];

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  if (el.getAttribute("href") !== href) el.setAttribute("href", href);
}

function upsertMeta(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.name = name;
    document.head.appendChild(el);
  }
  if (el.content !== content) el.content = content;
}

/** Rewrites the tab title and iOS home-screen metadata to the agency brand. */
export function AppBrandSync() {
  const { brand, displayName } = useAppBrand();

  useEffect(() => {
    if (!brand.custom) return;
    upsertLink("apple-touch-icon", `${brand.icons.apple180}?v=${encodeURIComponent(brand.rev)}`);
    upsertMeta("apple-mobile-web-app-title", brand.shortName || displayName);
    upsertMeta("application-name", brand.shortName || displayName);

    const apply = () => {
      let title = document.title;
      for (const d of DEFAULT_TITLES) {
        if (title.includes(d)) title = title.split(d).join(displayName);
      }
      if (title !== document.title) document.title = title;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [brand, displayName]);

  return null;
}
