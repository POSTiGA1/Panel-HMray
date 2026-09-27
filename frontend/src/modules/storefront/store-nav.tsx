"use client";

import { useRouter } from "next/navigation";
import { Home, PackageSearch, ShoppingBag, UserRound } from "lucide-react";
import { BottomTabBar } from "./design";
import { useStorefrontLocale } from "./locale";
import { portalPathForSlug, shopPathForSlug } from "./store-slug";

export type StoreNavTab = "home" | "buy" | "track" | "account";

/** Mobile app-style bottom navigation for public storefront pages (shop, track, portal login). */
export function StoreBottomNav({
  slug,
  active,
  hasSession,
  onHome,
  onBuy,
  onTrack,
}: {
  slug?: string | null;
  active: StoreNavTab;
  hasSession?: boolean;
  onHome?: () => void;
  onBuy?: () => void;
  onTrack?: () => void;
}) {
  const router = useRouter();
  const { t } = useStorefrontLocale();
  const tabs = [
    { id: "home", label: t("خانه", "Home"), icon: Home },
    { id: "buy", label: t("خرید", "Buy"), icon: ShoppingBag },
    ...(onTrack || active === "track"
      ? [{ id: "track", label: t("پیگیری", "Track"), icon: PackageSearch }]
      : []),
    { id: "account", label: hasSession ? t("حساب من", "My account") : t("ورود", "Sign in"), icon: UserRound },
  ];

  return (
    <BottomTabBar
      layoutGroup="shop"
      tabs={tabs}
      value={active}
      onChange={(id) => {
        if (id === "home") return onHome ? onHome() : router.push(shopPathForSlug(slug));
        if (id === "buy") return onBuy ? onBuy() : router.push(shopPathForSlug(slug));
        if (id === "track") return onTrack?.();
        router.push(portalPathForSlug(slug, hasSession ? "dashboard" : "login"));
      }}
    />
  );
}
