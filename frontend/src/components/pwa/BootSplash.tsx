"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { PanelLogo } from "@/components/PanelLogo";
import { useAppBrand } from "@/hooks/useAppBrand";
import { BOOT_SPLASH_SESSION_KEY } from "@/lib/app-brand";

/** Measured from navigation start, so the app underneath gets the whole window to load. */
const SPLASH_MS = 3000;
const REDUCED_SPLASH_MS = 900;
const LEAVE_MS = 450;

type Phase = "show" | "leave" | "gone";

/**
 * Launch splash, played once per app session over the login page / dashboard while they
 * hydrate and fetch underneath. Server-rendered so it covers the very first paint; the
 * PwaHead boot script hides it (data-boot-seen) on later full reloads in the same session.
 */
export function BootSplash() {
  const { ready, displayName } = useAppBrand();
  const [phase, setPhase] = useState<Phase>("show");

  useEffect(() => {
    if (document.documentElement.hasAttribute("data-boot-seen")) {
      setPhase("gone");
      return;
    }
    try {
      sessionStorage.setItem(BOOT_SPLASH_SESSION_KEY, "1");
    } catch {
      /* private mode */
    }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const total = reduced ? REDUCED_SPLASH_MS : SPLASH_MS;
    const remaining = Math.max(0, total - performance.now());
    const leave = window.setTimeout(() => setPhase("leave"), remaining);
    const gone = window.setTimeout(() => {
      setPhase("gone");
      document.documentElement.setAttribute("data-boot-seen", "");
    }, remaining + LEAVE_MS);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(gone);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={phase === "show"}
      data-phase={phase}
      className="hm-boot-splash hm-brand-surface fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7"
    >
      <div className="hm-boot-mark relative flex h-32 w-32 items-center justify-center">
        <span className="hm-boot-track absolute inset-0 rounded-full" aria-hidden />
        <span className="hm-boot-ring absolute inset-0 rounded-full" aria-hidden />
        <span className="hm-boot-logo flex items-center justify-center">
          <PanelLogo size={68} priority />
        </span>
      </div>
      <p
        className={clsx(
          "hm-boot-name text-base font-semibold tracking-tight",
          !ready && "invisible",
        )}
      >
        {displayName}
      </p>
    </div>
  );
}
