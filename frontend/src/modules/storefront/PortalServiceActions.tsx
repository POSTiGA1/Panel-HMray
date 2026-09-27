"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, CircleSlash, Clock, RotateCcw, Trash2, Wallet, XCircle } from "lucide-react";
import { useStorefrontLocale } from "./locale";
import type { CustomerCancelRequest } from "./types";
import { Sheet, SheetButton, SheetFacts, SheetNotice, SheetStep, sheetFocusRing } from "./portal-sheet";

export type CancelTarget = {
  id: string;
  targetType: "vpn_client" | "payg_sub";
  title: string;
};

type CancelMutation = {
  mutateAsync: (input: { id: string; targetType?: "vpn_client" | "payg_sub"; reason?: string }) => Promise<unknown>;
  isPending: boolean;
  reset: () => void;
};

function errText(err: any, fallback: string) {
  const m = err?.response?.data?.message;
  if (typeof m === "string") return m;
  if (Array.isArray(m)) return m.join(" · ");
  return err?.message || fallback;
}

/** Cancel + refund-to-wallet request, reviewed by the store admin (same flow as the bot button). */
export function CancelRefundSheet({
  target,
  onClose,
  requestCancel,
}: {
  target: CancelTarget | null;
  onClose: () => void;
  requestCancel?: CancelMutation;
}) {
  const { t } = useStorefrontLocale();
  const [shown, setShown] = useState<CancelTarget | null>(target);
  const [reasonKey, setReasonKey] = useState<string>("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!target) return;
    setShown(target);
    setReasonKey("");
    setNote("");
    setDone(false);
    setError("");
    requestCancel?.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id]);

  const reasons = [
    { id: "quality", label: t("کیفیت یا سرعت اتصال", "Connection quality / speed") },
    { id: "unneeded", label: t("دیگر نیاز ندارم", "I no longer need it") },
    { id: "mistake", label: t("خرید اشتباه", "Bought by mistake") },
    { id: "other", label: t("دلیل دیگر", "Other reason") },
  ];
  const isPayg = shown?.targetType === "payg_sub";
  const reasonLabel = reasons.find((r) => r.id === reasonKey)?.label || "";
  const reason = [reasonLabel, note.trim()].filter(Boolean).join(" — ");

  const submit = async () => {
    if (!shown || !requestCancel) return;
    setError("");
    try {
      await requestCancel.mutateAsync({ id: shown.id, targetType: shown.targetType, reason: reason || undefined });
      setDone(true);
    } catch (err) {
      setError(errText(err, t("ثبت درخواست ناموفق بود", "Could not submit the request")));
    }
  };

  return (
    <Sheet
      open={!!target}
      onClose={onClose}
      title={t("لغو سرویس و بازگشت وجه", "Cancel & refund")}
      subtitle={shown?.title}
      footer={
        done ? (
          <SheetButton onClick={onClose}>
            <Check size={18} />
            {t("متوجه شدم", "Got it")}
          </SheetButton>
        ) : (
          <div className="grid grid-cols-[1fr_1.4fr] gap-2">
            <SheetButton tone="neutral" onClick={onClose}>
              {t("انصراف", "Keep service")}
            </SheetButton>
            <SheetButton tone="danger" onClick={() => void submit()} loading={requestCancel?.isPending} disabled={!reasonKey}>
              <RotateCcw size={17} />
              {t("ثبت درخواست", "Submit request")}
            </SheetButton>
          </div>
        )
      }
    >
      <SheetStep stepKey={done ? "done" : "form"} direction={1}>
        {done ? (
          <div className="flex flex-col items-center py-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
              <Clock size={26} />
            </span>
            <div className="mt-3 text-base font-bold text-zinc-900 dark:text-zinc-50">
              {t("درخواست شما ثبت شد", "Request submitted")}
            </div>
            <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {t(
                "پس از بررسی ادمین، نتیجه در اعلان‌ها و بخش «درخواست‌های لغو» نمایش داده می‌شود. در صورت تأیید، مبلغ به کیف پول شما برمی‌گردد.",
                "An admin will review it. You'll see the result in alerts and under “Cancel requests”. If approved, the refund goes to your wallet.",
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <SheetFacts
              rows={[
                { label: t("مقصد بازگشت وجه", "Refund goes to"), value: t("کیف پول فروشگاه", "Store wallet") },
                {
                  label: t("مبلغ بازگشتی", "Refund amount"),
                  value: isPayg ? t("طبق مصرف — توسط ادمین", "Based on usage — set by admin") : t("پس از بررسی ادمین", "Set after admin review"),
                },
                { label: t("وضعیت سرویس", "Service after approval"), value: t("غیرفعال می‌شود", "Disabled"), tone: "bad" },
              ]}
            />

            <div>
              <div className="mb-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">{t("دلیل لغو", "Reason")}</div>
              <div role="radiogroup" aria-label={t("دلیل لغو", "Reason")} className="grid grid-cols-2 gap-2">
                {reasons.map((r) => {
                  const active = reasonKey === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-pressed={active}
                      onClick={() => setReasonKey(r.id)}
                      className={`store-card min-h-[48px] cursor-pointer rounded-xl border px-3 py-2 text-start text-[13px] font-semibold text-zinc-800 transition-[border-color,box-shadow] duration-200 dark:text-zinc-100 ${sheetFocusRing} ${
                        active ? "shadow-[0_8px_22px_-16px_var(--store-primary)]" : ""
                      }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                {t("توضیح بیشتر (اختیاری)", "More details (optional)")}
              </span>
              <textarea
                rows={2}
                maxLength={900}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full resize-none rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-zinc-900 outline-none transition-[border-color,box-shadow] duration-200 focus:border-[color:var(--store-primary)] focus:ring-2 focus:ring-[color:var(--store-primary)]/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-50"
                style={{ fontSize: 16 }}
              />
            </label>

            <SheetNotice tone="warn" icon={<AlertTriangle size={15} />}>
              {t(
                "با تأیید درخواست، سرویس غیرفعال می‌شود و قابل بازگشت نیست.",
                "Once approved, the service is disabled and can't be restored.",
              )}
            </SheetNotice>

            {error ? (
              <SheetNotice tone="error" icon={<XCircle size={15} />}>
                {error}
              </SheetNotice>
            ) : null}
          </div>
        )}
      </SheetStep>
    </Sheet>
  );
}

/** Small confirm sheet for destructive-but-simple actions (hide service, cancel unpaid order). */
export function ConfirmSheet({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  loading,
  icon,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  const { t } = useStorefrontLocale();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <SheetButton tone="neutral" onClick={onClose}>
            {t("انصراف", "Cancel")}
          </SheetButton>
          <SheetButton tone="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </SheetButton>
        </div>
      }
    >
      <div className="flex items-start gap-3 py-1">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
          {icon || <Trash2 size={20} />}
        </span>
        <p className="pt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{description}</p>
      </div>
    </Sheet>
  );
}

/** Customer-facing history of cancel / refund requests. */
export function CancelRequestsList({
  rows,
  resolveTitle,
}: {
  rows: CustomerCancelRequest[];
  resolveTitle: (row: CustomerCancelRequest) => string;
}) {
  const { t, formatToman, formatUsd, isFa } = useStorefrontLocale();
  if (!rows.length) return null;
  const money = (amount: number, currency?: string | null) =>
    ["TOMAN", "IRT", "IRR", "TMN"].includes(String(currency || "").toUpperCase())
      ? formatToman(amount)
      : formatUsd(amount);

  return (
    <section aria-label={t("درخواست‌های لغو و بازگشت وجه", "Cancel & refund requests")} className="space-y-2.5">
      <div className="flex items-center gap-2 px-1">
        <RotateCcw size={15} className="text-zinc-400" />
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
          {t("درخواست‌های لغو و بازگشت وجه", "Cancel & refund requests")}
        </h3>
      </div>
      {rows.map((row) => {
        const status =
          row.status === "APPROVED"
            ? {
                label: t("تأیید شد", "Approved"),
                cls: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
                Icon: Check,
              }
            : row.status === "REJECTED"
              ? { label: t("رد شد", "Rejected"), cls: "bg-rose-500/12 text-rose-700 dark:text-rose-300", Icon: CircleSlash }
              : { label: t("در انتظار بررسی", "Pending review"), cls: "bg-amber-500/12 text-amber-700 dark:text-amber-300", Icon: Clock };
        const refund = Number(row.refundAmount || 0);
        return (
          <div key={row.id} className="store-card rounded-2xl border px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">{resolveTitle(row)}</div>
                <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {row.targetType === "payg_sub" ? "PAYG" : "VPN"} ·{" "}
                  {new Date(row.createdAt).toLocaleDateString(isFa ? "fa-IR" : "en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${status.cls}`}>
                <status.Icon size={12} />
                {status.label}
              </span>
            </div>
            {row.status === "APPROVED" && refund > 0 ? (
              <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-emerald-500/[0.08] px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                <Wallet size={14} />
                {t("به کیف پول برگشت:", "Refunded to wallet:")} {money(refund, row.refundCurrency)}
              </div>
            ) : null}
            {row.status === "REJECTED" && row.rejectReason ? (
              <p className="mt-2.5 rounded-xl bg-rose-500/[0.07] px-3 py-2 text-xs leading-relaxed text-rose-700 dark:text-rose-300">
                {row.rejectReason}
              </p>
            ) : null}
            {row.reason ? (
              <p className="mt-2 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                {t("دلیل شما:", "Your reason:")} {row.reason}
              </p>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
