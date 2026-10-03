"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bell,
  ClipboardList,
  Copy,
  Gift,
  Layers,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  LogOut,
  Package,
  Plus,
  Shield,
  ShoppingBag,
  XCircle,
  Zap,
} from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import { publicApi } from "@/lib/api";
import { useCustomerSession } from "@/modules/storefront/session";
import { buildSubscriptionLink, parseSubscriptionToken } from "@/modules/storefront/subscription";
import { compressReceiptImage } from "@/modules/storefront/receipt-image";
import type {
  CustomerCancelRequest,
  CustomerDashboard,
  CustomerOrder,
  CustomerService,
  CustomerWalletSettlement,
  StorefrontCategory,
  StorefrontProduct,
  StorefrontStore,
} from "@/modules/storefront/types";
import { StoreShell, ServiceListItem } from "@/modules/storefront/ui";
import { scrollToTop } from "@/modules/storefront/scroll";
import {
  MotionPage,
  SectionHeading,
  Surface,
  BottomTabBar,
  StatTile,
  EmptyState,
  staggerContainer,
  staggerItem,
} from "@/modules/storefront/design";
import { usePortalTelegramGate } from "@/modules/storefront/tma/usePortalTelegramGate";
import { formatServiceExpiry, isExpiringSoon } from "@/modules/storefront/tma/tma-service-utils";
import { StorefrontLocaleProvider, useStorefrontLocale } from "@/modules/storefront/locale";
import { CheckoutSheet, resolveBuyKindOptions } from "@/modules/storefront/PortalCheckoutSheet";
import type { CustomerBuyKind } from "@/modules/storefront/types";
import {
  PaygBuySheet,
  PaygHeroCard,
  PaygSubRow,
  PaygTopUpSheet,
  TelegramConnectPanel,
  usePaygCatalog,
  usePaygMoney,
  type CustomerPaygOverview,
  type PaygCatalog,
} from "@/modules/storefront/PortalPayg";
import { DigitalOrdersList } from "@/modules/storefront/PortalDigital";
import {
  CancelRefundSheet,
  CancelRequestsList,
  ConfirmSheet,
  type CancelTarget,
} from "@/modules/storefront/PortalServiceActions";
import { PickRow, Sheet, SheetButton, SheetNotice, stripLeadingEmoji } from "@/modules/storefront/portal-sheet";
import {
  detectTelegramUserId,
  isReceiptPayMethod,
  openCheckoutPayUrl,
  pickStorefrontPayMethod,
  type CheckoutPayMethod,
} from "@/modules/storefront/payment-methods";
import { rememberStoreSlug, portalPathForSlug, shopPathForSlug } from "@/modules/storefront/store-slug";

type FlowMode = "idle" | "buy" | "renew";
type DashTab = "home" | "services" | "digital" | "payg" | "orders" | "alerts";
type HomeSegment = "vpn" | "digital" | "payg";

function PortalTopBarLabel() {
  const { t } = useStorefrontLocale();
  return <>{t("پورتال مشتری", "Customer portal")}</>;
}

export default function CustomerDashboardPage() {
  return (
    <StorefrontLocaleProvider>
      <CustomerDashboardInner />
    </StorefrontLocaleProvider>
  );
}

