"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Gauge,
  ImagePlus,
  Layers,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  QrCode,
  Send,
  Smartphone,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import QRCode from "react-qr-code";
import { publicApi } from "@/lib/api";
import { copyToClipboard } from "@/lib/clipboard";
import { buildSubscriptionLink } from "./subscription";
import { compressReceiptImage } from "./receipt-image";
import { useStorefrontLocale } from "./locale";
import type { StorefrontStore } from "./types";
import {
  PickRow,
  Sheet,
  SheetButton as PrimaryButton,
  SheetStepper as Stepper,
  sheetFocusRing,
} from "./portal-sheet";

export type CustomerPaygSub = {
  id: string;
  status: string;
  planName: string;
  billingMode: string;
  limitIp?: number | null;
  ratePerHour?: number | null;
  ratePerGb?: number | null;
  clientEmail?: string | null;
  enable?: boolean | null;
  subId?: string | null;
  subUrl?: string | null;
  userPaused?: boolean;
  activatedAt?: string | null;
};

export type CustomerPaygOverview = {
  enabled?: boolean;
  balance: number;
  minWalletBalance: number;
  lowBalance?: boolean;
  empty?: boolean;
  hourlyBurn: number;
  perGbBurn: number;
  hasActive: boolean;
  subscriptions: CustomerPaygSub[];
};

type PaygTier = { limitIp: number; priceExtra: number; label?: string | null };

type PaygCatalogPlan = {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  billingMode: string;
  baseUnitPrice: number;
  unitLabel: string;
  tiers: PaygTier[];
  minWalletBalance?: number;
};

export type PaygCatalog = {
  minWalletBalance?: number;
  minWalletBalanceLowest?: number;
  chargeActivationUnit?: boolean;
  buttonLabel?: string | null;
  categories: Array<{ id: string; name: string; description?: string | null; planCount: number }>;
  plans: PaygCatalogPlan[];
};

type PaygPreview = {
  unitPrice: number;
  unitLabel: string;
  activationCharge: { kind: string; quantity: number; amount: number; unitLabel: string } | null;
  balance: number;
  minBalance: number;
  maxSubscriptions: number | null;
  openSubscriptions: number;
  canActivate: boolean;
  shortfall: number;
  tier?: PaygTier;
};

type Payment = StorefrontStore["payment"] | null | undefined;

type BuyStep = "wallet" | "category" | "plan" | "devices" | "confirm" | "done";

const focusRing = sheetFocusRing;

export function usePaygMoney() {
  const { isFa } = useStorefrontLocale();
  const walletQuery = useQuery({
    queryKey: ["customer-wallet-currency"],
    queryFn: async () =>
      (await publicApi.get("/store/customer/wallet")).data as { balance: number; currency: string },
    staleTime: 60_000,
  });
  const currency = String(walletQuery.data?.currency || "TOMAN").toUpperCase();
  const isToman = currency !== "USD";
  const format = (n: number | null | undefined) => {
    const v = Number(n) || 0;
    if (isToman) {
      const rounded = Math.round(v);
      return `${rounded.toLocaleString(isFa ? "fa-IR" : "en-US")} ${isFa ? "تومان" : "Toman"}`;
    }
    return `$${v.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
  };
  return {
    currency,
    isToman,
    format,
    balance: Number(walletQuery.data?.balance || 0),
    balanceLoading: walletQuery.isLoading,
    refetchBalance: walletQuery.refetch,
  };
}

export function isPaygTelegramRequiredError(err: any) {
  const d = err?.response?.data;
  return d?.code === "PAYG_TELEGRAM_REQUIRED" || d?.message?.code === "PAYG_TELEGRAM_REQUIRED";
}

/**
 * PAYG needs a Telegram-linked account (usage alerts and top-ups run through the bot).
 * Opens the store bot with a one-time `/start link_…` payload and polls the session until linked.
 */
export function TelegramConnectPanel({ compact }: { compact?: boolean }) {
  const { t } = useStorefrontLocale();
  const queryClient = useQueryClient();
  const [waiting, setWaiting] = useState(false);

  const link = useMutation({
    mutationFn: async () =>
      (await publicApi.post("/store/customer/telegram-link")).data as {
        linked: boolean;
        url: string | null;
      },
    onSuccess: (res) => {
      if (res.linked) {
        void queryClient.invalidateQueries({ queryKey: ["customer-session"] });
        return;
      }
      if (!res.url) return;
      const tg = (window as any)?.Telegram?.WebApp;
      if (tg?.openTelegramLink) tg.openTelegramLink(res.url);
      else window.open(res.url, "_blank", "noopener,noreferrer");
      setWaiting(true);
    },
  });

  useEffect(() => {
    if (!waiting) return;
    const id = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["customer-session"] });
    }, 5000);
    const stop = window.setTimeout(() => setWaiting(false), 15 * 60 * 1000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, [waiting, queryClient]);

  return (
    <div
      className={`rounded-2xl border border-sky-500/25 bg-sky-50/80 text-sky-900 dark:bg-sky-950/30 dark:text-sky-100 ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-300">
          <Send size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold">{t("اتصال تلگرام لازم است", "Telegram connection required")}</div>
          <p className="mt-1 text-xs leading-relaxed text-sky-800/80 dark:text-sky-200/80">
            {t(
              "برای خرید و استفاده از سرویس پرداخت به‌ازای مصرف، حساب تلگرام شما باید به این حساب متصل باشد. هشدار موجودی و شارژ از طریق ربات انجام می‌شود.",
              "Pay-as-you-go needs your Telegram account linked here. Balance alerts and top-ups go through the bot.",
            )}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <PrimaryButton onClick={() => link.mutate()} loading={link.isPending}>
          <Send size={18} />
          {waiting ? t("باز کردن دوباره ربات", "Open the bot again") : t("اتصال تلگرام", "Connect Telegram")}
        </PrimaryButton>
      </div>
      {waiting ? (
        <p className="mt-3 flex items-center justify-center gap-2 text-xs font-medium text-sky-700 dark:text-sky-300">
          <LoaderCircle size={14} className="animate-spin" />
          {t("در ربات روی Start بزنید؛ منتظر اتصال هستیم…", "Tap Start in the bot — waiting for the link…")}
        </p>
      ) : null}
      {link.error ? (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
          {errMessage(link.error, t("ساخت لینک اتصال ناموفق بود", "Could not create the link"))}
        </p>
      ) : null}
    </div>
  );
}

