"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, PlusSquare, Share, X } from "lucide-react";
import { useT } from "@/i18n";
import { useAppBrand } from "@/hooks/useAppBrand";
import { useIsStandalone } from "@/hooks/useIsStandalone";

const DISMISS_KEY = "hm-install-dismissed-at";
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 4000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function recentlyDismissed() {
  const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return at > 0 && Date.now() - at < DISMISS_FOR_MS;
}

export function InstallPrompt() {
  const t = useT();
  const standalone = useIsStandalone();
  const { brand, displayName } = useAppBrand();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [visible, setVisible] = useState(false);
  const [iosSheet, setIosSheet] = useState(false);

  useEffect(() => {
    if (standalone || !window.isSecureContext || recentlyDismissed()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    setIos(isIos());
    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, [standalone]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
    setIosSheet(false);
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice.catch(() => null);
      setDeferred(null);
      if (choice?.outcome === "accepted") setVisible(false);
      else dismiss();
      return;
    }
    if (ios) setIosSheet(true);
  };

  if (standalone || !visible || (!deferred && !ios)) return null;

  const iconSrc = `${brand.icons.icon192}?v=${encodeURIComponent(brand.rev)}`;

  return (
    <>
      <div
        role="dialog"
        aria-labelledby="pwa-install-title"
        className="pwa-install-card fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md animate-[pwa-rise_.35s_ease-out] rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 shadow-2xl backdrop-blur-xl motion-reduce:animate-none dark:border-white/10 dark:bg-zinc-900/95"
      >
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconSrc} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-[14px] shadow-md" />
          <div className="min-w-0 flex-1">
            <h2 id="pwa-install-title" className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-50">
              {t("pwa.installTitle", { name: brand.shortName || displayName })}
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">{t("pwa.installBody")}</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("pwa.close")}
            className="-m-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="min-h-11 flex-1 cursor-pointer rounded-xl text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {t("pwa.installLater")}
          </button>
          <button
            type="button"
            onClick={install}
            className="min-h-11 flex-[1.4] cursor-pointer rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
          >
            {t("pwa.installAction")}
          </button>
        </div>
      </div>

      {iosSheet ? (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/50 backdrop-blur-sm" onClick={() => setIosSheet(false)}>
          <div
            role="dialog"
            aria-labelledby="pwa-ios-title"
            onClick={(e) => e.stopPropagation()}
            className="pwa-safe-bottom w-full animate-[pwa-rise_.3s_ease-out] rounded-t-3xl bg-white px-5 pt-3 shadow-2xl motion-reduce:animate-none dark:bg-zinc-900"
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200 dark:bg-zinc-700" aria-hidden />
            <div className="mb-5 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={iconSrc} alt="" width={44} height={44} className="h-11 w-11 rounded-xl shadow" />
              <h2 id="pwa-ios-title" className="text-base font-semibold text-slate-900 dark:text-zinc-50">
                {t("pwa.iosTitle")}
              </h2>
            </div>
            <ol className="space-y-3">
              {[
                { icon: Share, text: t("pwa.iosStep1") },
                { icon: PlusSquare, text: t("pwa.iosStep2") },
                { icon: CheckCircle2, text: t("pwa.iosStep3") },
              ].map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3.5 py-3 dark:bg-zinc-800/60">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm dark:bg-zinc-900 dark:text-blue-300">
                    <Icon size={18} aria-hidden />
                  </span>
                  <span className="text-sm text-slate-700 dark:text-zinc-200">{text}</span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={dismiss}
              className="mb-4 mt-5 min-h-12 w-full cursor-pointer rounded-2xl bg-slate-900 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {t("pwa.iosGotIt")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
