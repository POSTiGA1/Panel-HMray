"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, LoaderCircle, X } from "lucide-react";
import { useStorefrontLocale } from "./locale";

/** Shared chrome for portal sheets (PAYG, VPN/digital checkout, cancel/refund). */

export const sheetFocusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--store-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900";

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  onBack,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { isFa } = useStorefrontLocale();
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const BackIcon = isFa ? ChevronRight : ChevronLeft;
  if (typeof document === "undefined") return null;
  const host = (document.querySelector(".store-shell") as HTMLElement | null) || document.body;
  const iconBtn = `flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-zinc-500 transition-colors duration-200 hover:bg-black/[0.05] hover:text-zinc-900 dark:hover:bg-white/[0.08] dark:hover:text-zinc-100 ${sheetFocusRing}`;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" dir={isFa ? "rtl" : "ltr"}>
          <motion.button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            className="absolute inset-0 cursor-default bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduce ? { opacity: 0 } : { y: 40, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 40, opacity: 0 }}
            transition={reduce ? { duration: 0.15 } : { type: "spring", damping: 30, stiffness: 320 }}
            className="store-card relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border shadow-2xl outline-none sm:max-w-lg sm:rounded-[1.75rem]"
          >
            <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700 sm:hidden" />
            <div className="flex shrink-0 items-center gap-2 border-b border-black/[0.05] px-4 py-3 dark:border-white/[0.06] sm:px-5">
              {onBack ? (
                <button type="button" onClick={onBack} aria-label="Back" className={iconBtn}>
                  <BackIcon size={20} />
                </button>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold text-zinc-900 dark:text-zinc-50">{title}</div>
                {subtitle ? <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</div> : null}
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className={iconBtn}>
                <X size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>
            {footer ? (
              <div className="shrink-0 border-t border-black/[0.05] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-white/[0.06] sm:px-5">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    host,
  );
}

const stepVariants = {
  enter: (dx: number) => ({ opacity: 0, x: dx }),
  center: { opacity: 1, x: 0 },
  exit: (dx: number) => ({ opacity: 0, x: -dx }),
};

/** Cross-fades + slides step bodies; direction follows reading order (RTL aware). */
export function SheetStep({
  stepKey,
  direction,
  children,
}: {
  stepKey: string;
  direction: 1 | -1;
  children: React.ReactNode;
}) {
  const { isFa } = useStorefrontLocale();
  const reduce = useReducedMotion();
  const dx = reduce ? 0 : 24 * direction * (isFa ? -1 : 1);
  return (
    <AnimatePresence mode="wait" initial={false} custom={dx}>
      <motion.div
        key={stepKey}
        custom={dx}
        variants={stepVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: reduce ? 0.12 : 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function PickRow({
  title,
  hint,
  meta,
  icon,
  badge,
  selected,
  onClick,
}: {
  title: string;
  hint?: string | null;
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  selected?: boolean;
  onClick: () => void;
}) {
  const { isFa } = useStorefrontLocale();
  const Chevron = isFa ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`store-card group flex min-h-[60px] w-full cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-3 text-start transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px motion-reduce:hover:translate-y-0 ${sheetFocusRing} ${
        selected ? "shadow-[0_8px_24px_-16px_var(--store-primary)]" : ""
      }`}
    >
      {icon ? (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--store-primary)]/10 text-[color:var(--store-primary)]">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">{title}</span>
          {badge}
        </span>
        {hint ? <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-500 dark:text-zinc-400">{hint}</span> : null}
      </span>
      {meta ? <span className="shrink-0 text-end text-xs font-semibold text-zinc-700 dark:text-zinc-200">{meta}</span> : null}
      {selected ? (
        <Check size={18} className="shrink-0 text-[color:var(--store-primary)]" />
      ) : (
        <Chevron
          size={18}
          className="shrink-0 text-zinc-300 transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 dark:text-zinc-600"
        />
      )}
    </button>
  );
}

export function SheetStepper({ step, labels }: { step: number; labels: string[] }) {
  return (
    <ol className="mb-4 flex items-center gap-1.5" aria-label="Progress">
      {labels.map((label, i) => (
        <li key={`${label}-${i}`} className="flex min-w-0 flex-1 flex-col gap-1" aria-current={i === step ? "step" : undefined}>
          <span
            className={`h-1 rounded-full transition-colors duration-300 ${
              i <= step ? "bg-[color:var(--store-primary)]" : "bg-zinc-200 dark:bg-zinc-800"
            }`}
          />
          <span
            className={`truncate text-[10.5px] font-semibold ${
              i === step ? "text-[color:var(--store-primary)]" : "text-zinc-400"
            }`}
          >
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function SheetButton({
  children,
  onClick,
  disabled,
  loading,
  tone = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: "primary" | "neutral" | "danger";
}) {
  const toneCls =
    tone === "primary"
      ? "bg-[color:var(--store-primary)] text-white shadow-[0_12px_28px_-14px_var(--store-primary)] hover:brightness-110"
      : tone === "danger"
        ? "bg-rose-600 text-white shadow-[0_12px_28px_-14px_rgba(225,29,72,0.8)] hover:bg-rose-700"
        : "border border-black/[0.08] bg-white text-zinc-800 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 text-[15px] font-bold transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:active:scale-100 ${sheetFocusRing} ${toneCls}`}
    >
      {loading ? <LoaderCircle size={18} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

export function SheetNotice({
  tone = "info",
  icon,
  children,
}: {
  tone?: "info" | "warn" | "error" | "success";
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    tone === "warn"
      ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      : tone === "error"
        ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
        : tone === "success"
          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
          : "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200";
  return (
    <p role={tone === "error" ? "alert" : undefined} className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-medium leading-relaxed ${cls}`}>
      {icon ? <span className="mt-px shrink-0">{icon}</span> : null}
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** Label/value rows in a bordered list — matches the PAYG confirm summary. */
export function SheetFacts({ rows }: { rows: Array<{ label: string; value: React.ReactNode; tone?: "good" | "bad" } | null | false> }) {
  const list = rows.filter(Boolean) as Array<{ label: string; value: React.ReactNode; tone?: "good" | "bad" }>;
  if (!list.length) return null;
  return (
    <dl className="divide-y divide-black/[0.05] rounded-2xl border border-black/[0.06] bg-white/70 text-sm dark:divide-white/[0.06] dark:border-white/10 dark:bg-white/[0.03]">
      {list.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-zinc-500 dark:text-zinc-400">{r.label}</dt>
          <dd
            className={`text-end font-bold ${
              r.tone === "good"
                ? "text-emerald-600 dark:text-emerald-400"
                : r.tone === "bad"
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-zinc-900 dark:text-zinc-50"
            }`}
          >
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Admin-set menu labels often start with an emoji; the sheet already shows an SVG icon. */
export function stripLeadingEmoji(label: string) {
  return String(label || "").replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, "").trim() || label;
}
