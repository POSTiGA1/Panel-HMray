"use client";

import Image from "next/image";
import { PANEL_BRAND } from "@/lib/panel-brand";
import { clsx } from "clsx";
import { useAppBrand } from "@/hooks/useAppBrand";

export function PanelLogo({
  size = 48,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  const { brand, ready, displayName } = useAppBrand();

  if (!ready) {
    return <span aria-hidden className={clsx("inline-block shrink-0", className)} style={{ width: size, height: size }} />;
  }

  if (brand.custom && brand.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brand.logo}
        alt={displayName}
        width={size}
        height={size}
        decoding="async"
        className={clsx("shrink-0 object-contain", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <Image
      src={PANEL_BRAND.logoPath}
      alt={displayName}
      width={size}
      height={size}
      priority={priority}
      className={clsx("h-auto w-auto object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

export function PanelBrandName({ className }: { className?: string }) {
  const { ready, displayName } = useAppBrand();
  return <span className={clsx(className, !ready && "invisible")}>{displayName}</span>;
}

export function PanelBootSplash() {
  const { ready, displayName } = useAppBrand();
  return (
    <div className="hm-brand-surface fixed inset-0 flex flex-col items-center justify-center gap-7">
      <div className="hm-boot-mark relative flex h-32 w-32 items-center justify-center">
        <span className="hm-boot-track absolute inset-0 rounded-full" aria-hidden />
        <span className="hm-boot-ring absolute inset-0 rounded-full" aria-hidden />
        <span className="hm-boot-logo flex items-center justify-center">
          <PanelLogo size={68} priority />
        </span>
      </div>
      <p className={clsx("text-base font-semibold tracking-tight", !ready && "invisible")}>{displayName}</p>
    </div>
  );
}