function CustomerDashboardInner() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const gate = usePortalTelegramGate();
  const {
    data,
    isLoading,
    error,
    logout,
    markNotificationRead,
    markAllNotificationsRead,
    cancelOrder,
    claimService,
    assignServiceCategory,
    hideService,
    requestCancel,
    requestSettlement,
  } = useCustomerSession();
  const { t, isFa } = useStorefrontLocale();
  const reduceMotion = useReducedMotion();

  const [tab, setTab] = useState<DashTab>("home");
  const [flow, setFlow] = useState<FlowMode>("idle");
  const [selectedProduct, setSelectedProduct] = useState<StorefrontProduct | null>(null);
  const [renewingService, setRenewingService] = useState<CustomerService | null>(null);
  const [categoryPickService, setCategoryPickService] = useState<CustomerService | null>(null);
  const [categoryPickId, setCategoryPickId] = useState("");
  const [categoryPickError, setCategoryPickError] = useState("");
  const [categoryPickContinueRenew, setCategoryPickContinueRenew] = useState(false);
  const [configName, setConfigName] = useState("");
  const [receiptText, setReceiptText] = useState("");
  const [receiptImage, setReceiptImage] = useState("");
  const [receiptPreview, setReceiptPreview] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPayMethod>("MANUAL_BANK");
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [sheetStep, setSheetStep] = useState(0);
  const [copiedToken, setCopiedToken] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [segment, setSegment] = useState<HomeSegment>("vpn");
  const [buyLock, setBuyLock] = useState<CustomerBuyKind | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [paygBuyOpen, setPaygBuyOpen] = useState(false);
  const [paygTopUpOpen, setPaygTopUpOpen] = useState(false);
  const [paygTopUpAmount, setPaygTopUpAmount] = useState<number | undefined>(undefined);
  const [paygJustActivated, setPaygJustActivated] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [hideTarget, setHideTarget] = useState<CustomerService | null>(null);
  const [orderCancelTarget, setOrderCancelTarget] = useState<CustomerOrder | null>(null);

  const unreadCount = useMemo(
    () => (data?.notifications ?? []).filter((item) => !item.isRead).length,
    [data?.notifications],
  );

  const paygQuery = useQuery({
    queryKey: ["customer-payg", data?.profile?.id],
    enabled: !!data?.profile?.id,
    queryFn: async () =>
      (await publicApi.get("/store/customer/payg")).data as CustomerPaygOverview,
    refetchInterval: 60_000,
  });
  const payg = paygQuery.data;
  const paygCatalogQuery = usePaygCatalog(!!data?.profile?.id);
  const paygPlansAvailable = payg?.enabled !== false && (paygCatalogQuery.data?.plans?.length ?? 0) > 0;
  const showPaygSegment = !!(
    payg?.hasActive ||
    (payg?.subscriptions?.length ?? 0) > 0 ||
    paygPlansAvailable ||
    data?.store?.buyMenu?.payg?.available
  );
  const telegramLinked = gate.inTelegram || !!data?.profile?.telegramUserId;

  const cancelRefundEnabled = !!data?.store?.cancelRefundEnabled;
  const walletSettlementEnabled = !!data?.store?.walletSettlementEnabled;

  const cancelRequestsQuery = useQuery({
    queryKey: ["customer-cancel-requests", data?.profile?.id],
    enabled: !!data?.profile?.id && cancelRefundEnabled,
    queryFn: async () =>
      (await publicApi.get("/store/customer/cancel-requests")).data as CustomerCancelRequest[],
  });
  const pendingCancelClientIds = useMemo(() => {
    const set = new Set<string>();
    for (const row of cancelRequestsQuery.data || []) {
      if (row.status !== "PENDING") continue;
      if (row.clientId) set.add(row.clientId);
      if (row.paygSubscriptionId) set.add(row.paygSubscriptionId);
    }
    return set;
  }, [cancelRequestsQuery.data]);

  const resolveCancelTitle = (row: CustomerCancelRequest) => {
    if (row.targetType === "payg_sub") {
      const sub = payg?.subscriptions?.find((s) => s.id === row.paygSubscriptionId);
      return sub?.planName || sub?.clientEmail || "PAYG";
    }
    const svc = (data?.services || []).find((s) => s.id === row.clientId);
    return svc?.remark || svc?.productName || svc?.email || t("سرویس", "Service");
  };

  const walletQuery = useQuery({
    queryKey: ["customer-wallet", data?.profile?.id],
    enabled: !!data?.profile?.id && walletSettlementEnabled,
    queryFn: async () =>
      (await publicApi.get("/store/customer/wallet")).data as {
        balance: number;
        currency: string;
      },
  });
  const settlementsQuery = useQuery({
    queryKey: ["customer-wallet-settlements", data?.profile?.id],
    enabled: !!data?.profile?.id && walletSettlementEnabled,
    queryFn: async () =>
      (await publicApi.get("/store/customer/wallet/settlements")).data as CustomerWalletSettlement[],
  });

  const tgUserId = data?.profile?.telegramUserId || detectTelegramUserId() || undefined;

  useEffect(() => {
    const payment = data?.store?.payment;
    if (!payment) return;
    setPaymentMethod((current) =>
      pickStorefrontPayMethod(payment, { hasWalletSession: true, hasTelegramUserId: !!tgUserId }, current),
    );
  }, [data?.store?.payment, tgUserId]);

  const renewMutation = useMutation({
    mutationFn: async () => {
      if (!renewingService || !selectedProduct) return null;
      return (
        await publicApi.post("/store/customer/renew", {
          clientId: renewingService.id,
          productId: selectedProduct.id,
          receiptText: isReceiptPayMethod(paymentMethod) ? receiptText || undefined : undefined,
          receiptImage: isReceiptPayMethod(paymentMethod) ? receiptImage || undefined : undefined,
          selectedAddonIds,
          couponCode: couponCode || undefined,
          paymentMethod,
          telegramUserId: tgUserId,
          telegramChatId: tgUserId,
        })
      ).data;
    },
    onSuccess: async (response) => {
      if (response?.invoiceUrl) openCheckoutPayUrl(response.invoiceUrl, response.paymentMethod);
      if (response?.trackingCode) {
        router.push(`/track/${encodeURIComponent(response.trackingCode)}`);
      }
      resetFlow();
      setTab("orders");
      await queryClient.invalidateQueries({ queryKey: ["customer-session"] });
    },
  });

  const orderMutation = useMutation({
    mutationFn: async () => {
      const isDigital = selectedProduct?.kind === "DIGITAL";
      const name = selectedProduct?.isTest
        ? t("سرویس تست", "Test service")
        : configName.trim() || (isDigital ? String(selectedProduct?.name || "digital") : "");
      if (!selectedProduct || !name) return null;
      return (
        await publicApi.post("/store/customer/order", {
          productId: selectedProduct.id,
          configName: name,
          receiptText: isReceiptPayMethod(paymentMethod) ? receiptText || undefined : undefined,
          receiptImage: isReceiptPayMethod(paymentMethod) ? receiptImage || undefined : undefined,
          selectedAddonIds,
          couponCode: couponCode || undefined,
          paymentMethod,
          telegramUserId: tgUserId,
          telegramChatId: tgUserId,
        })
      ).data;
    },
    onSuccess: async (response) => {
      if (response?.invoiceUrl) openCheckoutPayUrl(response.invoiceUrl, response.paymentMethod);
      if (response?.trackingCode) {
        router.push(`/track/${encodeURIComponent(response.trackingCode)}`);
      }
      resetFlow();
      setTab("orders");
      await queryClient.invalidateQueries({ queryKey: ["customer-session"] });
    },
  });

  useEffect(() => {
    if (gate.isBusy) return;
    if (gate.phase === "error") return;
    if (!isLoading && (error || !data) && gate.phase === "skip") {
      router.replace(portalPathForSlug(gate.slug, "login"));
    }
  }, [data, error, isLoading, router, gate.isBusy, gate.phase]);

  useEffect(() => {
    scrollToTop();
  }, [tab, sheetStep, flow]);

  const resetFlow = () => {
    setFlow("idle");
    setSelectedProduct(null);
    setRenewingService(null);
    setConfigName("");
    setReceiptText("");
    setReceiptImage("");
    setReceiptPreview("");
    setPaymentMethod("MANUAL_BANK");
    setSelectedAddonIds([]);
    setCouponCode("");
    setSheetStep(0);
    setBuyLock(null);
  };

  const onReceiptFile = async (file?: File | null) => {
    if (!file) return;
    try {
      const value = await compressReceiptImage(file);
      setReceiptImage(value);
      setReceiptPreview(value);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (data?.store?.slug) rememberStoreSlug(data.store.slug);
  }, [data?.store?.slug]);

  const goShop = () => {
    router.replace(shopPathForSlug(data?.store?.slug || gate.slug));
  };

  if (gate.isBusy) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-950">
        <LoaderCircle className="animate-spin text-zinc-400" />
        <p className="text-sm text-zinc-500">ورود با تلگرام…</p>
      </div>
    );
  }

  if (gate.phase === "error") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-zinc-600">{gate.error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <LoaderCircle className="animate-spin text-zinc-400" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {t("ورود به فروشگاه انجام نشد. از دکمه مینی‌اپ ربات دوباره باز کنید.", "Could not open this store. Open it again from the bot Mini App button.")}
        </p>
      </div>
    );
  }

  const primary = data.branding?.primaryColor || "#2563eb";
  const products = data.products || [];
  const categories = data.categories || [];
  const renewProductsForService = (service: CustomerService | null) => {
    if (!service?.categoryId) return [] as StorefrontProduct[];
    const serviceIsEylan =
      service.providerId === "eylan" ||
      service.deliveryHint === "eylan_download" ||
      String(service.id || "").startsWith("eylan:");
    return products.filter((p) => {
      if (p.categoryId !== service.categoryId || p.renewable === false) return false;
      const productIsEylan = p.providerId === "eylan";
      return serviceIsEylan ? productIsEylan : !productIsEylan;
    });
  };
  const renewProducts = renewProductsForService(renewingService);
  const activeCount = (data.activeServices || []).length || (data.services || []).filter((s) => s.status === "active" || s.status === "pending").length;
  const pendingCount = (data.pendingOrders || []).length;

  const startRenew = (service: CustomerService) => {
    if (!service.categoryId) {
      setCategoryPickService(service);
      setCategoryPickId(categories[0]?.id || "");
      setCategoryPickError("");
      setCategoryPickContinueRenew(true);
      return;
    }
    setRenewingService(service);
    const catalog = renewProductsForService(service);
    setSelectedProduct(catalog[0] || null);
    setFlow("renew");
    setSheetStep(0);
  };

  const submitCategoryPick = async () => {
    if (!categoryPickService || !categoryPickId) {
      setCategoryPickError(t("دسته‌بندی را انتخاب کنید", "Please select a category"));
      return;
    }
    setCategoryPickError("");
    try {
      const dashboard = await assignServiceCategory.mutateAsync({
        clientId: categoryPickService.id,
        categoryId: categoryPickId,
      });
      const updated =
        dashboard?.services?.find((s) => s.id === categoryPickService.id) || {
          ...categoryPickService,
          categoryId: categoryPickId,
        };
      setCategoryPickService(null);
      if (categoryPickContinueRenew) {
        setRenewingService(updated);
        const serviceIsEylan =
          updated.providerId === "eylan" ||
          updated.deliveryHint === "eylan_download" ||
          String(updated.id || "").startsWith("eylan:");
        const catalog = (dashboard?.products || products).filter((p) => {
          if (p.categoryId !== categoryPickId || p.renewable === false) return false;
          const productIsEylan = p.providerId === "eylan";
          return serviceIsEylan ? productIsEylan : !productIsEylan;
        });
        setSelectedProduct(catalog[0] || null);
        setFlow("renew");
        setSheetStep(0);
      }
    } catch (err: any) {
      setCategoryPickError(
        err?.response?.data?.message ||
          err?.message ||
          t("ذخیره دسته‌بندی ناموفق بود", "Could not save category"),
      );
    }
  };

  const digitalOrders = (data.orders || []).filter((o) => o.kind === "DIGITAL");
  const hasKind = (kind: "VPN" | "DIGITAL") =>
    products.some((p) => (kind === "DIGITAL" ? p.kind === "DIGITAL" : !p.kind || p.kind === "VPN"));
  const kindOptions = resolveBuyKindOptions(
    data.store?.buyMenu,
    { vpn: hasKind("VPN"), digital: hasKind("DIGITAL"), payg: paygPlansAvailable },
    t,
  );

  const segments: SegmentItem[] = [
    { id: "vpn", label: t("وی‌پی‌ان", "VPN"), icon: Shield, count: (data.services || []).length },
    ...(digitalOrders.length || data.store?.buyMenu?.digital?.available
      ? [{ id: "digital" as const, label: t("دیجیتال", "Digital"), icon: Gift, count: digitalOrders.length }]
      : []),
    ...(showPaygSegment
      ? [
          {
            id: "payg" as const,
            label: t("پرداخت به‌ازای مصرف", "Pay as you go"),
            shortLabel: t("مصرفی", "PAYG"),
            icon: Zap,
            count: payg?.subscriptions?.length ?? 0,
          },
        ]
      : []),
  ];
  const activeSegment: HomeSegment = segments.some((s) => s.id === segment) ? segment : "vpn";
  const showDigitalNav = segments.some((s) => s.id === "digital");
  const mini = gate.inTelegram;
  let viewTab: DashTab = tab;
  if (mini && tab === "alerts") viewTab = "home";
  if (mini && tab === "digital" && !showDigitalNav) viewTab = "home";
  if (mini && tab === "payg" && !showPaygSegment) viewTab = "home";

  const openPaygBuy = () => {
    resetFlow();
    if (mini) setTab("payg");
    else {
      setTab("home");
      setSegment("payg");
    }
    setPaygJustActivated(false);
    setPaygBuyOpen(true);
  };

  const startBuy = (lock?: CustomerBuyKind) => {
    if (lock === "payg" || (!lock && kindOptions.length === 1 && kindOptions[0]?.id === "payg")) {
      openPaygBuy();
      return;
    }
    setBuyLock(lock ?? null);
    setFlow("buy");
    setSheetStep(0);
    setSelectedProduct(null);
    setSelectedAddonIds([]);
    setCouponCode("");
  };

  const bottomTabs = mini
    ? [
        { id: "home", label: t("داشبورد", "Dashboard"), icon: LayoutDashboard },
        { id: "services", label: t("سرویس‌های من", "My services"), icon: Package },
        ...(showDigitalNav
          ? [{ id: "digital", label: t("دیجیتال", "Digital"), icon: Gift }]
          : []),
        ...(showPaygSegment
          ? [{ id: "payg", label: t("مصرفی", "PAYG"), icon: Zap }]
          : []),
        { id: "orders", label: t("سفارشات", "Orders"), icon: ClipboardList },
      ]
    : [
        { id: "home", label: t("خانه", "Home"), icon: Package },
        { id: "orders", label: t("سفارش", "Orders"), icon: ShoppingBag },
        {
          id: "alerts",
          label: t("اعلان", "Alerts"),
          icon: Bell,
          badge: unreadCount || undefined,
        },
      ];

  const configuredBuyLabel = (kind: "vpn" | "digital" | "payg") =>
    String(data.store?.buyMenu?.[kind]?.label || "").trim();
  const buyLabel =
    viewTab === "digital"
      ? configuredBuyLabel("digital") || t("خرید محصول دیجیتال", "Buy digital")
      : viewTab === "payg"
        ? configuredBuyLabel("payg") || t("خرید مصرفی", "Buy PAYG")
        : configuredBuyLabel("vpn") || t("خرید سرویس", "Buy service");

  const renewSoon = mini
    ? (data.services || [])
        .filter((service) => service.status === "expired" || isExpiringSoon(service, 7))
        .slice(0, 2)
    : [];

  return (
    <StoreShell
      mini={mini}
      store={{
        title: data.store?.title || "Customer Dashboard",
        slug: data.store?.slug || "",
        description: data.store?.description,
        logoUrl: data.store?.logoUrl || data.branding?.logo || null,
        logoDarkUrl: data.store?.logoDarkUrl || data.branding?.logoDark || null,
        branding: data.branding,
        publishedTheme: data.publishedTheme || data.store?.publishedTheme,
      }}
      topBar={mini ? undefined : <PortalTopBarLabel />}
      actions={
        <>
          {mini ? (
            <button
              type="button"
              onClick={() => setAlertsOpen(true)}
              className="store-card store-focus-ring relative inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border text-[color:var(--store-muted)] transition-colors duration-200 hover:text-[color:var(--store-fg)]"
              aria-label={t("اعلان‌ها", "Alerts")}
            >
              <Bell size={18} aria-hidden />
              {unreadCount > 0 ? (
                <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => logout.mutateAsync().then(goShop)}
            className="store-card store-focus-ring inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border text-[color:var(--store-muted)] transition-colors duration-200 hover:text-rose-500 active:scale-95"
            aria-label={t("خروج", "Log out")}
            title={t("خروج", "Log out")}
          >
            <LogOut size={18} aria-hidden />
          </button>
        </>
      }
    >
      <MotionPage className={`mx-auto w-full max-w-3xl ${isFa ? "font-[Vazirmatn,Tahoma,sans-serif]" : ""}`}>
        {viewTab === "home" && !mini ? (
          <section className="mb-5 sm:mb-7">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[color:var(--store-muted)]">
                {t("سلام", "Hello")}
              </p>
              <h1 className="mt-0.5 truncate text-[1.6rem] font-black tracking-tight text-[color:var(--store-fg)] sm:text-[2rem]">
                {data.profile?.name || t("مشتری عزیز", "Customer")}
              </h1>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
              <StatTile label={t("سرویس فعال", "Active services")} value={activeCount} tone="success" />
              <StatTile label={t("سفارش در صف", "Orders in queue")} value={pendingCount} tone="warn" />
              <button
                type="button"
                onClick={() => startBuy()}
                className="col-span-2 flex min-h-[72px] cursor-pointer items-center justify-center gap-2 rounded-[1.35rem] bg-[color:var(--store-primary)] px-4 text-[15px] font-bold text-white shadow-[0_14px_32px_-16px_var(--store-primary)] transition active:scale-[0.98] sm:col-span-2"
              >
                <Plus size={18} /> {t("سفارش جدید", "New order")}
              </button>
            </div>
          </section>
        ) : null}

        {mini && viewTab === "home" ? (
          <section className="mb-4">
            <p className="text-[13px] font-medium text-[color:var(--store-muted)]">{t("سلام", "Hello")}</p>
            <h1 className="mt-0.5 truncate text-[1.35rem] font-bold tracking-tight">
              {data.profile?.name || t("مشتری عزیز", "Customer")}
            </h1>
            <p className="mt-1 text-[13px] text-[color:var(--store-muted)]">
              {t(`${activeCount} سرویس فعال`, `${activeCount} active services`)}
            </p>
          </section>
        ) : null}

        {mini ? (
          <button
            type="button"
            onClick={() =>
              startBuy(
                viewTab === "digital"
                  ? "digital"
                  : viewTab === "payg"
                    ? "payg"
                    : kindOptions.some((k) => k.id === "vpn")
                      ? "vpn"
                      : undefined,
              )
            }
            className="store-focus-ring mb-4 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[color:var(--store-primary)] px-4 text-[15px] font-bold text-white shadow-[0_12px_28px_-16px_var(--store-primary)] transition duration-200 active:scale-[0.98]"
          >
            <Plus size={18} aria-hidden />
            {buyLabel}
          </button>
        ) : null}

        {mini && viewTab === "home" && renewSoon.length ? (
          <div className="mb-4 space-y-2">
            {renewSoon.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => startRenew(service)}
                className="store-card store-focus-ring flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-2xl border px-3 text-start transition duration-200 active:scale-[0.99]"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {service.remark || service.productName || service.email}
                </span>
                <span className="shrink-0 text-xs text-[color:var(--store-muted)]">
                  {service.status === "expired"
                    ? t("منقضی", "Expired")
                    : formatServiceExpiry(service, t)}
                </span>
                <span className="shrink-0 text-xs font-bold text-[color:var(--store-primary)]">
                  {t("تمدید", "Renew")}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <div className={`store-card mb-5 hidden gap-1 rounded-[1.35rem] border p-1.5 shadow-sm lg:mb-7 lg:flex lg:max-w-md ${mini ? "!hidden" : ""}`}>
          {bottomTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as DashTab)}
              aria-current={viewTab === item.id ? "page" : undefined}
              className={`store-focus-ring flex-1 cursor-pointer rounded-[1.1rem] px-3 py-2.5 text-[13px] font-semibold transition-colors duration-200 ${
                viewTab === item.id
                  ? "bg-[color:var(--store-primary)] text-white"
                  : "text-[color:var(--store-muted)] hover:text-[color:var(--store-fg)]"
              }`}
            >
              {item.label}
              {"badge" in item && item.badge ? ` (${item.badge})` : ""}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={viewTab}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
          >
            {viewTab === "home" && !mini ? (
              <HomeTab
                segments={segments}
                segment={activeSegment}
                onSegmentChange={setSegment}
                digitalOrders={digitalOrders}
                paygContent={
                  <PaygTab
                    payg={payg}
                    loading={paygQuery.isLoading}
                    catalog={paygCatalogQuery.data}
                    cancelRefundEnabled={cancelRefundEnabled}
                    pendingCancelClientIds={pendingCancelClientIds}
                    requestCancel={requestCancel}
                    telegramLinked={telegramLinked}
                    justActivated={paygJustActivated}
                    onBuy={openPaygBuy}
                    onTopUp={() => {
                      setPaygTopUpAmount(undefined);
                      setPaygTopUpOpen(true);
                    }}
                    onAskCancel={setCancelTarget}
                  />
                }
                data={data}
                showToken={showToken}
                setShowToken={setShowToken}
                copiedToken={copiedToken}
                setCopiedToken={setCopiedToken}
                claimService={claimService}
                hideService={hideService}
                categories={categories}
                onRenew={startRenew}
                cancelRefundEnabled={cancelRefundEnabled}
                pendingCancelClientIds={pendingCancelClientIds}
                requestCancel={requestCancel}
                walletSettlementEnabled={walletSettlementEnabled}
                wallet={walletQuery.data}
                walletLoading={walletQuery.isLoading}
                settlements={settlementsQuery.data}
                requestSettlement={requestSettlement}
                onAskCancel={setCancelTarget}
                onAskHide={setHideTarget}
              />
            ) : null}
            {mini && (viewTab === "services" || viewTab === "digital" || viewTab === "payg") ? (
              <HomeTab
                compact
                focus={viewTab}
                segments={segments}
                segment={activeSegment}
                onSegmentChange={setSegment}
                digitalOrders={digitalOrders}
                paygContent={
                  <PaygTab
                    payg={payg}
                    loading={paygQuery.isLoading}
                    catalog={paygCatalogQuery.data}
                    cancelRefundEnabled={cancelRefundEnabled}
                    pendingCancelClientIds={pendingCancelClientIds}
                    requestCancel={requestCancel}
                    telegramLinked={telegramLinked}
                    justActivated={paygJustActivated}
                    onBuy={openPaygBuy}
                    onTopUp={() => {
                      setPaygTopUpAmount(undefined);
                      setPaygTopUpOpen(true);
                    }}
                    onAskCancel={setCancelTarget}
                  />
                }
                data={data}
                showToken={false}
                setShowToken={setShowToken}
                copiedToken={copiedToken}
                setCopiedToken={setCopiedToken}
                claimService={claimService}
                hideService={hideService}
                categories={categories}
                onRenew={startRenew}
                cancelRefundEnabled={cancelRefundEnabled}
                pendingCancelClientIds={pendingCancelClientIds}
                requestCancel={requestCancel}
                walletSettlementEnabled={false}
                wallet={walletQuery.data}
                walletLoading={walletQuery.isLoading}
                settlements={settlementsQuery.data}
                requestSettlement={requestSettlement}
                onAskCancel={setCancelTarget}
                onAskHide={setHideTarget}
              />
            ) : null}
            {viewTab === "orders" ? (
              <OrdersTab
                data={data}
                onAskCancelOrder={setOrderCancelTarget}
                onBuy={() => startBuy()}
                cancelRequests={cancelRequestsQuery.data || []}
                resolveCancelTitle={resolveCancelTitle}
                compact={mini}
              />
            ) : null}
            {viewTab === "alerts" ? (
              <AlertsTab
                data={data}
                markNotificationRead={markNotificationRead}
                markAllNotificationsRead={markAllNotificationsRead}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </MotionPage>

      <BottomTabBar
        tabs={bottomTabs}
        value={viewTab}
        onChange={(id) => setTab(id as DashTab)}
        iconsOnly={mini}
        always={mini}
      />

      {mini ? (
        <Sheet
          open={alertsOpen}
          onClose={() => setAlertsOpen(false)}
          title={t("اعلان‌ها", "Alerts")}
        >
          <AlertsTab
            embedded
            data={data}
            markNotificationRead={markNotificationRead}
            markAllNotificationsRead={markAllNotificationsRead}
          />
        </Sheet>
      ) : null}

      <CheckoutSheet
          open={flow !== "idle"}
          mode={flow}
          step={sheetStep}
          setStep={setSheetStep}
          categories={categories}
          products={flow === "renew" ? renewProducts : products}
          selectedProduct={selectedProduct}
          setSelectedProduct={setSelectedProduct}
          selectedAddonIds={selectedAddonIds}
          setSelectedAddonIds={setSelectedAddonIds}
          couponCode={couponCode}
          setCouponCode={setCouponCode}
          renewingService={renewingService}
          configName={configName}
          setConfigName={setConfigName}
          receiptText={receiptText}
          setReceiptText={setReceiptText}
          receiptPreview={receiptPreview}
          onReceiptFile={onReceiptFile}
          onClose={resetFlow}
          submitting={orderMutation.isPending || renewMutation.isPending}
          error={(orderMutation.error || renewMutation.error) as any}
          onSubmit={() => {
            if (flow === "buy") orderMutation.mutate();
            else renewMutation.mutate();
          }}
          primary={primary}
          payment={data?.store?.payment || null}
          storeSlug={data?.store?.slug}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          hasTelegramUserId={!!tgUserId}
          kindOptions={
            flow === "buy"
              ? buyLock
                ? kindOptions.filter((k) => k.id === buyLock)
                : kindOptions
              : []
          }
          onPickPayg={openPaygBuy}
        />

      <PaygBuySheet
        open={paygBuyOpen}
        onClose={() => setPaygBuyOpen(false)}
        catalog={paygCatalogQuery.data}
        telegramLinked={telegramLinked}
        onActivated={() => {
          setPaygBuyOpen(false);
          setPaygJustActivated(true);
        }}
        onTopUp={(amount) => {
          setPaygBuyOpen(false);
          setPaygTopUpAmount(amount);
          setPaygTopUpOpen(true);
        }}
      />
      <PaygTopUpSheet
        open={paygTopUpOpen}
        onClose={() => setPaygTopUpOpen(false)}
        payment={data.store?.payment}
        suggestedAmount={paygTopUpAmount}
      />

      <CancelRefundSheet target={cancelTarget} onClose={() => setCancelTarget(null)} requestCancel={requestCancel} />
      <ConfirmSheet
        open={!!hideTarget}
        onClose={() => setHideTarget(null)}
        title={t("حذف از لیست سرویس‌ها", "Remove from your list")}
        description={t(
          "این سرویس فقط از لیست شما پنهان می‌شود و خود سرویس حذف یا غیرفعال نمی‌شود. برای لغو و بازگشت وجه از دکمه «لغو و بازگشت وجه» استفاده کنید.",
          "The service is only hidden from your list — it is not deleted or disabled. To cancel and get a refund, use “Cancel & refund”.",
        )}
        confirmLabel={t("حذف از لیست", "Remove")}
        loading={hideService.isPending}
        onConfirm={() => {
          if (!hideTarget) return;
          hideService.mutate(hideTarget.id, { onSettled: () => setHideTarget(null) });
        }}
      />
      <ConfirmSheet
        open={!!orderCancelTarget}
        onClose={() => setOrderCancelTarget(null)}
        title={t("لغو سفارش", "Cancel order")}
        description={t(
          `سفارش «${orderCancelTarget?.productName || ""}» لغو شود؟ اگر مبلغی واریز کرده‌اید، برای پیگیری عودت با پشتیبانی در تماس باشید.`,
          `Cancel the order “${orderCancelTarget?.productName || ""}”? If you already paid, contact support about the refund.`,
        )}
        confirmLabel={t("لغو سفارش", "Cancel order")}
        loading={cancelOrder.isPending}
        onConfirm={() => {
          if (!orderCancelTarget) return;
          cancelOrder.mutate(orderCancelTarget.id, { onSettled: () => setOrderCancelTarget(null) });
        }}
      />

      <Sheet
        open={!!categoryPickService}
        onClose={() => setCategoryPickService(null)}
        title={t("دسته‌بندی سرویس را مشخص کنید", "Choose the service category")}
        subtitle={t(
          "برای تمدید باید بدانیم این سرویس از کدام دسته بوده است.",
          "Renewal needs to know which category this service belongs to.",
        )}
        footer={
          <SheetButton
            loading={assignServiceCategory.isPending}
            disabled={!categoryPickId}
            onClick={() => void submitCategoryPick()}
          >
            {t("ذخیره و ادامه", "Save & continue")}
          </SheetButton>
        }
      >
        {!categories.length ? (
          <SheetNotice tone="warn">{t("دسته‌بندی‌ای موجود نیست", "No categories available")}</SheetNotice>
        ) : (
          <div role="radiogroup" className="space-y-2">
            {categories.map((c) => (
              <PickRow
                key={c.id}
                title={stripLeadingEmoji(c.name)}
                hint={c.description || undefined}
                icon={<Layers size={18} aria-hidden />}
                selected={categoryPickId === c.id}
                onClick={() => {
                  setCategoryPickId(c.id);
                  setCategoryPickError("");
                }}
              />
            ))}
          </div>
        )}
        {categoryPickError ? (
          <div className="mt-3">
            <SheetNotice tone="error">{categoryPickError}</SheetNotice>
          </div>
        ) : null}
      </Sheet>
    </StoreShell>
  );
}

function PaygTab({
  payg,
  loading,
  catalog,
  cancelRefundEnabled,
  pendingCancelClientIds,
  requestCancel,
  telegramLinked,
  justActivated,
  onBuy,
  onTopUp,
  onAskCancel,
}: {
  onAskCancel?: (target: CancelTarget) => void;
  payg?: CustomerPaygOverview;
  loading: boolean;
  catalog?: PaygCatalog;
  cancelRefundEnabled?: boolean;
  pendingCancelClientIds?: Set<string>;
  requestCancel?: ReturnType<typeof useCustomerSession>["requestCancel"];
  telegramLinked: boolean;
  justActivated: boolean;
  onBuy: () => void;
  onTopUp: () => void;
}) {
  const { t } = useStorefrontLocale();

  if (loading && !payg) {
    return (
      <div className="space-y-3">
        <div className="h-44 animate-pulse rounded-[1.75rem] bg-zinc-100 dark:bg-zinc-800/70" />
        <div className="h-16 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800/70" />
        <div className="h-16 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800/70" />
      </div>
    );
  }

  const subs = payg?.subscriptions || [];
  const canBuy = (catalog?.plans?.length ?? 0) > 0;
  const minBalance = Number(catalog?.minWalletBalanceLowest ?? catalog?.minWalletBalance ?? payg?.minWalletBalance ?? 0);

  return (
    <div className="space-y-5">
      {!telegramLinked ? <TelegramConnectPanel /> : null}

      <PaygHeroCard payg={payg} canBuy={canBuy} onBuy={onBuy} onTopUp={onTopUp} />

      {canBuy && minBalance > 0 ? (
        <p className="-mt-2 text-center text-xs text-zinc-500">
          {t("حداقل موجودی برای فعال‌سازی سرویس جدید", "Minimum balance to activate a new service")}:{" "}
          <PaygMinBalance amount={minBalance} />
        </p>
      ) : null}

      {justActivated ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
          <Zap size={16} />
          {t("سرویس فعال شد. لینک اشتراک در کارت زیر است.", "Service activated. Your subscription link is below.")}
        </div>
      ) : null}

      <section>
        <SectionHeading
          title={t("سرویس‌های PAYG", "PAYG services")}
          subtitle={
            subs.length
              ? t("برای جزئیات، لینک و مصرف روی هر سرویس بزنید.", "Tap a service for link, usage and actions.")
              : undefined
          }
        />
        {!subs.length ? (
          <EmptyState
            title={t("سرویس PAYG فعالی ندارید", "No PAYG services yet")}
            hint={
              canBuy
                ? t("یک پلن انتخاب کنید و فقط به‌اندازه مصرف پرداخت کنید.", "Pick a plan and pay only for what you use.")
                : t("فعلاً پلنی برای خرید موجود نیست.", "No plans are available right now.")
            }
            action={
              canBuy ? (
                <button
                  type="button"
                  onClick={onBuy}
                  className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-2xl bg-[color:var(--store-primary)] px-5 text-sm font-bold text-white transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--store-primary)] focus-visible:ring-offset-2"
                >
                  <Plus size={16} /> {t("خرید PAYG", "Buy PAYG")}
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-2.5">
            {subs.map((s, i) => (
              <PaygSubRow
                key={s.id}
                sub={s}
                defaultOpen={justActivated && i === 0}
                cancelRefundEnabled={cancelRefundEnabled && s.status === "ACTIVE"}
                cancelPending={pendingCancelClientIds?.has(s.id)}
                cancelBusy={requestCancel?.isPending}
                onRequestCancel={() =>
                  onAskCancel?.({ id: s.id, targetType: "payg_sub", title: s.planName || s.clientEmail || "PAYG" })
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PaygMinBalance({ amount }: { amount: number }) {
  const money = usePaygMoney();
  return <b className="text-zinc-700 dark:text-zinc-200">{money.format(amount)}</b>;
}

function WalletSettlementSurface({
  wallet,
  loading,
  settlements,
  requestSettlement,
}: {
  wallet?: { balance: number; currency: string };
  loading?: boolean;
  settlements?: CustomerWalletSettlement[];
  requestSettlement?: ReturnType<typeof useCustomerSession>["requestSettlement"];
}) {
  const { t, isFa } = useStorefrontLocale();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [formError, setFormError] = useState("");

  const balance = Number(wallet?.balance || 0);
  const hasPending = (settlements || []).some((s) => s.status === "PENDING");

  const statusLabel = (status: string) =>
    status === "APPROVED"
      ? t("پرداخت شد", "Paid")
      : status === "REJECTED"
        ? t("رد شد", "Rejected")
        : t("در انتظار بررسی", "Pending");

  const submit = async () => {
    setFormError("");
    const n = Number(amount);
    const card = cardNumber.replace(/\s+/g, "");
    if (!(n > 0)) {
      setFormError(t("مقدار نامعتبر است", "Invalid amount"));
      return;
    }
    if (n > balance) {
      setFormError(t("موجودی کافی نیست", "Insufficient balance"));
      return;
    }
    if (card.length < 8) {
      setFormError(t("شماره کارت نامعتبر است", "Invalid card number"));
      return;
    }
    try {
      await requestSettlement?.mutateAsync({ amount: n, cardNumber: card, cardHolder });
      setAmount("");
      setCardNumber("");
      setCardHolder("");
      setOpen(false);
    } catch (err: any) {
      setFormError(
        err?.response?.data?.message || err?.message || t("ثبت درخواست ناموفق بود", "Request failed"),
      );
    }
  };

  return (
    <Surface className="mb-5 sm:mb-7">
      <SectionHeading
        title={t("تسویه کیف پول", "Wallet settlement")}
        subtitle={t(
          "درخواست واریز موجودی کیف پول به کارت بانکی",
          "Request a payout of your wallet balance to your bank card",
        )}
        action={
          !hasPending ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-bold dark:border-zinc-700"
            >
              {open ? t("بستن", "Close") : t("درخواست تسویه", "Request payout")}
            </button>
          ) : null
        }
      />

      <div className="mt-3 text-sm">
        {loading ? (
          <LoaderCircle size={16} className="animate-spin text-zinc-400" />
        ) : (
          <>
            {t("موجودی", "Balance")}:{" "}
            <span className="font-bold tabular-nums">
              {balance.toLocaleString(isFa ? "fa-IR" : "en-US")}
            </span>
          </>
        )}
      </div>

      {hasPending ? (
        <p className="mt-3 text-xs font-medium text-amber-600 dark:text-amber-400">
          {t(
            "یک درخواست تسویه در انتظار بررسی دارید.",
            "You already have a pending settlement request.",
          )}
        </p>
      ) : null}

      {open && !hasPending ? (
        <div className="mt-4 space-y-3 rounded-2xl bg-zinc-50/80 p-4 dark:bg-zinc-950/40">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-zinc-500">
              {t("مقدار", "Amount")}
            </label>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-[color:var(--store-primary)] dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-zinc-500">
              {t("شماره کارت", "Card number")}
            </label>
            <input
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              dir="ltr"
              placeholder="6037-XXXX-XXXX-XXXX"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 font-mono text-sm outline-none focus:border-[color:var(--store-primary)] dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-zinc-500">
              {t("نام صاحب کارت (اختیاری)", "Cardholder name (optional)")}
            </label>
            <input
              value={cardHolder}
              onChange={(e) => setCardHolder(e.target.value)}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-[color:var(--store-primary)] dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          {formError ? <p className="text-xs text-red-500">{formError}</p> : null}
          <button
            type="button"
            disabled={requestSettlement?.isPending}
            onClick={() => void submit()}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[color:var(--store-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {requestSettlement?.isPending ? <LoaderCircle size={14} className="animate-spin" /> : null}
            {t("ثبت درخواست", "Submit request")}
          </button>
        </div>
      ) : null}

      {(settlements || []).length ? (
        <div className="mt-4 space-y-2">
          {(settlements || []).slice(0, 5).map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-950/40"
            >
              <span className="font-mono tabular-nums" dir="ltr">
                {Number(s.amount).toLocaleString(isFa ? "fa-IR" : "en-US")} → •••• {s.cardNumber.slice(-4)}
              </span>
              <span
                className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                  s.status === "APPROVED"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : s.status === "REJECTED"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                }`}
              >
                {statusLabel(s.status)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </Surface>
  );
}

type SegmentItem = { id: HomeSegment; label: string; shortLabel?: string; icon: typeof Shield; count: number };

const PROVIDER_GROUPS: Array<{ id: "eylan" | "pasarguard" | "panel_3xui"; label: string }> = [
  { id: "panel_3xui", label: "3x-ui" },
  { id: "pasarguard", label: "Pasarguard" },
  { id: "eylan", label: "Eylan" },
];

function serviceProviderGroup(service: CustomerService): (typeof PROVIDER_GROUPS)[number]["id"] {
  const id = String(service.id || "");
  if (service.providerId === "eylan" || service.deliveryHint === "eylan_download" || id.startsWith("eylan:")) {
    return "eylan";
  }
  if (service.providerId === "pasarguard" || id.startsWith("pasarguard:")) return "pasarguard";
  return "panel_3xui";
}

function SegmentBar({
  segments,
  value,
  onChange,
}: {
  segments: SegmentItem[];
  value: HomeSegment;
  onChange: (id: HomeSegment) => void;
}) {
  const { isFa } = useStorefrontLocale();
  const reduce = useReducedMotion();
  if (segments.length <= 1) return null;
  return (
    <div
      role="tablist"
      className="store-card grid gap-1 rounded-[1.35rem] border p-1 shadow-[0_6px_24px_-18px_rgba(15,23,42,0.35)]"
      style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}
    >
      {segments.map((s) => {
        const Icon = s.icon;
        const active = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={s.label}
            onClick={() => onChange(s.id)}
            className={`store-focus-ring relative flex min-h-12 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-[1.1rem] px-1.5 text-[12.5px] font-semibold transition-colors duration-200 sm:text-[13px] ${
              active ? "text-white" : "text-[color:var(--store-muted)] hover:text-[color:var(--store-fg)]"
            }`}
          >
            {active ? (
              <motion.span
                layoutId="portal-segment-pill"
                aria-hidden
                className="absolute inset-0 rounded-[1.1rem] bg-[color:var(--store-primary)] shadow-[0_8px_20px_-10px_var(--store-primary)]"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 36 }}
              />
            ) : null}
            <Icon size={16} className="relative shrink-0" aria-hidden />
            <span className="relative min-w-0 truncate">
              {s.shortLabel ? (
                <>
                  <span className="sm:hidden">{s.shortLabel}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </>
              ) : (
                s.label
              )}
            </span>
            {s.count > 0 ? (
              <span
                className={`relative flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10.5px] font-bold tabular-nums ${
                  active
                    ? "bg-white/25 text-white"
                    : "bg-[color:var(--store-primary)]/10 text-[color:var(--store-primary)]"
                }`}
              >
                {s.count.toLocaleString(isFa ? "fa-IR" : "en-US")}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function HomeTab({
  segments,
  segment,
  onSegmentChange,
  digitalOrders,
  paygContent,
  data,
  showToken,
  setShowToken,
  copiedToken,
  setCopiedToken,
  claimService,
  hideService,
  categories,
  onRenew,
  cancelRefundEnabled,
  pendingCancelClientIds,
  requestCancel,
  walletSettlementEnabled,
  wallet,
  walletLoading,
  settlements,
  requestSettlement,
  onAskCancel,
  onAskHide,
  compact = false,
  focus = "all",
}: {
  onAskCancel?: (target: CancelTarget) => void;
  onAskHide?: (service: CustomerService) => void;
  segments: SegmentItem[];
  segment: HomeSegment;
  onSegmentChange: (id: HomeSegment) => void;
  digitalOrders: CustomerOrder[];
  paygContent: React.ReactNode;
  data: CustomerDashboard;
  showToken: boolean;
  setShowToken: (v: boolean) => void;
  copiedToken: boolean;
  setCopiedToken: (v: boolean) => void;
  claimService: ReturnType<typeof useCustomerSession>["claimService"];
  hideService: ReturnType<typeof useCustomerSession>["hideService"];
  categories: StorefrontCategory[];
  onRenew: (service: CustomerService) => void;
  cancelRefundEnabled?: boolean;
  pendingCancelClientIds?: Set<string>;
  requestCancel?: ReturnType<typeof useCustomerSession>["requestCancel"];
  walletSettlementEnabled?: boolean;
  wallet?: { balance: number; currency: string };
  walletLoading?: boolean;
  settlements?: CustomerWalletSettlement[];
  requestSettlement?: ReturnType<typeof useCustomerSession>["requestSettlement"];
  compact?: boolean;
  focus?: "all" | "services" | "digital" | "payg";
}) {
  const { t, isFa } = useStorefrontLocale();
  const services = data.services || [];
  const serviceGroups = PROVIDER_GROUPS.map((g) => ({
    ...g,
    items: services.filter((s) => serviceProviderGroup(s) === g.id),
  })).filter((g) => g.items.length > 0);
  const [linkInput, setLinkInput] = useState("");
  const [linkCategoryId, setLinkCategoryId] = useState(categories[0]?.id || "");
  const [linkError, setLinkError] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);

  useEffect(() => {
    if (!linkCategoryId && categories[0]?.id) setLinkCategoryId(categories[0].id);
  }, [categories, linkCategoryId]);

  const submitLink = async (mode: "claim" | "renew") => {
    setLinkError("");
    const token = parseSubscriptionToken(linkInput);
    if (!token) {
      setLinkError(t("لینک ساب معتبر نیست", "Invalid subscription link"));
      return;
    }
    if (!linkCategoryId) {
      setLinkError(t("دسته‌بندی را انتخاب کنید", "Please select a category"));
      return;
    }
    try {
      const result = await claimService.mutateAsync({
        subscriptionLink: linkInput.trim() || token,
        categoryId: linkCategoryId,
      });
      setLinkInput("");
      setLinkOpen(false);
      if (mode === "renew" && result.service) onRenew(result.service);
    } catch (err: any) {
      setLinkError(
        err?.response?.data?.message ||
          err?.message ||
          t("سرویس یافت نشد", "Service not found"),
      );
    }
  };

  const showDigital = compact ? focus === "digital" : segment === "digital";
  const showPayg = compact ? focus === "payg" : segment === "payg";
  const showVpn = compact ? focus === "services" : segment === "vpn";

  return (
    <div className="space-y-5 lg:space-y-8">
      {!compact ? (
      <Surface>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              {t("شناسه ورود وب", "Web access token")}
            </div>
            <div className="mt-1.5 font-mono text-sm font-semibold tracking-wide" dir="ltr">
              {showToken ? data.token : "••••-••••-••••"}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {t("فقط برای ورود از مرورگر — در مینی‌اپ لازم نیست.", "Only for browser login — not needed in Mini App.")}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-xs font-semibold dark:border-zinc-700"
            >
              {showToken ? t("مخفی", "Hide") : t("نمایش", "Show")}
            </button>
            <button
              type="button"
              onClick={async () => {
                await copyToClipboard(data.token);
                setCopiedToken(true);
                setTimeout(() => setCopiedToken(false), 1500);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 py-2.5 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              <Copy size={13} /> {copiedToken ? t("کپی شد", "Copied") : t("کپی", "Copy")}
            </button>
          </div>
        </div>
      </Surface>
      ) : null}

      {!compact && walletSettlementEnabled ? (
        <WalletSettlementSurface
          wallet={wallet}
          loading={walletLoading}
          settlements={settlements}
          requestSettlement={requestSettlement}
        />
      ) : null}

      {!compact ? <SegmentBar segments={segments} value={segment} onChange={onSegmentChange} /> : null}

      {showDigital ? (
        <div>
          <SectionHeading
            title={t("محصولات دیجیتال", "Digital products")}
            subtitle={compact ? undefined : t("کدها و محصولات تحویلی شما", "Your delivered codes and items")}
          />
          {digitalOrders.length ? (
            <DigitalOrdersList orders={digitalOrders} />
          ) : (
            <EmptyState
              title={t("هنوز محصول دیجیتالی نخریده‌اید.", "No digital products yet.")}
              hint={
                compact
                  ? t("از دکمه خرید بالا یک محصول انتخاب کنید.", "Use the buy button above.")
                  : t("از «سفارش جدید» یک محصول دیجیتال انتخاب کنید.", "Pick a digital product from “New order”.")
              }
            />
          )}
        </div>
      ) : null}

      {showPayg ? paygContent : null}

      {showVpn ? (
      <div>
        <SectionHeading
          title={t("سرویس‌ها", "Services")}
          subtitle={compact ? undefined : t("اشتراک‌های فعال و قبلی شما", "Your active and past subscriptions")}
          action={
            <button
              type="button"
              onClick={() => {
                setLinkOpen((v) => !v);
                setLinkError("");
              }}
              aria-label={linkOpen ? t("بستن", "Close") : t("افزودن سرویس قبلی", "Add a previous service")}
              title={linkOpen ? t("بستن", "Close") : t("افزودن سرویس قبلی", "Add a previous service")}
              className="store-focus-ring inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-2xl border border-zinc-200 px-3 text-xs font-bold text-[color:var(--store-fg)] dark:border-zinc-700"
            >
              <Link2 size={14} aria-hidden />
              {linkOpen ? t("بستن", "Close") : t("افزودن سرویس قبلی", "Add a previous service")}
            </button>
          }
        />

        {linkOpen ? (
          <Surface className="mb-3">
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "color-mix(in srgb, var(--store-primary) 12%, transparent)" }}
              >
                <Link2 size={18} style={{ color: "var(--store-primary)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{t("افزودن یا تمدید با لینک ساب", "Add or renew with sub link")}</div>
                <p className="mt-1 text-xs text-zinc-500">
                  {t(
                    "لینک سابسکریپشن قبلی را بچسبانید و دسته‌بندی آن را انتخاب کنید.",
                    "Paste your previous subscription link and choose its category.",
                  )}
                </p>
                <textarea
                  value={linkInput}
                  onChange={(e) => {
                    setLinkInput(e.target.value);
                    setLinkError("");
                  }}
                  placeholder={t("https://…/s/abc123", "https://…/s/abc123")}
                  dir="ltr"
                  rows={2}
                  className="mt-3 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 font-mono outline-none focus:border-[color:var(--store-primary)] dark:border-zinc-700 dark:bg-zinc-900"
                  style={{ fontSize: 16 }}
                />
                <label className="mt-3 block text-[11px] font-semibold text-zinc-500">
                  {t("دسته‌بندی سرویس", "Service category")}
                </label>
                <select
                  value={linkCategoryId}
                  onChange={(e) => {
                    setLinkCategoryId(e.target.value);
                    setLinkError("");
                  }}
                  className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {!categories.length ? (
                    <option value="">{t("دسته‌بندی‌ای موجود نیست", "No categories available")}</option>
                  ) : (
                    categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))
                  )}
                </select>
                {linkError ? <p className="mt-2 text-xs text-red-500">{linkError}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={claimService.isPending || !linkInput.trim() || !linkCategoryId}
                    onClick={() => void submitLink("claim")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--store-primary)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {claimService.isPending ? <LoaderCircle size={14} className="animate-spin" /> : null}
                    {t("افزودن سرویس", "Add service")}
                  </button>
                  <button
                    type="button"
                    disabled={claimService.isPending || !linkInput.trim() || !linkCategoryId}
                    onClick={() => void submitLink("renew")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-semibold dark:border-zinc-700"
                  >
                    {t("تمدید", "Renew")}
                  </button>
                </div>
              </div>
            </div>
          </Surface>
        ) : null}

        <div className="flex flex-col gap-5">
        {serviceGroups.map((group) => (
        <section key={group.id} aria-label={group.label}>
          {serviceGroups.length > 1 ? (
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${PROVIDER_TONE[group.id]}`}>
                {group.label}
              </span>
              <span className="text-[11px] text-zinc-400">
                {group.items.length.toLocaleString(isFa ? "fa-IR" : "en-US")} {t("سرویس", "services")}
              </span>
              <span className="h-px flex-1 bg-black/[0.06] dark:bg-white/[0.08]" aria-hidden />
            </div>
          ) : null}
        <motion.div className="flex flex-col gap-2.5 sm:gap-3" variants={staggerContainer} initial="initial" animate="animate">
          {group.items.map((service, serviceIndex) => {
            const native = String(service.subUrl || "").trim();
            const isEylan =
              service.providerId === "eylan" ||
              service.deliveryHint === "eylan_download" ||
              String(service.id || "").startsWith("eylan:");
            const link = isEylan
              ? native && /^https?:\/\//i.test(native) && /\/sub\/[^/]+\/[^/]+/i.test(native)
                ? native
                : ""
              : native && /^https?:\/\//i.test(native)
                ? native
                : buildSubscriptionLink(service.subId, service.subToken, service.subUrl);
            return (
              <motion.div key={service.id} variants={staggerItem}>
                <ServiceListItem
                  defaultOpen={!compact && services.length === 1 && serviceIndex === 0}
                  quickRenew={compact}
                  service={service}
                  subLink={link}
                  onCopy={() => {
                    if (link) void copyToClipboard(link);
                  }}
                  onOpen={() => {
                    if (link) window.open(link, "_blank", "noopener,noreferrer");
                  }}
                  onRenew={() => onRenew(service)}
                  onHide={() => onAskHide?.(service)}
                  hiding={hideService.isPending}
                  canCancel={
                    !!cancelRefundEnabled &&
                    service.status !== "expired" &&
                    service.status !== "disabled" &&
                    !String(service.id).includes(":")
                  }
                  cancelPending={pendingCancelClientIds?.has(service.id)}
                  cancelSubmitting={requestCancel?.isPending}
                  onRequestCancel={() =>
                    onAskCancel?.({
                      id: service.id,
                      targetType: "vpn_client",
                      title: service.remark || service.productName || service.email,
                    })
                  }
                />
              </motion.div>
            );
          })}
        </motion.div>
        </section>
        ))}
          {!services.length ? (
            <EmptyState
              title={t("هنوز سرویسی ندارید.", "No services yet.")}
              hint={
                compact
                  ? t("از دکمه خرید بالا سرویس بگیرید.", "Use the buy button above.")
                  : t("با سفارش جدید اولین اشتراک خود را فعال کنید.", "Place a new order to activate your first service.")
              }
            />
          ) : null}
        </div>
      </div>
      ) : null}
    </div>
  );
}

const PROVIDER_TONE: Record<(typeof PROVIDER_GROUPS)[number]["id"], string> = {
  panel_3xui: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  pasarguard: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
  eylan: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};

function OrdersTab({
  data,
  onAskCancelOrder,
  onBuy,
  cancelRequests,
  resolveCancelTitle,
  compact = false,
}: {
  data: CustomerDashboard;
  onAskCancelOrder: (order: CustomerOrder) => void;
  onBuy: () => void;
  cancelRequests: CustomerCancelRequest[];
  resolveCancelTitle: (row: CustomerCancelRequest) => string;
  compact?: boolean;
}) {
  const { t, isFa } = useStorefrontLocale();
  const orders = data.orders || [];

  return (
    <div className="space-y-4 lg:space-y-6">
      <SectionHeading
        title={t("سفارش‌ها", "Orders")}
        subtitle={compact ? undefined : t("پیگیری و مدیریت درخواست‌ها", "Track and manage your requests")}
        action={
          compact ? undefined : (
            <button
              type="button"
              onClick={onBuy}
              className="inline-flex min-h-11 items-center gap-1 rounded-full bg-[color:var(--store-primary)] px-3.5 text-xs font-bold text-white"
            >
              <ShoppingBag size={13} /> {t("خرید", "Buy")}
            </button>
          )
        }
      />
      <div className="flex flex-col gap-2.5 sm:gap-3">
        {orders.map((order) => (
          <Surface key={order.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold">{order.productName}</span>
                  {order.kind === "DIGITAL" ? (
                    <span className="shrink-0 rounded-full bg-violet-500/12 px-1.5 py-px text-[10px] font-bold text-violet-700 dark:text-violet-300">
                      {t("دیجیتال", "Digital")}
                    </span>
                  ) : null}
                </div>
                {order.configName ? (
                  <div className="mt-0.5 truncate font-mono text-xs text-zinc-600 dark:text-zinc-400" dir="ltr">
                    {order.isRenewal
                      ? t(`تمدید: ${order.configName}`, `Renew: ${order.configName}`)
                      : order.configName}
                  </div>
                ) : order.isRenewal ? (
                  <div className="mt-0.5 text-xs text-amber-600">{t("تمدید سرویس", "Service renewal")}</div>
                ) : null}
                <div className="mt-1 text-xs text-zinc-500">
                  {order.trackingCode} ·{" "}
                  {order.status === "PENDING_PAYMENT"
                    ? t("در انتظار پرداخت", "Pending payment")
                    : order.status === "PAYMENT_SUBMITTED"
                      ? t("پرداخت ارسال شد", "Payment submitted")
                      : order.status === "UNDER_REVIEW"
                        ? t("در حال بررسی", "Under review")
                        : order.status === "COMPLETED" || order.status === "FULFILLED" || order.status === "ACTIVE" || order.status === "RENEWED"
                          ? t("تکمیل شده", "Completed")
                          : order.status === "CANCELLED"
                            ? t("لغو شده", "Cancelled")
                            : order.status.replace(/_/g, " ")}
                </div>
              </div>
              <a
                href={`/track/${encodeURIComponent(order.trackingCode)}`}
                className="shrink-0 text-xs font-bold text-[color:var(--store-primary)]"
              >
                {t("پیگیری", "Track")}
              </a>
            </div>
            {["PENDING_PAYMENT", "PAYMENT_SUBMITTED", "UNDER_REVIEW"].includes(order.status) ? (
              <button
                type="button"
                className="store-focus-ring mt-3 inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-3 text-xs font-bold text-rose-600 transition-colors duration-200 hover:bg-rose-500/[0.12] dark:text-rose-400"
                onClick={() => onAskCancelOrder(order)}
              >
                <XCircle size={14} aria-hidden />
                {t("لغو سفارش", "Cancel order")}
              </button>
            ) : null}
          </Surface>
        ))}
        {!orders.length ? (
          <div className="rounded-[1.5rem] border border-dashed border-zinc-300 px-4 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
            {t("سفارشی ثبت نشده.", "No orders yet.")}
          </div>
        ) : null}
      </div>
      <CancelRequestsList rows={cancelRequests} resolveTitle={resolveCancelTitle} />
    </div>
  );
}

function AlertsTab({
  data,
  markNotificationRead,
  markAllNotificationsRead,
  embedded = false,
}: {
  data: CustomerDashboard;
  markNotificationRead: ReturnType<typeof useCustomerSession>["markNotificationRead"];
  markAllNotificationsRead: ReturnType<typeof useCustomerSession>["markAllNotificationsRead"];
  embedded?: boolean;
}) {
  const { t, isFa } = useStorefrontLocale();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const items = data.notifications || [];
  const unread = items.filter((n) => !n.isRead).length;
  const visible = filter === "unread" ? items.filter((n) => !n.isRead) : items;

  const relTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.round(diff / 60_000);
    const rtf = new Intl.RelativeTimeFormat(isFa ? "fa" : "en", { numeric: "auto" });
    if (min < 60) return rtf.format(-Math.max(0, min), "minute");
    const hr = Math.round(min / 60);
    if (hr < 24) return rtf.format(-hr, "hour");
    return rtf.format(-Math.round(hr / 24), "day");
  };

  const tone = (type: string) => {
    const k = String(type || "").toLowerCase();
    if (/(reject|fail|expire|error|cancel)/.test(k)) return "bg-red-500/10 text-red-600 dark:text-red-400";
    if (/(approve|active|deliver|success|paid|renew)/.test(k)) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    if (/(wallet|payg|low|balance|remind)/.test(k)) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    return "bg-[color:var(--store-primary)]/10 text-[color:var(--store-primary)]";
  };

  return (
    <div className="space-y-4 lg:space-y-5">
      {embedded ? (
        unread > 0 ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => markAllNotificationsRead.mutate()}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-[color:var(--store-primary)] transition-colors duration-200 hover:bg-[color:var(--store-primary)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--store-primary)]/40"
            >
              {t("خواندن همه", "Mark all read")}
            </button>
          </div>
        ) : null
      ) : (
      <SectionHeading
        title={t("اعلان‌ها", "Alerts")}
        action={
          unread > 0 ? (
            <button
              type="button"
              onClick={() => markAllNotificationsRead.mutate()}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-[color:var(--store-primary)] transition-colors duration-200 hover:bg-[color:var(--store-primary)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--store-primary)]/40"
            >
              {t("خواندن همه", "Mark all read")}
            </button>
          ) : null
        }
      />
      )}

      <div role="tablist" className="inline-flex rounded-2xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900/60">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-medium transition-all duration-200 ${
              filter === f
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            {f === "all" ? t("همه", "All") : t("خوانده‌نشده", "Unread")}
            {f === "unread" && unread > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[color:var(--store-primary)] px-1.5 text-[11px] font-bold text-white">
                {unread}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {visible.map((n) => (
            <motion.li
              key={n.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
            >
              <button
                type="button"
                onClick={() => {
                  if (!n.isRead) markNotificationRead.mutate(n.id);
                }}
                aria-label={n.isRead ? n.title : `${n.title} — ${t("خوانده‌نشده", "unread")}`}
                className={`group relative flex w-full cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-start transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--store-primary)]/40 lg:p-4 ${
                  n.isRead
                    ? "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                    : "border-[color:var(--store-primary)]/25 bg-[color:var(--store-primary)]/[0.06] hover:border-[color:var(--store-primary)]/45"
                }`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone(n.type)}`}>
                  <Bell size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className={`text-sm leading-6 ${n.isRead ? "font-medium text-zinc-700 dark:text-zinc-300" : "font-semibold"}`}>
                      {n.title}
                    </span>
                    <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-zinc-400">{relTime(n.createdAt)}</span>
                  </span>
                  {n.message ? (
                    <span className="mt-0.5 block whitespace-pre-line text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                      {n.message}
                    </span>
                  ) : null}
                </span>
                {!n.isRead ? (
                  <span aria-hidden className="absolute end-3 top-3 h-2 w-2 rounded-full bg-[color:var(--store-primary)]" />
                ) : null}
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {!visible.length ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-zinc-300 px-4 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
          <Bell size={22} className="text-zinc-300 dark:text-zinc-600" />
          {filter === "unread" ? t("همه اعلان‌ها خوانده شده‌اند.", "You're all caught up.") : t("اعلانی نیست.", "No alerts.")}
        </div>
      ) : null}
    </div>
  );
}
