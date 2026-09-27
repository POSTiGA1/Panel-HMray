"use client";

import { useSyncExternalStore } from "react";
import { isStandalone } from "@/lib/app-brand";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia?.("(display-mode: standalone)");
  mq?.addEventListener?.("change", onChange);
  return () => mq?.removeEventListener?.("change", onChange);
}

/** True when the panel runs as an installed app (home-screen icon), not in a browser tab. */
export function useIsStandalone(): boolean {
  return useSyncExternalStore(subscribe, isStandalone, () => false);
}
