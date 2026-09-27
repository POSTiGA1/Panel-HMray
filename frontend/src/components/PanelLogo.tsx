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
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-zinc-950">
      <PanelLogo size={72} priority className="animate-pulse motion-reduce:animate-none" />
      <p className={clsx("text-sm text-zinc-500 dark:text-zinc-400", !ready && "invisible")}>{displayName}</p>
    </div>
  );
}
