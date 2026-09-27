"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Eye, EyeOff, Gift, LoaderCircle } from "lucide-react";
import { publicApi } from "@/lib/api";
import { useStorefrontLocale } from "./locale";
import { DigitalCodeBox, type DigitalOrderView } from "./DigitalCodeBox";
import type { CustomerOrder } from "./types";

const DELIVERED = new Set(["ACTIVE", "RENEWED", "COMPLETED", "FULFILLED"]);
const CLOSED = new Set(["CANCELLED", "REJECTED", "EXPIRED", "PROVISION_FAILED"]);

function DigitalOrderCard({ order }: { order: CustomerOrder }) {
  const { t, isFa } = useStorefrontLocale();
  const [revealed, setRevealed] = useState(false);
  const waitingOperator = DELIVERED.has(order.status) && !!order.digitalPendingManual;
  const delivered = DELIVERED.has(order.status) && !order.digitalPendingManual;
  const closed = CLOSED.has(order.status);

  const code = useQuery({
    queryKey: ["customer-digital-code", order.id],
    enabled: revealed && delivered,
    queryFn: async () =>
      (await publicApi.get(`/store/customer/orders/${encodeURIComponent(order.id)}/digital-code`))
        .data as DigitalOrderView,
    staleTime: 5 * 60_000,
  });

  const badge = delivered
    ? { label: t("تحویل شد", "Delivered"), cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" }
    : closed
      ? { label: t("بسته شد", "Closed"), cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" }
      : waitingOperator
        ? { label: t("در انتظار اپراتور", "Waiting for operator"), cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" }
        : { label: t("در حال بررسی", "In review"), cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };

  return (
    <div className="store-card overflow-hidden rounded-[var(--store-radius,1rem)] border">
      <div className="flex min-h-[64px] items-center gap-3 px-4 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
          <Gift size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">{order.productName}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
            <span dir="ltr" className="font-mono">{order.trackingCode}</span>
            <span aria-hidden>·</span>
            <span>{new Date(order.createdAt).toLocaleDateString(isFa ? "fa-IR" : "en-US")}</span>
          </div>
        </div>
        <span className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold ${badge.cls}`}>{badge.label}</span>
      </div>

      <div className="border-t border-black/[0.05] px-4 py-3 dark:border-white/[0.06]">
        {delivered ? (
          revealed ? (
            code.isLoading ? (
              <div className="flex justify-center py-6">
                <LoaderCircle className="animate-spin text-zinc-400" />
              </div>
            ) : code.data ? (
              <div className="space-y-3">
                <DigitalCodeBox view={code.data} productName={order.productName} compact />
                <button
                  type="button"
                  onClick={() => setRevealed(false)}
                  className="store-focus-ring inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-zinc-500 transition-colors duration-200 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <EyeOff size={15} /> {t("پنهان کردن کد", "Hide code")}
                </button>
              </div>
            ) : (
              <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
                {t("دریافت کد ناموفق بود. دوباره تلاش کنید.", "Could not load the code. Please try again.")}
              </p>
            )
          ) : (
            <div className="flex items-center gap-3">
              {order.digitalCodeMasked ? (
                <span dir="ltr" className="min-w-0 flex-1 truncate font-mono text-sm tracking-wider text-zinc-500">
                  {order.digitalCodeMasked}
                </span>
              ) : (
                <span className="min-w-0 flex-1 text-xs text-zinc-500">
                  {t("کد تحویلی آماده است.", "Your code is ready.")}
                </span>
              )}
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="store-focus-ring inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-[color:var(--store-primary)] px-4 text-xs font-bold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              >
                <Eye size={16} /> {t("نمایش کد", "Show code")}
              </button>
            </div>
          )
        ) : closed ? (
          <p className="text-xs text-zinc-500">{t("این سفارش تحویل نشد.", "This order was not delivered.")}</p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Clock size={14} />
              {waitingOperator || order.digitalDeliveryHint === "operator"
                ? t("پس از تحویل توسط اپراتور، کد اینجا نمایش داده می‌شود.", "The code appears here once the operator delivers it.")
                : t("پس از تأیید پرداخت، کد اینجا نمایش داده می‌شود.", "The code appears here after payment is approved.")}
            </p>
            <a
              href={`/track/${encodeURIComponent(order.trackingCode)}`}
              className="store-focus-ring inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 text-xs font-bold text-[color:var(--store-primary)] hover:bg-[color:var(--store-primary)]/10"
            >
              {t("پیگیری", "Track")}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export function DigitalOrdersList({ orders }: { orders: CustomerOrder[] }) {
  return (
    <div className="flex flex-col gap-2.5 sm:gap-3">
      {orders.map((order) => (
        <DigitalOrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}
