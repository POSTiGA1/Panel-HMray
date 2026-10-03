"use client";

export type StorefrontProduct = {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  priceUsd: number;
  priceToman?: number | null;
  traffic: string;
  durationDays: number;
  badge?: string | null;
  featured?: boolean;
  sortOrder?: number;
  renewable?: boolean;
  isTest?: boolean;
  kind?: "VPN" | "DIGITAL" | "PAYG";
  digitalDeliveryHint?: "auto" | "operator";
  digitalOrderMessage?: string | null;
  /** Fulfillment provider — used to keep Eylan renewals on Eylan plans. */
  providerId?: string | null;
  /** Product base concurrent users (before optional IP add-ons). */
  baseLimitIp?: number;
  ipLimitOptions?: Array<{ limitIp: number; priceExtra: number; label: string }>;
  productAddons?: Array<{
    id: string;
    type: "IP_LIMIT" | "EXTRA_DAYS";
    limitIp: number;
    days: number;
    priceExtra: number;
    label: string;
  }>;
};

export type StorefrontStore = {
  title: string;
  description?: string | null;
  slug: string;
  logoUrl?: string | null;
  logoDarkUrl?: string | null;
  defaultCurrency?: string;
  branding?: {
    name?: string | null;
    description?: string | null;
    logo?: string | null;
    logoDark?: string | null;
    primaryColor?: string | null;
    accentColor?: string | null;
    footerText?: string | null;
    theme?: string | null;
    supportLinks?: Record<string, string> | null;
  };
  publishedTheme?: {
    id: string;
    slug: string;
    name: string;
    settings?: Record<string, unknown> | null;
  } | null;
  themeId?: string | null;
  payment?: {
    method: string;
    instructions?: string | null;
    cardNumber?: string | null;
    cardHolder?: string | null;
    bankName?: string | null;
    iban?: string | null;
    accountInfo?: string | null;
    cards?: Array<{
      id: string;
      bankName?: string;
      cardNumber?: string;
      cardHolder?: string;
      iban?: string;
      instructions?: string;
      enabled?: boolean;
    }>;
    wallets?: Array<{
      id?: string;
      title?: string;
      asset?: string;
      network?: string;
      address?: string;
      instructions?: string;
      enabled?: boolean;
    }>;
    methods?: Array<{
      id: string;
      label: string;
      enabled: boolean;
      available?: boolean;
    }>;
  };
};

export type CustomerProfile = {
  id?: string;
  token?: string;
  name?: string | null;
  telegram?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  telegramUserId?: string | null;
};

export type CustomerNotification = {
  id: string;
  type: string;
  title: string;
  message?: string | null;
  payload?: Record<string, unknown> | null;
  readAt?: string | null;
  isRead?: boolean;
  createdAt: string;
};

export type StorefrontCategory = {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number;
};

export type CustomerService = {
  id: string;
  email: string;
  remark?: string | null;
  subId?: string | null;
  subToken?: string | null;
  subUrl?: string | null;
  providerId?: string | null;
  status: "active" | "expired" | "disabled" | "pending" | "depleted";
  /** True when provisioned but no traffic used yet (still “active”, ready to connect). */
  unused?: boolean;
  /** Category chosen at purchase / claim — required for renew filtering. */
  categoryId?: string | null;
  total: string;
  up: string;
  down: string;
  expiryTime: string;
  /** Eylan: purchased product title */
  productName?: string | null;
  /** Eylan: e.g. "20 GB · 30 days" */
  planLabel?: string | null;
  durationDays?: number | null;
  /** Eylan delivery UX marker */
  deliveryHint?: string | null;
};

export type CustomerOrder = {
  id: string;
  trackingCode: string;
  status: string;
  amount: number;
  currency: string;
  isRenewal: boolean;
  productName: string;
  /** Server-side config name (email/remark) — especially important for renewals */
  configName?: string | null;
  categoryId: string;
  createdAt: string;
  kind?: "VPN" | "DIGITAL";
  digitalPendingManual?: boolean;
  digitalCodeMasked?: string | null;
  digitalDeliveryHint?: "auto" | "operator" | null;
  timeline?: Array<{
    id?: string;
    status: string;
    message?: string | null;
    createdAt: string;
  }>;
};

export type CustomerCancelRequest = {
  id: string;
  targetType: "vpn_client" | "payg_sub";
  clientId?: string | null;
  paygSubscriptionId?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason?: string | null;
  refundAmount?: number | null;
  refundCurrency?: string | null;
  rejectReason?: string | null;
  createdAt: string;
};

export type CustomerWalletSettlement = {
  id: string;
  amount: number;
  currency: string;
  cardNumber: string;
  cardHolder?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectReason?: string | null;
  createdAt: string;
};

export type CustomerBuyKind = "vpn" | "digital" | "payg";

export type CustomerBuyMenu = Record<CustomerBuyKind, { label: string | null; available: boolean }>;

export type CustomerDashboard = {
  token: string;
  profile: CustomerProfile;
  store?: {
    slug?: string;
    title?: string;
    description?: string | null;
    logoUrl?: string | null;
    logoDarkUrl?: string | null;
    defaultCurrency?: string;
    payment?: StorefrontStore["payment"] | null;
    publishedTheme?: StorefrontStore["publishedTheme"];
    cancelRefundEnabled?: boolean;
    walletSettlementEnabled?: boolean;
    buyMenu?: CustomerBuyMenu;
    telegramBotUsername?: string | null;
  };
  branding?: StorefrontStore["branding"];
  publishedTheme?: StorefrontStore["publishedTheme"];
  supportLinks?: Record<string, string> | null;
  services: CustomerService[];
  activeServices: CustomerService[];
  expiredServices: CustomerService[];
  pendingOrders: CustomerOrder[];
  orders: CustomerOrder[];
  products: StorefrontProduct[];
  renewProducts: StorefrontProduct[];
  categories?: StorefrontCategory[];
  notifications: CustomerNotification[];
  activity: Array<{
    id: string;
    type: string;
    title: string;
    message?: string | null;
    createdAt: string;
  }>;
};
