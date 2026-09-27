"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  AlertTriangle,
  Bitcoin,
  CreditCard,
  Gift,
  ImagePlus,
  Layers,
  RefreshCw,
  Send,
  Shield,
  Star,
  Wallet,
  Zap,
} from "lucide-react";
import { publicApi } from "@/lib/api";
import { formatQuotaLabel } from "@/lib/format";
import { BankCardVisual, resolvePaymentCards } from "@/modules/storefront/BankCardVisual";
import { CryptoWalletVisual } from "@/modules/storefront/CryptoWalletVisual";
import {
  isCryptoPayMethod,
  isReceiptPayMethod,
  isWalletPayMethod,
  storefrontPayOptions,
  type CheckoutPayMethod,
} from "@/modules/storefront/payment-methods";
import { useStorefrontLocale } from "@/modules/storefront/locale";
import type {
  CustomerBuyKind,
  CustomerBuyMenu,
  CustomerService,
  StorefrontCategory,
  StorefrontProduct,
  StorefrontStore,
} from "@/modules/storefront/types";
import { computeCheckoutPreview, type CouponPreview } from "@/modules/storefront/checkout-preview";
import { fetchApplicableCoupons, pickAutoCouponCode, type ApplicableCouponOffer } from "@/modules/storefront/checkout-coupons";
import { AddonPicker, CheckoutCouponBox, CheckoutLiveSummary } from "@/modules/storefront/checkout-ui";
import {
  PickRow,
  Sheet,
  SheetButton,
  SheetNotice,
  SheetStep,
  SheetStepper,
  sheetFocusRing,
  stripLeadingEmoji,
} from "@/modules/storefront/portal-sheet";

type FlowMode = "idle" | "buy" | "renew";
type PortalStepId = "kind" | "category" | "product" | "extras" | "payment";

export type BuyKindOption = { id: CustomerBuyKind; label: string; hint?: string };

function buildPortalSteps(
  mode: FlowMode,
  opts: { digital?: boolean; withKind?: boolean; skipCategory?: boolean },
): PortalStepId[] {
  if (mode === "renew") return ["product", "extras", "payment"];
  const steps: PortalStepId[] = opts.withKind ? ["kind"] : [];
  if (!opts.skipCategory) steps.push("category");
  steps.push("product");
  if (!opts.digital) steps.push("extras");
  steps.push("payment");
  return steps;
}

const KIND_ICONS: Record<CustomerBuyKind, typeof Shield> = {
  vpn: Shield,
  digital: Gift,
  payg: Zap,
};

/** Mirrors the bot buy hub: admin label when set, otherwise the bot's default button text. */
export function resolveBuyKindOptions(
  menu: CustomerBuyMenu | undefined,
  fallback: Record<CustomerBuyKind, boolean>,
  t: (fa: string, en: string) => string,
): BuyKindOption[] {
  const defaults: Record<CustomerBuyKind, { label: string; hint: string }> = {
    vpn: {
      label: t("🛡 خرید VPN", "🛡 Buy VPN"),
      hint: t("اشتراک با حجم و زمان مشخص", "Subscription with fixed traffic and days"),
    },
    digital: {
      label: t("🎁 کالای دیجیتال", "🎁 Digital goods"),
      hint: t("کد یا محصول تحویلی بدون کانفیگ", "Delivered codes and items, no config"),
    },
    payg: {
      label: t("⚡ پرداخت به‌ازای مصرف", "⚡ Pay as you go"),
      hint: t("پرداخت از کیف پول به‌اندازه مصرف", "Billed from your wallet as you use it"),
    },
  };
  return (["vpn", "digital", "payg"] as CustomerBuyKind[])
    .filter((id) => (menu ? menu[id]?.available : fallback[id]))
    .map((id) => ({
      id,
      label: String(menu?.[id]?.label || "").trim() || defaults[id].label,
      hint: defaults[id].hint,
    }));
}

const PAY_ICONS: Record<string, typeof Wallet> = {
  WALLET: Wallet,
  TELEGRAM_STARS: Star,
  TELEGRAM_WALLET: Send,
  CRYPTO: Bitcoin,
  CRYPTO_MANUAL: Bitcoin,
  MANUAL_BANK: CreditCard,
};

