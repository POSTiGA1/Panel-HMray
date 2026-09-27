"use client";

import { useState } from "react";
import { Check, Copy, Gift, Lock } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import { useStorefrontLocale } from "@/modules/storefront/locale";

export type DigitalOrderView = {
  delivered: boolean;
  pendingManual: boolean;
  code: string | null;
  codeMasked: string | null;
  message: string | null;
  guide: string | null;
  locked?: boolean;
};

export function DigitalCodeBox({
  view,
  productName,
  compact = false,
  onLockedAction,
  lockedActionLabel,
}: {
  view: DigitalOrderView;
  productName?: string | null;
  compact?: boolean;
  onLockedAction?: () => void;
  lockedActionLabel?: string;
}) {
  const { t } = useStorefrontLocale();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!view.code) return;
    await copyToClipboard(view.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const message = view.message?.trim() || "";
  const showMessage = !!message && !(view.code && message === view.code);

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {!compact ? (
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
            <Gift size={20} />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-emerald-700/80 dark:text-emerald-300/80">
              {t("محصول شما تحویل شد", "Your product is delivered")}
            </div>
            {productName ? (
              <div className="truncate text-lg font-semibold tracking-tight">{productName}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showMessage ? (
        <p className="whitespace-pre-line rounded-2xl bg-zinc-50 px-4 py-3 text-sm leading-relaxed text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
          {message}
        </p>
      ) : null}

      {view.code ? (
        <div className="rounded-2xl border-2 border-dashed border-emerald-500/50 bg-emerald-500/5 p-3 sm:p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
            {t("کد تحویل", "Delivery code")}
          </div>
          <div
            dir="ltr"
            className="select-all break-all rounded-xl bg-white px-4 py-4 text-center font-mono text-xl font-bold tracking-wider text-zinc-950 shadow-inner dark:bg-zinc-950 dark:text-white sm:text-2xl"
          >
            {view.code}
          </div>
          <button
            type="button"
            onClick={copy}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? t("کپی شد", "Copied") : t("کپی کد", "Copy code")}
          </button>
        </div>
      ) : view.delivered ? (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            <Lock size={15} /> {t("کد محافظت شده است", "Code is protected")}
          </div>
          {view.codeMasked ? (
            <div dir="ltr" className="mt-2 font-mono text-base font-semibold tracking-wider text-zinc-500">
              {view.codeMasked}
            </div>
          ) : null}
          <p className="mt-2 text-xs text-zinc-500">
            {t(
              "برای دیدن کد کامل وارد پورتال مشتری شوید.",
              "Log in to the customer portal to see the full code.",
            )}
          </p>
          {onLockedAction ? (
            <button
              type="button"
              onClick={onLockedAction}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900"
            >
              {lockedActionLabel || t("نمایش کد", "Show code")}
            </button>
          ) : null}
        </div>
      ) : null}

      {view.guide?.trim() ? (
        <div className="rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-sm leading-relaxed text-sky-900 dark:text-sky-100">
          <div className="mb-1 text-xs font-semibold">{t("راهنما", "Guide")}</div>
          <p className="whitespace-pre-line">{view.guide.trim()}</p>
        </div>
      ) : null}
    </div>
  );
}