export function usePaygCatalog(enabled: boolean) {
  return useQuery({
    queryKey: ["customer-payg-catalog"],
    enabled,
    queryFn: async () => (await publicApi.get("/store/customer/payg/catalog")).data as PaygCatalog,
    staleTime: 120_000,
  });
}

function errMessage(err: any, fallback: string) {
  const d = err?.response?.data;
  const m = d?.message;
  if (typeof m === "string") return m;
  if (m && typeof m === "object" && typeof m.message === "string") return m.message;
  if (Array.isArray(m)) return m.join(" · ");
  return err?.message || fallback;
}

export function PaygBuySheet({
  open,
  onClose,
  catalog,
  onActivated,
  onTopUp,
  telegramLinked,
}: {
  open: boolean;
  onClose: () => void;
  catalog?: PaygCatalog;
  onActivated: (subId: string | null) => void;
  onTopUp: (amount?: number) => void;
  telegramLinked?: boolean;
}) {
  const { t, isFa } = useStorefrontLocale();
  const money = usePaygMoney();
  const queryClient = useQueryClient();
  const categories = catalog?.categories || [];
  const [categoryId, setCategoryId] = useState<string>("");
  const [planId, setPlanId] = useState<string>("");
  const [limitIp, setLimitIp] = useState<number | null>(null);
  const [step, setStep] = useState<BuyStep>("wallet");
  const [activated, setActivated] = useState<{ id: string; subId: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  const plans = useMemo(
    () => (catalog?.plans || []).filter((p) => !categoryId || p.categoryId === categoryId),
    [catalog?.plans, categoryId],
  );
  const plan = (catalog?.plans || []).find((p) => p.id === planId) || null;
  const tiers = plan?.tiers || [];
  const hasTierStep = tiers.length > 1;
  const skipCategory = categories.length <= 1;
  const lowestMin = Number(catalog?.minWalletBalanceLowest ?? catalog?.minWalletBalance ?? 0);
  const walletShort = Math.max(0, lowestMin - money.balance);

  useEffect(() => {
    if (!open) return;
    const cats = catalog?.categories || [];
    setPlanId("");
    setLimitIp(null);
    setActivated(null);
    setCategoryId(cats.length === 1 ? cats[0].id : "");
    setStep("wallet");
    void money.refetchBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, catalog?.categories]);

  const overview = useQuery({
    queryKey: ["customer-payg", "activated", activated?.id],
    enabled: open && step === "done" && !!activated?.id,
    queryFn: async () =>
      (await publicApi.get("/store/customer/payg")).data as CustomerPaygOverview,
  });
  const activatedSub = overview.data?.subscriptions?.find((s) => s.id === activated?.id) || null;
  const activatedLink = activatedSub
    ? buildSubscriptionLink(activatedSub.subId, null, activatedSub.subUrl)
    : activated?.subId
      ? buildSubscriptionLink(activated.subId, null, null)
      : "";

  const preview = useQuery({
    queryKey: ["customer-payg-preview", planId, limitIp],
    enabled: open && step === "confirm" && !!planId && telegramLinked !== false,
    queryFn: async () =>
      (
        await publicApi.post("/store/customer/payg/preview", {
          planId,
          limitIp: limitIp ?? undefined,
        })
      ).data as PaygPreview,
  });

  const activate = useMutation({
    mutationFn: async () =>
      (
        await publicApi.post("/store/customer/payg/activate", {
          planId,
          limitIp: limitIp ?? undefined,
        })
      ).data as { id: string; subId?: string | null },
    onSuccess: async (res) => {
      setActivated({ id: res.id, subId: res?.subId || null });
      setStep("done");
      await queryClient.invalidateQueries({ queryKey: ["customer-payg"] });
      await queryClient.invalidateQueries({ queryKey: ["customer-session"] });
      void money.refetchBalance();
    },
  });

  const unitSuffix = (mode: string) =>
    mode === "VOLUME" ? t("هر گیگ", "per GB") : t("هر ساعت", "per hour");

  const afterWallet = (): BuyStep => (skipCategory ? "plan" : "category");

  const goBack = () => {
    activate.reset();
    if (step === "confirm") setStep(hasTierStep ? "devices" : "plan");
    else if (step === "devices") setStep("plan");
    else if (step === "plan") setStep(skipCategory ? "wallet" : "category");
    else if (step === "category") setStep("wallet");
  };

  const stepOrder: BuyStep[] = ["wallet", "category", "plan", "devices", "confirm"];
  const labels = [
    t("موجودی", "Balance"),
    t("دسته", "Category"),
    t("پلن", "Plan"),
    t("کاربر", "Devices"),
    t("تأیید", "Confirm"),
  ];
  const stepIndex = Math.max(0, stepOrder.indexOf(step));

  const close = () => {
    if (activated) onActivated(activated.subId);
    else onClose();
  };

  const p = preview.data;
  const fewer = p && p.maxSubscriptions && p.openSubscriptions >= p.maxSubscriptions;
  const needsTelegram = telegramLinked === false || isPaygTelegramRequiredError(preview.error);

  return (
    <Sheet
      open={open}
      onClose={close}
      title={catalog?.buttonLabel || t("خرید سرویس PAYG", "Buy a PAYG service")}
      subtitle={t("پرداخت به‌اندازه مصرف از کیف پول", "Pay as you go from your wallet")}
      onBack={!needsTelegram && step !== "wallet" && step !== "done" ? goBack : undefined}
      footer={
        needsTelegram ? null : step === "wallet" ? (
          walletShort > 0 ? (
            <div className="grid gap-2">
              <PrimaryButton onClick={() => onTopUp(Math.ceil(walletShort))}>
                <Wallet size={18} />
                {t("شارژ کیف پول", "Top up wallet")} · {money.format(walletShort)}
              </PrimaryButton>
              <PrimaryButton tone="neutral" onClick={() => setStep(afterWallet())}>
                {t("مشاهده پلن‌ها", "Browse plans")}
              </PrimaryButton>
            </div>
          ) : (
            <PrimaryButton onClick={() => setStep(afterWallet())} disabled={money.balanceLoading}>
              {t("ادامه و انتخاب پلن", "Continue to plans")}
            </PrimaryButton>
          )
        ) : step === "done" ? (
          <PrimaryButton onClick={close}>
            <Check size={18} />
            {t("تمام", "Done")}
          </PrimaryButton>
        ) : step === "confirm" ? (
          p && !p.canActivate && !fewer ? (
            <PrimaryButton onClick={() => onTopUp(Math.ceil(p.shortfall))}>
              <Wallet size={18} />
              {t("شارژ کیف پول", "Top up wallet")} · {money.format(p.shortfall)}
            </PrimaryButton>
          ) : (
            <PrimaryButton
              onClick={() => activate.mutate()}
              loading={activate.isPending}
              disabled={!p || !p.canActivate || preview.isFetching}
            >
              <Zap size={18} />
              {t("فعال‌سازی سرویس", "Activate service")}
            </PrimaryButton>
          )
        ) : null
      }
    >
      {needsTelegram ? <TelegramConnectPanel compact /> : null}

      {!needsTelegram && step !== "done" ? <Stepper step={stepIndex} labels={labels} /> : null}

      {!needsTelegram && step === "wallet" ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-black/[0.06] bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-zinc-950/40">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
              <Wallet size={14} /> {t("موجودی کیف پول", "Wallet balance")}
            </div>
            <div
              className={`mt-1 text-[1.6rem] font-black tracking-tight ${
                walletShort > 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-900 dark:text-zinc-50"
              }`}
            >
              {money.balanceLoading ? <LoaderCircle className="animate-spin text-zinc-400" /> : money.format(money.balance)}
            </div>
          </div>
          <dl className="divide-y divide-black/[0.05] rounded-2xl border border-black/[0.06] bg-white text-sm dark:divide-white/[0.06] dark:border-white/10 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <dt className="text-zinc-500">{t("حداقل موجودی برای فعال‌سازی", "Minimum balance to activate")}</dt>
              <dd className="font-bold">{money.format(lowestMin)}</dd>
            </div>
            {catalog?.chargeActivationUnit ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-zinc-500">{t("هزینه فعال‌سازی", "Activation charge")}</dt>
                <dd className="text-end text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                  {t("هزینه ۱ گیگ یا ۱ ساعت اول هنگام فعال‌سازی کسر می‌شود", "First 1 GB / 1 hour is charged at activation")}
                </dd>
              </div>
            ) : null}
          </dl>
          {walletShort > 0 ? (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle size={16} className="mt-px shrink-0" />
              {t(
                `برای فعال‌سازی حداقل ${money.format(walletShort)} دیگر شارژ لازم است.`,
                `You need at least ${money.format(walletShort)} more to activate.`,
              )}
            </p>
          ) : (
            <p className="text-xs leading-relaxed text-zinc-500">
              {t(
                "مبلغ بر اساس مصرف از کیف پول کسر می‌شود و سرویس تا صفر شدن موجودی فعال می‌ماند.",
                "Charges come out of your wallet as you use the service. It stays up until the balance runs out.",
              )}
            </p>
          )}
        </div>
      ) : null}

      {!needsTelegram && step === "category" ? (
        <div className="space-y-2.5">
          {!categories.length ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              {t("فعلاً پلنی برای خرید موجود نیست.", "No plans are available right now.")}
            </p>
          ) : (
            categories.map((c) => (
              <PickRow
                key={c.id}
                title={c.name}
                hint={c.description}
                icon={<Layers size={18} />}
                meta={`${c.planCount.toLocaleString(isFa ? "fa-IR" : "en-US")} ${t("پلن", "plans")}`}
                selected={categoryId === c.id}
                onClick={() => {
                  setCategoryId(c.id);
                  setPlanId("");
                  setStep("plan");
                }}
              />
            ))
          )}
        </div>
      ) : null}

      {!needsTelegram && step === "plan" ? (
        <div className="space-y-2.5">
          {!plans.length ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              {t("فعلاً پلنی برای خرید موجود نیست.", "No plans are available right now.")}
            </p>
          ) : null}
          {plans.map((pl) => (
            <PickRow
              key={pl.id}
              title={pl.name}
              hint={[
                pl.description ||
                  (pl.billingMode === "VOLUME"
                    ? t("حجمی — فقط به‌اندازه ترافیک مصرفی", "Volume — billed per GB used")
                    : t("زمانی — بر اساس ساعت فعال بودن", "Time — billed per active hour")),
                pl.minWalletBalance != null
                  ? `${t("حداقل موجودی", "Min balance")}: ${money.format(pl.minWalletBalance)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              icon={pl.billingMode === "VOLUME" ? <Gauge size={18} /> : <Clock size={18} />}
              meta={
                <span className="flex flex-col items-end leading-tight">
                  <span className="text-[13px] font-bold text-zinc-900 dark:text-zinc-50">
                    {money.format(pl.baseUnitPrice)}
                  </span>
                  <span className="text-[10.5px] font-medium text-zinc-500">{unitSuffix(pl.billingMode)}</span>
                </span>
              }
              selected={planId === pl.id}
              onClick={() => {
                setPlanId(pl.id);
                const tl = pl.tiers || [];
                setLimitIp(tl[0]?.limitIp ?? null);
                setStep(tl.length > 1 ? "devices" : "confirm");
              }}
            />
          ))}
        </div>
      ) : null}

      {!needsTelegram && step === "devices" && plan ? (
        <div className="space-y-2.5">
          <p className="mb-1 text-xs text-zinc-500">
            {t("تعداد کاربر هم‌زمان را انتخاب کنید.", "Choose how many devices can connect at once.")}
          </p>
          {tiers.map((tier) => (
            <PickRow
              key={tier.limitIp}
              title={
                tier.label ||
                (tier.limitIp > 0
                  ? `${tier.limitIp.toLocaleString(isFa ? "fa-IR" : "en-US")} ${t("کاربر", "devices")}`
                  : t("نامحدود", "Unlimited"))
              }
              icon={<Smartphone size={18} />}
              meta={
                <span className="flex flex-col items-end leading-tight">
                  <span className="text-[13px] font-bold text-zinc-900 dark:text-zinc-50">
                    {money.format(plan.baseUnitPrice + (Number(tier.priceExtra) || 0))}
                  </span>
                  <span className="text-[10.5px] font-medium text-zinc-500">{unitSuffix(plan.billingMode)}</span>
                </span>
              }
              selected={limitIp === tier.limitIp}
              onClick={() => {
                setLimitIp(tier.limitIp);
                setStep("confirm");
              }}
            />
          ))}
        </div>
      ) : null}

      {!needsTelegram && step === "done" ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center pt-2 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
              <Check size={28} />
            </span>
            <div className="mt-3 text-base font-bold">{t("سرویس فعال شد", "Service activated")}</div>
            <p className="mt-1 max-w-xs text-xs text-zinc-500">
              {t(
                "لینک اشتراک را در برنامه خود وارد کنید یا QR را اسکن کنید.",
                "Add the subscription link to your app or scan the QR code.",
              )}
            </p>
          </div>
          {activatedLink ? (
            <div className="space-y-3">
              <div className="flex justify-center rounded-2xl bg-white p-4">
                <QRCode value={activatedLink} size={184} />
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-black/[0.06] bg-zinc-50/70 p-2.5 dark:border-white/10 dark:bg-zinc-950/50">
                <div dir="ltr" className="min-w-0 flex-1 truncate px-1 font-mono text-[11.5px] text-zinc-600 dark:text-zinc-300">
                  {activatedLink}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void copyToClipboard(activatedLink);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className={`flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[color:var(--store-primary)] px-3.5 text-xs font-bold text-white transition-all duration-200 hover:brightness-110 ${focusRing}`}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? t("کپی شد", "Copied") : t("کپی لینک", "Copy link")}
                </button>
              </div>
            </div>
          ) : overview.isLoading ? (
            <div className="flex justify-center py-6">
              <LoaderCircle className="animate-spin text-zinc-400" />
            </div>
          ) : (
            <p className="text-center text-xs text-zinc-500">
              {t("لینک اشتراک در بخش سرویس‌های PAYG نمایش داده می‌شود.", "The subscription link is listed under your PAYG services.")}
            </p>
          )}
        </div>
      ) : null}

      {!needsTelegram && step === "confirm" && plan ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-black/[0.06] bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-zinc-950/40">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-bold">{plan.name}</div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {plan.billingMode === "VOLUME" ? t("حجمی", "Volume") : t("زمانی", "Time")}
                  {" · "}
                  {limitIp && limitIp > 0
                    ? `${limitIp.toLocaleString(isFa ? "fa-IR" : "en-US")} ${t("کاربر", "devices")}`
                    : t("کاربر نامحدود", "Unlimited devices")}
                </div>
              </div>
              <span className="shrink-0 rounded-xl bg-[color:var(--store-primary)]/10 px-2.5 py-1 text-xs font-bold text-[color:var(--store-primary)]">
                {money.format(p?.unitPrice ?? plan.baseUnitPrice)} / {unitSuffix(plan.billingMode)}
              </span>
            </div>
          </div>

          {preview.isLoading ? (
            <div className="flex justify-center py-8">
              <LoaderCircle className="animate-spin text-zinc-400" />
            </div>
          ) : preview.error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
              {errMessage(preview.error, t("پیش‌نمایش ناموفق بود", "Preview failed"))}
            </p>
          ) : p ? (
            <dl className="divide-y divide-black/[0.05] rounded-2xl border border-black/[0.06] bg-white text-sm dark:divide-white/[0.06] dark:border-white/10 dark:bg-zinc-900">
              {p.activationCharge && p.activationCharge.amount > 0 ? (
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <dt className="text-zinc-500">{t("هزینه فعال‌سازی", "Activation charge")}</dt>
                  <dd className="font-bold">{money.format(p.activationCharge.amount)}</dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-zinc-500">{t("حداقل موجودی لازم", "Required balance")}</dt>
                <dd className="font-bold">{money.format(p.minBalance)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-zinc-500">{t("موجودی شما", "Your balance")}</dt>
                <dd className={`font-bold ${p.shortfall > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {money.format(p.balance)}
                </dd>
              </div>
              {p.maxSubscriptions ? (
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <dt className="text-zinc-500">{t("سرویس‌های باز", "Open services")}</dt>
                  <dd className="font-bold">
                    {p.openSubscriptions.toLocaleString(isFa ? "fa-IR" : "en-US")} /{" "}
                    {p.maxSubscriptions.toLocaleString(isFa ? "fa-IR" : "en-US")}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          {p && fewer ? (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle size={16} className="mt-px shrink-0" />
              {t(
                "به سقف تعداد سرویس PAYG رسیده‌اید. ابتدا یک سرویس را لغو کنید.",
                "You reached the PAYG service limit. Cancel one before activating another.",
              )}
            </p>
          ) : p && p.shortfall > 0 ? (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle size={16} className="mt-px shrink-0" />
              {t(
                `برای فعال‌سازی ${money.format(p.shortfall)} دیگر شارژ لازم است.`,
                `You need ${money.format(p.shortfall)} more to activate.`,
              )}
            </p>
          ) : (
            <p className="text-xs leading-relaxed text-zinc-500">
              {t(
                "مبلغ به‌صورت خودکار بر اساس مصرف از کیف پول کسر می‌شود. سرویس تا صفر شدن موجودی فعال می‌ماند.",
                "Charges are deducted from your wallet as you use the service. It stays up until the balance reaches zero.",
              )}
            </p>
          )}

          {activate.error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
              {errMessage(activate.error, t("فعال‌سازی ناموفق بود", "Activation failed"))}
            </p>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}

export function PaygTopUpSheet({
  open,
  onClose,
  payment,
  suggestedAmount,
}: {
  open: boolean;
  onClose: () => void;
  payment: Payment;
  suggestedAmount?: number;
}) {
  const { t, isFa } = useStorefrontLocale();
  const money = usePaygMoney();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [receiptText, setReceiptText] = useState("");
  const [receiptImage, setReceiptImage] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(suggestedAmount && suggestedAmount > 0 ? String(suggestedAmount) : "");
    setReceiptText("");
    setReceiptImage("");
    setDone(false);
  }, [open, suggestedAmount]);

  const cards = useMemo(() => {
    const list = (payment?.cards || []).filter((c) => c.enabled !== false && c.cardNumber);
    if (list.length) return list;
    return payment?.cardNumber
      ? [
          {
            id: "default",
            cardNumber: payment.cardNumber || "",
            cardHolder: payment.cardHolder || "",
            bankName: payment.bankName || "",
          },
        ]
      : [];
  }, [payment]);

  const deposit = useMutation({
    mutationFn: async () =>
      (
        await publicApi.post("/store/customer/wallet/deposit", {
          amount: Number(amount),
          currency: money.currency,
          receiptText: receiptText || undefined,
          receiptImage: receiptImage || undefined,
        })
      ).data,
    onSuccess: async () => {
      setDone(true);
      await queryClient.invalidateQueries({ queryKey: ["customer-payg"] });
    },
  });

  const presets = money.isToman ? [100_000, 200_000, 500_000, 1_000_000] : [5, 10, 20, 50];
  const valid = Number(amount) > 0 && (!!receiptText.trim() || !!receiptImage);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("شارژ کیف پول", "Top up wallet")}
      subtitle={t("پس از تأیید رسید، موجودی افزایش می‌یابد", "Balance updates after the receipt is approved")}
      footer={
        done ? (
          <PrimaryButton onClick={onClose} tone="neutral">
            {t("بستن", "Close")}
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={() => deposit.mutate()} disabled={!valid} loading={deposit.isPending}>
            <Check size={18} />
            {t("ثبت رسید پرداخت", "Submit receipt")}
          </PrimaryButton>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
            <Check size={28} />
          </span>
          <div className="mt-4 text-base font-bold">{t("رسید ثبت شد", "Receipt submitted")}</div>
          <p className="mt-1.5 max-w-xs text-sm text-zinc-500">
            {t(
              "پس از بررسی توسط فروشنده، موجودی کیف پول شما شارژ می‌شود.",
              "Your wallet will be credited once the seller reviews it.",
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="payg-topup-amount" className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              {t("مبلغ", "Amount")} ({money.isToman ? t("تومان", "Toman") : "USD"})
            </label>
            <input
              id="payg-topup-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              className={`h-12 w-full rounded-2xl border border-black/[0.08] bg-zinc-50 px-4 text-base font-bold outline-none transition-colors duration-200 focus:border-[color:var(--store-primary)] dark:border-white/10 dark:bg-zinc-950 ${focusRing}`}
              placeholder="0"
            />
            <div className="mt-2 grid grid-cols-4 gap-2">
              {presets.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(String(v))}
                  className={`min-h-[44px] cursor-pointer rounded-xl border text-xs font-bold transition-colors duration-200 ${focusRing} ${
                    Number(amount) === v
                      ? "border-[color:var(--store-primary)] bg-[color:var(--store-primary)]/10 text-[color:var(--store-primary)]"
                      : "border-black/[0.07] bg-white text-zinc-700 hover:border-[color:var(--store-primary)]/40 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200"
                  }`}
                >
                  {v.toLocaleString(isFa ? "fa-IR" : "en-US")}
                </button>
              ))}
            </div>
          </div>

          {cards.length ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                {t("واریز به کارت", "Transfer to card")}
              </div>
              {cards.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-gradient-to-br from-zinc-50 to-white p-3.5 dark:border-white/10 dark:from-zinc-900 dark:to-zinc-950"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--store-primary)]/10 text-[color:var(--store-primary)]">
                    <CreditCard size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div dir="ltr" className="truncate text-start font-mono text-[15px] font-bold tracking-wider">
                      {String(c.cardNumber).replace(/\s+/g, "").replace(/(\d{4})(?=\d)/g, "$1 ")}
                    </div>
                    <div className="truncate text-xs text-zinc-500">
                      {[c.cardHolder, c.bankName].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void copyToClipboard(String(c.cardNumber).replace(/\s+/g, ""));
                      setCopied(c.id);
                      setTimeout(() => setCopied(null), 1500);
                    }}
                    aria-label={t("کپی شماره کارت", "Copy card number")}
                    className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-zinc-500 transition-colors duration-200 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${focusRing}`}
                  >
                    {copied === c.id ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {payment?.instructions ? (
            <p className="whitespace-pre-line rounded-xl bg-zinc-50 px-3 py-2.5 text-xs leading-relaxed text-zinc-600 dark:bg-zinc-950/60 dark:text-zinc-300">
              {payment.instructions}
            </p>
          ) : null}

          <div>
            <div className="mb-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              {t("رسید پرداخت", "Payment receipt")}
            </div>
            <label
              className={`flex min-h-[88px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-3 py-4 text-center transition-colors duration-200 ${
                receiptImage
                  ? "border-emerald-400/60 bg-emerald-50/60 dark:bg-emerald-950/20"
                  : "border-zinc-200 hover:border-[color:var(--store-primary)]/50 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
              }`}
            >
              {receiptImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={receiptImage} alt="" className="max-h-40 rounded-lg object-contain" />
              ) : (
                <>
                  <ImagePlus size={22} className="text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                    {t("انتخاب تصویر رسید", "Choose receipt image")}
                  </span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    setReceiptImage(await compressReceiptImage(file));
                  } catch {
                    /* ignore */
                  }
                }}
              />
            </label>
            <textarea
              value={receiptText}
              onChange={(e) => setReceiptText(e.target.value)}
              rows={2}
              placeholder={t("یا شماره پیگیری / توضیح رسید", "Or tracking number / receipt note")}
              className={`mt-2 w-full resize-none rounded-2xl border border-black/[0.08] bg-zinc-50 px-4 py-3 outline-none transition-colors duration-200 focus:border-[color:var(--store-primary)] dark:border-white/10 dark:bg-zinc-950 ${focusRing}`}
              style={{ fontSize: 16 }}
            />
          </div>

          {deposit.error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
              {errMessage(deposit.error, t("ثبت رسید ناموفق بود", "Could not submit receipt"))}
            </p>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}

export function PaygSubRow({
  sub,
  defaultOpen,
  cancelRefundEnabled,
  cancelPending,
  onRequestCancel,
  cancelBusy,
}: {
  sub: CustomerPaygSub;
  defaultOpen?: boolean;
  cancelRefundEnabled?: boolean;
  cancelPending?: boolean;
  onRequestCancel?: () => void;
  cancelBusy?: boolean;
}) {
  const { t, isFa } = useStorefrontLocale();
  const money = usePaygMoney();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(!!defaultOpen);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const paused = !!sub.userPaused || sub.status === "SUSPENDED";
  const link = buildSubscriptionLink(sub.subId, null, sub.subUrl);

  const usage = useQuery({
    queryKey: ["customer-payg-usage", sub.id],
    enabled: open,
    queryFn: async () =>
      (await publicApi.get(`/store/customer/payg/${sub.id}/usage`)).data as {
        daily: Array<{ date?: string; day?: string; amount?: number; quantity?: number }>;
      },
    staleTime: 60_000,
  });

  const toggle = useMutation({
    mutationFn: async () =>
      (await publicApi.post(`/store/customer/payg/${sub.id}/${paused ? "resume" : "pause"}`)).data,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["customer-payg"] });
      const snapshots = queryClient.getQueriesData<CustomerPaygOverview>({ queryKey: ["customer-payg"] });
      for (const [key, value] of snapshots) {
        if (!value?.subscriptions) continue;
        queryClient.setQueryData<CustomerPaygOverview>(key, {
          ...value,
          subscriptions: value.subscriptions.map((s) =>
            s.id === sub.id
              ? { ...s, userPaused: !paused, status: paused ? "ACTIVE" : "SUSPENDED" }
              : s,
          ),
        });
      }
      return { snapshots };
    },
    onError: (_e, _v, ctx) => {
      for (const [key, value] of ctx?.snapshots || []) queryClient.setQueryData(key, value);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["customer-payg"] });
    },
  });

  const rate =
    sub.billingMode === "VOLUME"
      ? sub.ratePerGb != null
        ? `${money.format(sub.ratePerGb)} / ${t("گیگ", "GB")}`
        : null
      : sub.ratePerHour != null
        ? `${money.format(sub.ratePerHour)} / ${t("ساعت", "h")}`
        : null;

  const statusTone = paused
    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  const statusLabel = sub.userPaused
    ? t("متوقف", "Paused")
    : sub.status === "SUSPENDED"
      ? t("معلق", "Suspended")
      : t("فعال", "Active");

  const days = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const d of usage.data?.daily || []) {
      const key = String(d.day || d.date || "").slice(0, 10);
      if (!key) continue;
      byDay.set(key, (byDay.get(key) || 0) + (Number(d.amount) || 0));
    }
    return [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 7)
      .map(([day, amount]) => ({ day, amount }));
  }, [usage.data?.daily]);
  const maxDay = Math.max(1, ...days.map((d) => d.amount));

  return (
    <div
      data-open={open ? "true" : undefined}
      className={`store-card overflow-hidden rounded-[var(--store-radius,1rem)] border transition-[border-color,box-shadow] duration-200 ${
        open ? "shadow-[0_12px_32px_-22px_rgba(0,0,0,0.35)]" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex min-h-[64px] w-full cursor-pointer items-center gap-3 px-4 py-3 text-start ${focusRing}`}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            paused ? "bg-amber-500/10 text-amber-600" : "bg-[color:var(--store-primary)]/10 text-[color:var(--store-primary)]"
          }`}
        >
          {sub.billingMode === "VOLUME" ? <Gauge size={18} /> : <Clock size={18} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">{sub.planName}</span>
          <span className="mt-0.5 block truncate text-xs text-zinc-500">
            {sub.billingMode === "VOLUME" ? t("حجمی", "Volume") : t("زمانی", "Time")}
            {rate ? ` · ${rate}` : ""}
          </span>
        </span>
        <span className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold ${statusTone}`}>{statusLabel}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-black/[0.05] px-4 pb-4 pt-3 dark:border-white/[0.06]">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-950/60">
                  <div className="text-zinc-500">{t("کاربر هم‌زمان", "Devices")}</div>
                  <div className="mt-0.5 font-bold">
                    {sub.limitIp ? sub.limitIp.toLocaleString(isFa ? "fa-IR" : "en-US") : t("نامحدود", "Unlimited")}
                  </div>
                </div>
                <div className="rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-950/60">
                  <div className="text-zinc-500">{t("نرخ", "Rate")}</div>
                  <div className="mt-0.5 truncate font-bold">{rate || "—"}</div>
                </div>
              </div>

              {link ? (
                <div className="rounded-xl border border-black/[0.06] bg-zinc-50/70 p-2.5 dark:border-white/10 dark:bg-zinc-950/50">
                  <div className="flex items-center gap-2">
                    <div dir="ltr" className="min-w-0 flex-1 truncate px-1 font-mono text-[11.5px] text-zinc-600 dark:text-zinc-300">
                      {link}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowQr((v) => !v)}
                      aria-label="QR"
                      aria-pressed={showQr}
                      className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-zinc-500 transition-colors duration-200 hover:bg-white hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${focusRing}`}
                    >
                      <QrCode size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void copyToClipboard(link);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                      aria-label={t("کپی لینک", "Copy link")}
                      className={`flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[color:var(--store-primary)] px-3.5 text-xs font-bold text-white transition-all duration-200 hover:brightness-110 ${focusRing}`}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? t("کپی شد", "Copied") : t("کپی", "Copy")}
                    </button>
                  </div>
                  {showQr ? (
                    <div className="mt-2.5 flex justify-center rounded-xl bg-white p-3">
                      <QRCode value={link} size={176} />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div>
                <div className="mb-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  {t("مصرف ۷ روز اخیر", "Last 7 days")}
                </div>
                {usage.isLoading ? (
                  <div className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
                ) : days.length ? (
                  <ul className="space-y-1.5">
                    {days.map((d) => {
                      const amt = d.amount;
                      return (
                        <li key={d.day} className="flex items-center gap-2 text-[11.5px]">
                          <span className="w-20 shrink-0 truncate text-zinc-500" dir="ltr">
                            {d.day}
                          </span>
                          <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <span
                              className="block h-full rounded-full bg-[color:var(--store-primary)]"
                              style={{ width: `${Math.max(4, (amt / maxDay) * 100)}%` }}
                            />
                          </span>
                          <span className="w-24 shrink-0 text-end font-semibold">{money.format(amt)}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-zinc-500">{t("هنوز مصرفی ثبت نشده.", "No usage recorded yet.")}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate()}
                  className={`flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition-colors duration-200 disabled:opacity-50 ${focusRing} ${
                    paused
                      ? "border-emerald-500/30 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : "border-amber-500/30 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300"
                  }`}
                >
                  {toggle.isPending ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : paused ? (
                    <Play size={16} />
                  ) : (
                    <Pause size={16} />
                  )}
                  {paused ? t("ادامه سرویس", "Resume") : t("توقف موقت", "Pause")}
                </button>
                {cancelRefundEnabled ? (
                  cancelPending ? (
                    <span className="flex min-h-[44px] items-center justify-center rounded-xl bg-amber-100 px-2 text-center text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      {t("درخواست لغو ثبت شد", "Cancel requested")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={cancelBusy}
                      onClick={() => onRequestCancel?.()}
                      className={`flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-rose-500/25 text-xs font-bold text-rose-600 transition-colors duration-200 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950/30 ${focusRing}`}
                    >
                      <X size={16} />
                      {t("لغو و بازگشت وجه", "Cancel & refund")}
                    </button>
                  )
                ) : null}
              </div>
              {toggle.error ? (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
                  {errMessage(toggle.error, t("عملیات ناموفق بود", "Action failed"))}
                </p>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function PaygHeroCard({
  payg,
  onBuy,
  onTopUp,
  canBuy,
}: {
  payg?: CustomerPaygOverview;
  onBuy: () => void;
  onTopUp: () => void;
  canBuy: boolean;
}) {
  const { t } = useStorefrontLocale();
  const money = usePaygMoney();
  const balance = Number(payg?.balance || 0);
  const hourly = Number(payg?.hourlyBurn || 0);
  const perGb = Number(payg?.perGbBurn || 0);
  const hoursLeft = hourly > 0 ? balance / hourly : null;
  const tone = payg?.empty
    ? "from-rose-500/15 to-rose-500/[0.03] border-rose-500/25"
    : payg?.lowBalance
      ? "from-amber-500/15 to-amber-500/[0.03] border-amber-500/25"
      : "from-[color:var(--store-primary)]/15 to-[color:var(--store-primary)]/[0.03] border-[color:var(--store-primary)]/20";

  return (
    <div className={`rounded-[1.75rem] border bg-gradient-to-br p-5 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            <Wallet size={14} /> {t("موجودی کیف پول", "Wallet balance")}
          </div>
          <div className="mt-1 truncate text-[1.75rem] font-black tracking-tight text-zinc-900 dark:text-zinc-50">
            {money.format(balance)}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-zinc-500">
            {hourly > 0 ? (
              <span>
                {t("مصرف ساعتی", "Hourly burn")}: <b className="text-zinc-700 dark:text-zinc-200">{money.format(hourly)}</b>
              </span>
            ) : null}
            {perGb > 0 ? (
              <span>
                {t("هر گیگ", "Per GB")}: <b className="text-zinc-700 dark:text-zinc-200">{money.format(perGb)}</b>
              </span>
            ) : null}
            {hoursLeft != null && Number.isFinite(hoursLeft) ? (
              <span>
                {t("زمان تقریبی باقی‌مانده", "Approx. time left")}:{" "}
                <b className="text-zinc-700 dark:text-zinc-200">
                  {hoursLeft >= 48
                    ? `${Math.floor(hoursLeft / 24)} ${t("روز", "days")}`
                    : `${Math.floor(hoursLeft)} ${t("ساعت", "h")}`}
                </b>
              </span>
            ) : null}
          </div>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-[color:var(--store-primary)] shadow-sm dark:bg-zinc-900/70">
          <Zap size={20} />
        </span>
      </div>

      {payg?.empty ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
          <AlertTriangle size={14} />
          {t("موجودی صفر است؛ سرویس‌های PAYG معلق می‌شوند.", "Balance is empty; PAYG services are suspended.")}
        </p>
      ) : payg?.lowBalance ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
          <AlertTriangle size={14} />
          {t("موجودی کم است — شارژ کنید تا سرویس قطع نشود.", "Low balance — top up before it runs out.")}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onTopUp}
          className={`flex min-h-[48px] cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-black/[0.08] bg-white text-sm font-bold text-zinc-800 transition-all duration-200 hover:bg-zinc-50 active:scale-[0.98] dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 ${focusRing}`}
        >
          <Wallet size={17} /> {t("شارژ کیف پول", "Top up")}
        </button>
        <button
          type="button"
          onClick={onBuy}
          disabled={!canBuy}
          className={`flex min-h-[48px] cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-[color:var(--store-primary)] text-sm font-bold text-white shadow-[0_12px_28px_-14px_var(--store-primary)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
        >
          <Plus size={17} /> {t("خرید PAYG", "Buy PAYG")}
        </button>
      </div>
    </div>
  );
}
