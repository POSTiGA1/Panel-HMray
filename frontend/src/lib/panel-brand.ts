import type { Metadata, Viewport } from "next";

/** Default branding for the admin panel UI only (not storefront / portal). */
export const PANEL_BRAND = {
  name: "HM Panel",
  nameFa: "اچ‌ام پنل",
  title: "HM Panel — 3x-ui Reseller Management",
  titleFa: "اچ‌ام پنل — مدیریت نمایندگی 3x-ui",
  description:
    "Multi-server 3x-ui reseller management panel for admins and resellers.",
  descriptionFa: "پنل مدیریت نمایندگی چندسرور 3x-ui برای ادمین و نمایندگان.",
  logoPath: "/brand/hmpanel-logo.png",
} as const;

export const PANEL_MANIFEST_URL = "/api/public/manifest.webmanifest";

export const PANEL_METADATA: Metadata = {
  title: PANEL_BRAND.title,
  description: PANEL_BRAND.description,
  manifest: PANEL_MANIFEST_URL,
  applicationName: PANEL_BRAND.name,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: PANEL_BRAND.name,
  },
  formatDetection: { telephone: false },
  other: { "mobile-web-app-capable": "yes" },
  icons: {
    icon: [
      { url: PANEL_BRAND.logoPath, type: "image/png" },
      { url: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: PANEL_BRAND.logoPath,
    apple: [{ url: "/pwa/apple-touch-180.png", sizes: "180x180" }],
  },
};

export const PANEL_VIEWPORT: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  ],
};