const inputCls =
  "w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-zinc-900 outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-zinc-400 focus:border-[color:var(--store-primary)] focus:ring-2 focus:ring-[color:var(--store-primary)]/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-50";

export function CheckoutSheet({
  open = true,
  mode: modeProp,
  step,
  setStep,
  categories,
  products,
  selectedProduct,
  setSelectedProduct,
  selectedAddonIds,
  setSelectedAddonIds,
  couponCode,
  setCouponCode,
  renewingService,
  configName,
  setConfigName,
  receiptText,
  setReceiptText,
  receiptPreview,
  onReceiptFile,
  onClose,
  submitting,
  error,
  onSubmit,
  payment,
  storeSlug,
  paymentMethod,
  setPaymentMethod,
  kindOptions = [],
  onPickPayg,
  hasTelegramUserId = false,
}: {
  open?: boolean;
  kindOptions?: BuyKindOption[];
  onPickPayg?: () => void;
  mode: FlowMode;
  step: number;
  setStep: Dispatch<SetStateAction<number>>;
  categories: StorefrontCategory[];
  products: StorefrontProduct[];
  selectedProduct: StorefrontProduct | null;
  setSelectedProduct: (p: StorefrontProduct | null) => void;
  selectedAddonIds: string[];
  setSelectedAddonIds: Dispatch<SetStateAction<string[]>>;
  couponCode: string;
  setCouponCode: (v: string) => void;
  renewingService: CustomerService | null;
  configName: string;
  setConfigName: (v: string) => void;
  receiptText: string;
  setReceiptText: (v: string) => void;
  receiptPreview: string;
  onReceiptFile: (file?: File | null) => void;
  onClose: () => void;
  submitting: boolean;
  error: any;
  onSubmit: () => void;
  /** @deprecated theme primary comes from --store-primary */
  primary?: string;
  payment: StorefrontStore["payment"] | null;
  storeSlug?: string;
  paymentMethod: CheckoutPayMethod;
  setPaymentMethod: (m: CheckoutPayMethod) => void;
  hasTelegramUserId?: boolean;
}) {
  const { t, formatToman, formatUsd, isFa } = useStorefrontLocale();

  // Keep the last real mode so the sheet body stays intact while it animates out.
  const lastMode = useRef<FlowMode>(modeProp === "idle" ? "buy" : modeProp);
  if (modeProp !== "idle") lastMode.current = modeProp;
  const mode = lastMode.current;
  const isOpen = open && modeProp !== "idle";

  const lockedCategoryId = mode === "renew" ? String(renewingService?.categoryId || "") : "";
  const [categoryId, setCategoryId] = useState(lockedCategoryId);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [couponOffers, setCouponOffers] = useState<ApplicableCouponOffer[]>([]);
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);

  const withKind = mode === "buy" && kindOptions.length > 1;
  const singleKind =
    mode === "buy" && kindOptions.length === 1 && kindOptions[0].id !== "payg" ? kindOptions[0].id : null;
  const [kind, setKind] = useState<CustomerBuyKind | null>(singleKind);

  useEffect(() => {
    if (!isOpen) return;
    setCategoryId(lockedCategoryId);
    setKind(singleKind);
    setCouponOffers([]);
    setCouponPreview(null);
    setCouponError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, lockedCategoryId]);

  const kindProducts = useMemo(
    () =>
      products.filter((p) => {
        const k: CustomerBuyKind = p.kind === "DIGITAL" ? "digital" : p.kind === "PAYG" ? "payg" : "vpn";
        if (k === "payg") return false;
        return mode !== "buy" || !kind || k === kind;
      }),
    [products, kind, mode],
  );

  const chipCategories = useMemo(() => {
    const ids = new Set(kindProducts.map((p) => p.categoryId).filter(Boolean));
    return [...categories]
      .filter((c) => ids.has(c.id))
      .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  }, [kindProducts, categories]);

  const skipCategory = mode === "buy" && chipCategories.length === 1;
  useEffect(() => {
    if (skipCategory && categoryId !== chipCategories[0].id) setCategoryId(chipCategories[0].id);
  }, [skipCategory, chipCategories, categoryId]);

  const catalog = useMemo(() => {
    const cat = categoryId || lockedCategoryId;
    return [...kindProducts]
      .filter((p) => !cat || p.categoryId === cat)
      .sort(
        (a, b) =>
          Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) || (a.name || "").localeCompare(b.name || ""),
      );
  }, [kindProducts, categoryId, lockedCategoryId]);

  const isDigitalFlow = selectedProduct?.kind === "DIGITAL" || kind === "digital";
  const steps = buildPortalSteps(mode, { digital: isDigitalFlow, withKind, skipCategory });
  const safeStep = Math.min(Math.max(0, step), Math.max(0, steps.length - 1));
  const current = steps[safeStep] || "product";

  const prevStepRef = useRef(safeStep);
  const direction: 1 | -1 = safeStep >= prevStepRef.current ? 1 : -1;
  useEffect(() => {
    prevStepRef.current = safeStep;
  }, [safeStep]);

  const paymentCards = resolvePaymentCards(payment);
  const paymentWallets = (payment?.wallets || []).filter(
    (w) => w.enabled !== false && String(w.address || "").trim(),
  );
  const payOptions = storefrontPayOptions(payment, { hasWalletSession: true, hasTelegramUserId });
  const preview = computeCheckoutPreview(selectedProduct, selectedAddonIds, couponPreview);
  const money = (value: number) => (preview.hasToman ? formatToman(value) : formatUsd(value));
  const productPrice = (p: StorefrontProduct) =>
    Number(p.priceToman || 0) > 0 ? formatToman(p.priceToman) : formatUsd(p.priceUsd);

  useEffect(() => {
    if (!isOpen || current !== "payment" || !selectedProduct?.id) return;
    let cancelled = false;
    const load = async () => {
      setCouponOffers([]);
      setCouponError("");
      try {
        const offers = await fetchApplicableCoupons({
          slug: storeSlug,
          productId: selectedProduct.id,
          isRenewal: mode === "renew",
          selectedAddonIds,
        });
        if (cancelled) return;
        setCouponOffers(offers);
        const nextCode = pickAutoCouponCode(offers, couponCode);
        if (nextCode) {
          await applyCoupon(nextCode);
        } else {
          setCouponPreview(null);
          setCouponCode("");
        }
      } catch {
        if (!cancelled) setCouponOffers([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, current, selectedProduct?.id, mode, selectedAddonIds, storeSlug]);

  const applyCoupon = async (codeOverride?: string) => {
    const code = String(codeOverride || couponCode || "").trim();
    if (!code) {
      setCouponPreview(null);
      setCouponCode("");
      return;
    }
    if (!selectedProduct?.id) {
      setCouponError(t("کد تخفیف را وارد کنید", "Enter a discount code"));
      return;
    }
    setCouponBusy(true);
    setCouponError("");
    try {
      const { data } = await publicApi.post("/store/customer/coupon/validate", {
        productId: selectedProduct.id,
        couponCode: code,
        isRenewal: mode === "renew",
        selectedAddonIds,
      });
      setCouponPreview({
        amount: Number(data.amount || 0),
        discountAmount: Number(data.discountAmount || 0),
        finalAmount: Number(data.finalAmount || 0),
        currency: String(data.currency || ""),
        code: data.code || code.toUpperCase(),
      });
      setCouponCode(data.code || code.toUpperCase());
    } catch (err: any) {
      setCouponPreview(null);
      setCouponError(
        err?.response?.data?.message ||
          err?.message ||
          t("کد تخفیف نامعتبر است", "Invalid discount code"),
      );
    } finally {
      setCouponBusy(false);
    }
  };

  const resetSelection = () => {
    setSelectedProduct(null);
    setSelectedAddonIds([]);
    setCouponCode("");
    setCouponPreview(null);
  };

  const advance = () => setStep((s) => Math.min(s + 1, steps.length - 1));

  const pickKind = (id: CustomerBuyKind) => {
    if (id === "payg") {
      onPickPayg?.();
      return;
    }
    if (id !== kind) {
      setCategoryId("");
      resetSelection();
    }
    setKind(id);
    setStep((s) => s + 1);
  };

  const pickProduct = (p: StorefrontProduct) => {
    if (selectedProduct?.id !== p.id) {
      setSelectedProduct(p);
      setSelectedAddonIds([]);
      setCouponCode("");
      setCouponPreview(null);
    }
    setStep((s) => s + 1);
  };

  const receiptMissing = isReceiptPayMethod(paymentMethod) && !receiptText.trim() && !receiptPreview;
  const configMissing = current === "extras" && mode === "buy" && !configName.trim();

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const stepLabels = steps.map((id) =>
    id === "kind"
      ? t("نوع", "Type")
      : id === "category"
        ? t("دسته", "Category")
        : id === "product"
          ? t("پلن", "Plan")
          : id === "extras"
            ? t("جزئیات", "Details")
            : t("پرداخت", "Payment"),
  );

  const kindLabel = kind ? kindOptions.find((k) => k.id === kind)?.label : null;
  const subtitle =
    mode === "renew"
      ? renewingService
        ? `${t("تمدید", "Renewing")}: ${renewingService.remark || renewingService.email}`
        : undefined
      : kindLabel
        ? stripLeadingEmoji(kindLabel)
        : t("انتخاب پلن و پرداخت", "Pick a plan and pay");

  const payLabel = (id: string) =>
    id === "WALLET"
      ? t("کیف پول", "Wallet")
      : id === "TELEGRAM_STARS"
        ? "Telegram Stars"
        : id === "TELEGRAM_WALLET"
          ? "Wallet Pay"
          : isCryptoPayMethod(id)
            ? t("کریپتو", "Crypto")
            : t("کارت به کارت", "Card transfer");
  const payHint = (id: string) =>
    id === "WALLET"
      ? t("کسر از موجودی", "From your balance")
      : id === "TELEGRAM_STARS"
        ? t("پرداخت در تلگرام", "Pay inside Telegram")
        : id === "TELEGRAM_WALLET"
          ? "USDT / TON"
          : t("واریز و ارسال رسید", "Transfer + receipt");

  const submitLabel =
    paymentMethod === "WALLET"
      ? `${t("پرداخت از کیف پول", "Pay from wallet")} · ${money(preview.finalAmount)}`
      : paymentMethod === "TELEGRAM_STARS"
        ? t("پرداخت با Telegram Stars", "Pay with Telegram Stars")
        : isWalletPayMethod(paymentMethod)
          ? t("پرداخت با Wallet Pay", "Pay with Wallet Pay")
          : t("ثبت سفارش و ارسال رسید", "Place order & send receipt");

  const footer =
    current === "extras" ? (
      <SheetButton onClick={advance} disabled={configMissing}>
        {t("ادامه به پرداخت", "Continue to payment")}
      </SheetButton>
    ) : current === "payment" ? (
      <SheetButton onClick={onSubmit} loading={submitting} disabled={receiptMissing || !selectedProduct}>
        {mode === "renew" ? <RefreshCw size={18} /> : null}
        {submitLabel}
      </SheetButton>
    ) : null;

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title={mode === "renew" ? t("تمدید سرویس", "Renew service") : t("سفارش جدید", "New order")}
      subtitle={subtitle}
      onBack={safeStep > 0 ? goBack : undefined}
      footer={footer}
    >
      {steps.length > 1 ? <SheetStepper step={safeStep} labels={stepLabels} /> : null}

      <SheetStep stepKey={`${current}-${kind || ""}`} direction={direction}>
        {current === "kind" ? (
          <div className="space-y-2.5">
            <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
              {t("چه چیزی می‌خواهید بخرید؟", "What would you like to buy?")}
            </p>
            {kindOptions.map((opt) => {
              const Icon = KIND_ICONS[opt.id];
              return (
                <PickRow
                  key={opt.id}
                  title={stripLeadingEmoji(opt.label)}
                  hint={opt.hint}
                  icon={<Icon size={18} />}
                  selected={kind === opt.id}
                  onClick={() => pickKind(opt.id)}
                />
              );
            })}
          </div>
        ) : null}

        {current === "category" ? (
          <div className="space-y-2.5">
            {!chipCategories.length ? (
              <p className="py-10 text-center text-sm text-zinc-500">
                {t("فعلاً محصولی برای خرید موجود نیست.", "Nothing is available right now.")}
              </p>
            ) : (
              chipCategories.map((c) => {
                const count = kindProducts.filter((p) => p.categoryId === c.id).length;
                return (
                  <PickRow
                    key={c.id}
                    title={stripLeadingEmoji(c.name)}
                    hint={c.description}
                    icon={<Layers size={18} />}
                    meta={`${count.toLocaleString(isFa ? "fa-IR" : "en-US")} ${t("پلن", "plans")}`}
                    selected={categoryId === c.id}
                    onClick={() => {
                      if (categoryId !== c.id) resetSelection();
                      setCategoryId(c.id);
                      advance();
                    }}
                  />
                );
              })
            )}
          </div>
        ) : null}

        {current === "product" ? (
          <div className="space-y-2.5">
            {mode === "renew" ? (
              <SheetNotice tone="success" icon={<RefreshCw size={15} />}>
                {t(
                  "حجم و زمان پلن انتخابی به سرویس فعلی اضافه می‌شود؛ مصرف قبلی و تنظیمات حفظ می‌شوند.",
                  "The plan's volume and days are added to this service. Usage and settings are kept.",
                )}
              </SheetNotice>
            ) : null}
            {catalog.map((p) => {
              const digital = p.kind === "DIGITAL";
              const spec = digital
                ? p.digitalDeliveryHint === "operator"
                  ? t("تحویل توسط اپراتور", "Delivered by operator")
                  : t("تحویل خودکار", "Automatic delivery")
                : formatQuotaLabel(p.traffic, p.durationDays, { locale: isFa ? "fa" : "en" });
              return (
                <PickRow
                  key={p.id}
                  title={p.name}
                  hint={[spec, p.description?.split("\n")[0]].filter(Boolean).join(" · ")}
                  icon={digital ? <Gift size={18} /> : <Shield size={18} />}
                  badge={
                    p.badge || p.featured ? (
                      <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-px text-[10px] font-bold text-amber-700 dark:text-amber-300">
                        {p.badge || t("ویژه", "Featured")}
                      </span>
                    ) : null
                  }
                  meta={<span className="text-[13px] font-bold text-[color:var(--store-primary)]">{productPrice(p)}</span>}
                  selected={selectedProduct?.id === p.id}
                  onClick={() => pickProduct(p)}
                />
              );
            })}
            {!catalog.length ? (
              <p className="rounded-2xl border border-dashed border-black/10 px-4 py-10 text-center text-sm text-zinc-500 dark:border-white/10">
                {mode === "renew"
                  ? t("پلنی برای تمدید در این دسته موجود نیست.", "No renewal plans available in this category.")
                  : t("محصولی در این دسته موجود نیست.", "No products in this category.")}
              </p>
            ) : null}
          </div>
        ) : null}

        {current === "extras" ? (
          <div className="space-y-4">
            {selectedProduct ? (
              <SelectedPlanCard
                name={selectedProduct.name}
                spec={formatQuotaLabel(selectedProduct.traffic, selectedProduct.durationDays, { locale: isFa ? "fa" : "en" })}
                price={productPrice(selectedProduct)}
                digital={false}
              />
            ) : null}
            {mode === "buy" ? (
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-zinc-900 dark:text-zinc-50">
                  {t("نام سرویس", "Service name")}
                </span>
                <input
                  className={inputCls}
                  style={{ fontSize: 16 }}
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  placeholder={t("مثلاً phone-1", "e.g. phone-1")}
                  autoComplete="off"
                  dir="ltr"
                />
                <span className="mt-1.5 block text-xs text-zinc-500 dark:text-zinc-400">
                  {t("این نام در لیست سرویس‌های شما نمایش داده می‌شود.", "Shown in your services list.")}
                </span>
              </label>
            ) : null}
            {selectedProduct?.productAddons?.length || selectedProduct?.ipLimitOptions?.length ? (
              <div className="space-y-2">
                <div>
                  <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{t("افزونه‌ها", "Add-ons")}</div>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {t("کاربر و زمان اضافه اختیاری است.", "Extra users and days are optional.")}
                  </p>
                </div>
                <AddonPicker
                  product={selectedProduct}
                  selectedAddonIds={selectedAddonIds}
                  onToggle={(id) => {
                    setSelectedAddonIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
                    setCouponCode("");
                    setCouponPreview(null);
                  }}
                />
              </div>
            ) : null}
            <CheckoutLiveSummary product={selectedProduct} selectedAddonIds={selectedAddonIds} />
          </div>
        ) : null}

        {current === "payment" ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[color:var(--store-primary)]/25 bg-[color:var(--store-primary)]/[0.06] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{t("مبلغ قابل پرداخت", "Amount due")}</div>
                  <div className="mt-1 text-[1.7rem] font-black leading-tight tracking-tight text-[color:var(--store-primary)]">
                    {money(preview.finalAmount)}
                  </div>
                  {preview.discountAmount > 0 ? (
                    <div className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      {t("تخفیف", "Discount")}
                      {preview.couponCode ? ` (${preview.couponCode})` : ""}: −{money(preview.discountAmount)}
                    </div>
                  ) : null}
                </div>
                {selectedProduct ? (
                  <div className="min-w-0 max-w-[48%] text-end">
                    <div className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">{selectedProduct.name}</div>
                    <div className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                      {selectedProduct.kind === "DIGITAL"
                        ? t("محصول دیجیتال", "Digital product")
                        : formatQuotaLabel(preview.traffic, preview.finalDays, { locale: isFa ? "fa" : "en" })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <CheckoutCouponBox
              code={couponCode}
              onCodeChange={(value) => {
                setCouponCode(value);
                if (!value) setCouponPreview(null);
              }}
              offers={couponOffers}
              onApply={(code) => void applyCoupon(code)}
              onClear={() => {
                setCouponPreview(null);
                setCouponError("");
              }}
              busy={couponBusy}
              error={couponError}
              formatMoney={money}
            />

            <div>
              <div className="mb-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">{t("روش پرداخت", "Payment method")}</div>
              <div role="radiogroup" aria-label={t("روش پرداخت", "Payment method")} className="grid grid-cols-2 gap-2">
                {payOptions.map((opt) => {
                  const Icon = PAY_ICONS[opt.id] || CreditCard;
                  const active = paymentMethod === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-pressed={active}
                      onClick={() => setPaymentMethod(opt.id)}
                      className={`store-card flex min-h-[60px] cursor-pointer items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-start transition-[border-color,box-shadow] duration-200 ${sheetFocusRing} ${
                        active ? "shadow-[0_8px_24px_-16px_var(--store-primary)]" : ""
                      } ${payOptions.length === 1 ? "col-span-2" : ""}`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 ${
                          active
                            ? "bg-[color:var(--store-primary)] text-white"
                            : "bg-[color:var(--store-primary)]/10 text-[color:var(--store-primary)]"
                        }`}
                      >
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-bold text-zinc-900 dark:text-zinc-50">{payLabel(opt.id)}</span>
                        <span className="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">{payHint(opt.id)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {paymentMethod === "WALLET" ? (
              <SheetNotice tone="success" icon={<Wallet size={15} />}>
                {t("مبلغ بلافاصله از موجودی کیف پول شما کسر می‌شود.", "The amount is deducted from your wallet balance right away.")}
              </SheetNotice>
            ) : null}
            {paymentMethod === "TELEGRAM_STARS" ? (
              <SheetNotice icon={<Star size={15} />}>
                {t(
                  "پس از ثبت، صفحه پرداخت Stars باز می‌شود. سرویس فقط بعد از تأیید پرداخت فعال می‌شود.",
                  "After submitting, the Stars invoice opens. The service is delivered only after payment is verified.",
                )}
              </SheetNotice>
            ) : null}
            {isWalletPayMethod(paymentMethod) ? (
              <SheetNotice icon={<Send size={15} />}>
                {t(
                  "پس از ثبت، Wallet Pay تلگرام باز می‌شود (USDT/TON). پس از تأیید پرداخت، سرویس خودکار فعال می‌شود.",
                  "After submitting, Telegram Wallet Pay opens (USDT/TON). The service activates automatically once paid.",
                )}
              </SheetNotice>
            ) : null}

            {isCryptoPayMethod(paymentMethod) ? (
              paymentWallets.length ? (
                <div className="space-y-3">
                  {paymentWallets.map((w) => {
                    const asset = String(w.asset || "USDT").toUpperCase();
                    const network = String(w.network || "").trim();
                    return (
                      <CryptoWalletVisual
                        key={w.id || w.address}
                        network={w.network}
                        asset={w.asset}
                        address={w.address}
                        instructions={w.instructions}
                        amountLabel={t("مبلغ", "Amount")}
                        amountValue={money(preview.finalAmount)}
                        walletLabel={
                          String(w.title || "").trim() ||
                          (network ? t(`پرداخت با ${asset} (${network})`, `Pay with ${asset} (${network})`) : t(`پرداخت با ${asset}`, `Pay with ${asset}`))
                        }
                        copyLabel={t("کپی آدرس", "Copy address")}
                        copiedLabel={t("کپی شد", "Copied")}
                      />
                    );
                  })}
                </div>
              ) : (
                <SheetNotice tone="warn" icon={<AlertTriangle size={15} />}>
                  {t("ولت کریپتو هنوز تنظیم نشده. با پشتیبانی تماس بگیرید.", "Crypto wallet is not configured yet. Please contact support.")}
                </SheetNotice>
              )
            ) : null}

            {paymentMethod === "MANUAL_BANK" ? (
              paymentCards.length ? (
                <div className="space-y-3">
                  {paymentCards.map((card) => (
                    <BankCardVisual
                      key={card.id}
                      bankName={card.bankName}
                      cardNumber={card.cardNumber}
                      cardHolder={card.cardHolder}
                      iban={card.iban}
                      instructions={card.instructions}
                      transferLabel={t("کارت به کارت", "Card to Card")}
                      copyLabel={t("کپی شماره کارت", "Copy card number")}
                      copiedLabel={t("کپی شد", "Copied")}
                    />
                  ))}
                </div>
              ) : (
                <SheetNotice tone="warn" icon={<AlertTriangle size={15} />}>
                  {t("اطلاعات کارت پرداخت هنوز تنظیم نشده. با پشتیبانی تماس بگیرید.", "Payment card is not configured yet. Please contact support.")}
                </SheetNotice>
              )
            ) : null}

            {isReceiptPayMethod(paymentMethod) ? (
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-zinc-900 dark:text-zinc-50">
                    {t("شماره پیگیری / یادداشت", "Reference / note")}
                  </span>
                  <textarea
                    rows={2}
                    className={`${inputCls} resize-none`}
                    style={{ fontSize: 16 }}
                    value={receiptText}
                    onChange={(e) => setReceiptText(e.target.value)}
                    placeholder={t("مثلاً ۴ رقم آخر کارت یا کد تراکنش", "e.g. last 4 digits or transaction hash")}
                  />
                </label>
                <label
                  className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors duration-200 ${
                    receiptPreview
                      ? "border-emerald-500/40 bg-emerald-500/[0.06]"
                      : "border-black/10 hover:border-[color:var(--store-primary)]/50 hover:bg-[color:var(--store-primary)]/[0.04] dark:border-white/10"
                  }`}
                >
                  {receiptPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={receiptPreview} alt={t("تصویر رسید", "Receipt image")} className="max-h-36 rounded-xl object-contain" />
                  ) : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--store-primary)]/10 text-[color:var(--store-primary)]">
                      <ImagePlus size={20} />
                    </span>
                  )}
                  <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                    {receiptPreview ? t("رسید پیوست شد — برای تغییر بزنید", "Receipt attached — tap to change") : t("آپلود تصویر رسید", "Upload receipt image")}
                  </span>
                  {!receiptPreview ? (
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {t("رسید یا یادداشت الزامی است", "A receipt or note is required")}
                    </span>
                  ) : null}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => onReceiptFile(e.target.files?.[0])}
                  />
                </label>
              </div>
            ) : null}

            {error ? (
              <SheetNotice tone="error" icon={<AlertTriangle size={15} />}>
                {String(error?.response?.data?.message || error?.message || t("ثبت سفارش ناموفق بود", "Order failed"))}
              </SheetNotice>
            ) : null}
          </div>
        ) : null}
      </SheetStep>
    </Sheet>
  );
}

function SelectedPlanCard({
  name,
  spec,
  price,
  digital,
}: {
  name: string;
  spec: string;
  price: string;
  digital: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white/60 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--store-primary)]/10 text-[color:var(--store-primary)]">
        {digital ? <Gift size={18} /> : <Shield size={18} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">{name}</div>
        <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">{spec}</div>
      </div>
      <span className="shrink-0 rounded-xl bg-[color:var(--store-primary)]/10 px-2.5 py-1 text-xs font-bold text-[color:var(--store-primary)]">
        {price}
      </span>
    </div>
  );
}
