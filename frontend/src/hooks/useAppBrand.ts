"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_APP_BRAND,
  fetchAppBrand,
  readCachedBrand,
  writeCachedBrand,
  type AppBrand,
} from "@/lib/app-brand";
import { useLocale } from "@/i18n";

/**
 * Panel brand (agency name + logo) published from Premium's reseller-menu settings.
 * `ready` stays false until the cached/remote brand is known so the default HM Panel mark
 * never flashes before the agency logo on white-labelled installs.
 */
export function useAppBrand(): { brand: AppBrand; ready: boolean; displayName: string } {
  const { locale } = useLocale();
  const [cached, setCached] = useState<AppBrand | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCached(readCachedBrand());
    setMounted(true);
  }, []);

  const query = useQuery({
    queryKey: ["app-brand"],
    queryFn: fetchAppBrand,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (query.data) writeCachedBrand(query.data);
  }, [query.data]);

  const brand = query.data ?? cached ?? DEFAULT_APP_BRAND;
  const ready = !!query.data || !!cached || (mounted && (query.isError || !query.isFetching));
  const displayName = locale === "fa" ? brand.nameFa || brand.name : brand.name;
  return { brand, ready, displayName };
}
