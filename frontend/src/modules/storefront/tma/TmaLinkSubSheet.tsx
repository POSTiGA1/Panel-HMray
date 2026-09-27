"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link2, LoaderCircle, X } from "lucide-react";
import { publicApi } from "@/lib/api";
import { parseSubscriptionToken } from "../subscription";
import { useStorefrontLocale } from "../locale";

import type { CustomerService, StorefrontCategory } from "../types";

export function TmaLinkSubSheet({
  open,
  onClose,
  onClaimed,
  categories = [],
  mode = "claim",
}: {
  open: boolean;
  onClose: () => void;
  onClaimed: (service: CustomerService) => void;
  categories?: StorefrontCategory[];
  mode?: "claim" | "renew";
}) {
  const { t } = useStorefrontLocale();
  const [link, setLink] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [error, setError] = useState("");

  const claim = useMutation({
    mutationFn: async () => {
      const token = parseSubscriptionToken(link);
      if (!token) throw new Error(t("لینک ساب معتبر نیست", "Invalid subscription link"));
      if (!categoryId) throw new Error(t("دسته‌بندی را انتخاب کنید", "Please select a category"));
      return (
        await publicApi.post("/store/customer/services/claim", {
          subscriptionLink: link.trim() || token,
          categoryId,
        })
      ).data as { service: CustomerService };
    },
    onSuccess: (data) => {
      setLink("");
      setError("");
      onClaimed(data.service);
      onClose();
    },
    onError: (err: any) => {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          t("سرویس یافت نشد", "Service not found"),
      );
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 animate-[fadeIn_0.2s_ease]">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-lg animate-[slideUp_0.32s_cubic-bezier(0.22,1,0.36,1)] rounded-t-[1.75rem] bg-white p-5 text-zinc-900 shadow-2xl dark:bg-zinc-950 dark:text-zinc-50"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            <Link2 size={18} className="text-blue-600" />
            {mode === "renew"
              ? t("تمدید با لینک ساب", "Renew with sub link")
              : t("افزودن سرویس با لینک", "Add service by link")}
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>
        <p className="mb-3 text-[13px] leading-relaxed text-zinc-500">
          {t(
            "لینک سابسکریپشن قبلی خود را بچسبانید و دسته‌بندی سرویس را مشخص کنید.",
            "Paste your previous subscription link and choose its category.",
          )}
        </p>
        <textarea
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setError("");
          }}
          placeholder={t("لینک ساب را اینجا بچسبانید…", "Paste subscription link here…")}
          dir="ltr"
          rows={3}
          className="w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 font-mono text-[12px] outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <label className="mt-3 block text-[12px] font-semibold text-zinc-600 dark:text-zinc-300">
          {t("دسته‌بندی سرویس", "Service category")}
        </label>
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setError("");
          }}
          className="mt-1.5 h-11 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-[14px] outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900"
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
        {error ? <p className="mt-2 text-[13px] text-red-500">{error}</p> : null}
        <button
          type="button"
          disabled={claim.isPending || !link.trim() || !categoryId}
          onClick={() => claim.mutate()}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-[15px] font-semibold text-white disabled:opacity-50 active:scale-[0.98]"
        >
          {claim.isPending ? <LoaderCircle size={18} className="animate-spin" /> : null}
          {mode === "renew" ? t("ادامه تمدید", "Continue to renew") : t("افزودن سرویس", "Add service")}
        </button>
      </div>
    </div>
  );
}
