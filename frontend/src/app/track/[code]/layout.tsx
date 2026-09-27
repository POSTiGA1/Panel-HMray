import type { Metadata } from "next";
import {
  buildStoreMetadata,
  fetchTrackMeta,
  resolveRequestOrigin,
} from "@/modules/storefront/storefront-meta";

type Props = { params: Promise<{ code: string }> | { code: string }; children: React.ReactNode };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await Promise.resolve(params);
  const code = String(p.code || "");
  const origin = await resolveRequestOrigin();
  const data = await fetchTrackMeta(code);
  const storeTitle = data?.storeTitle || data?.store?.title || "Store";
  return buildStoreMetadata({
    title: data?.trackingCode ? `${storeTitle} — ${data.trackingCode}` : `${storeTitle} — Track order`,
    description: `Order tracking for ${storeTitle}`,
    image: data?.store?.logoUrl || data?.branding?.logo || null,
    path: `/track/${encodeURIComponent(code)}`,
    origin,
  });
}

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
