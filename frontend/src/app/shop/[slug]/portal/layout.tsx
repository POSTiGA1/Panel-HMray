import type { Metadata } from "next";
import {
  buildStoreMetadata,
  fetchPublicStoreMeta,
  resolveRequestOrigin,
} from "@/modules/storefront/storefront-meta";

type Props = { params: Promise<{ slug: string }> | { slug: string }; children: React.ReactNode };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await Promise.resolve(params);
  const slug = String(p.slug || "");
  const origin = await resolveRequestOrigin();
  const data = await fetchPublicStoreMeta(slug);
  const store = data?.store;
  const title = store?.title || store?.branding?.name || slug;
  return buildStoreMetadata({
    title: `${title} — Portal`,
    description: store?.description || `Customer portal for ${title}`,
    image: store?.logoUrl || store?.branding?.logo || null,
    path: `/shop/${encodeURIComponent(slug)}/portal`,
    origin,
  });
}

export default function ShopPortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
