import { PANEL_BRAND } from "./panel-brand";

export const APP_BRAND_STORAGE_KEY = "hm-app-brand";
export const APP_VERSION_STORAGE_KEY = "hm-app-version";
/** Set once the launch splash has played in this app session (sessionStorage). */
export const BOOT_SPLASH_SESSION_KEY = "hm-boot-splash";

/** Readable foreground for text drawn on the brand background. */
export function brandForeground(bg: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(bg || "");
  if (!m) return "";
  const n = parseInt(m[1], 16);
  const l = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return l > 0.6 ? "#1e293b" : "#f1f5f9";
}

export type AppBrand = {
  name: string;
  nameFa: string;
  shortName: string;
  logo: string;
  iconBg: string;
  themeColor: string;
  backgroundColor: string;
  showGithub: boolean;
  icons: {
    icon192: string;
    icon512: string;
    maskable512: string;
    apple180: string;
  };
  rev: string;
  custom: boolean;
};

export const DEFAULT_APP_BRAND: AppBrand = {
  name: PANEL_BRAND.name,
  nameFa: PANEL_BRAND.nameFa,
  shortName: PANEL_BRAND.name,
  logo: "",
  iconBg: "midnight",
  themeColor: "#09090b",
  backgroundColor: "#09090b",
  showGithub: false,
  icons: {
    icon192: "/pwa/icon-192.png",
    icon512: "/pwa/icon-512.png",
    maskable512: "/pwa/maskable-512.png",
    apple180: "/pwa/apple-touch-180.png",
  },
  rev: "default",
  custom: false,
};

export function readCachedBrand(): AppBrand | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(APP_BRAND_STORAGE_KEY);
    return raw ? ({ ...DEFAULT_APP_BRAND, ...JSON.parse(raw) } as AppBrand) : null;
  } catch {
    return null;
  }
}

export function writeCachedBrand(brand: AppBrand) {
  try {
    localStorage.setItem(APP_BRAND_STORAGE_KEY, JSON.stringify(brand));
  } catch {
    /* storage full or disabled */
  }
}

export async function fetchAppBrand(): Promise<AppBrand> {
  const res = await fetch("/api/public/app-brand", { cache: "no-cache" });
  if (!res.ok) throw new Error(`app-brand ${res.status}`);
  const data = (await res.json()) as Partial<AppBrand>;
  return { ...DEFAULT_APP_BRAND, ...data, icons: { ...DEFAULT_APP_BRAND.icons, ...(data.icons ?? {}) } };
}

export type AppVersionInfo = { app: string; premium: string | null };

export async function fetchAppVersion(): Promise<AppVersionInfo> {
  const res = await fetch("/api/public/app-version", { cache: "no-store" });
  if (!res.ok) throw new Error(`app-version ${res.status}`);
  return (await res.json()) as AppVersionInfo;
}

export function versionKey(v: AppVersionInfo): string {
  return `${v.app}-${v.premium || "none"}`;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
