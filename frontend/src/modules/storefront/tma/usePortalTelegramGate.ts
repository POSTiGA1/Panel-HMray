"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { publicApi, setCustomerSessionToken, getCustomerSessionToken } from "@/lib/api";
import {
  applyTelegramFullscreen,
  applyTelegramSafeArea,
  forceTelegramMiniApp,
  isTelegramContext,
  loadTelegramScript,
} from "./useTelegramWebApp";

/**
 * Silent Telegram login for portal routes.
 * Resolves store slug from query, then by-domain, then creates session from initData.
 */
export function usePortalTelegramGate(opts?: { redirectSlug?: string | null }) {
  const queryClient = useQueryClient();
  const booted = useRef(false);
  const [phase, setPhase] = useState<"idle" | "checking" | "authing" | "done" | "skip" | "error">(
    "checking",
  );
  const [error, setError] = useState<string | null>(null);
  const [resolvedSlug, setResolvedSlug] = useState<string | null>(opts?.redirectSlug || null);

  const silentLogin = useMutation({
    mutationFn: async (payload: { slug: string; initData: string }) =>
      (await publicApi.post("/store/telegram/session", payload)).data as {
        sessionToken: string;
        store?: { slug?: string };
        dashboard?: unknown;
      },
    onSuccess: async (data) => {
      setCustomerSessionToken(data.sessionToken);
      if (data.dashboard) {
        queryClient.setQueryData(["customer-session"], data.dashboard);
      } else {
        await queryClient.invalidateQueries({ queryKey: ["customer-session"] });
      }
      if (data.store?.slug) setResolvedSlug(data.store.slug);
      setPhase("done");
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || err?.message || "Telegram sign-in failed");
      setPhase("error");
    },
  });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (typeof window === "undefined") return;

      const inTg = forceTelegramMiniApp() || isTelegramContext();

      // Already signed in (web or prior TG session)
      if (getCustomerSessionToken()) {
        if (inTg) {
          setPhase("done");
        } else {
          setPhase("skip");
        }
        return;
      }

      // Browser / web portal — show token form
      if (!inTg) {
        setPhase("skip");
        return;
      }

      setPhase("checking");
      const params = new URLSearchParams(window.location.search);
      const knownSlug = opts?.redirectSlug || params.get("slug") || "";
      // Domain lookup runs alongside the Telegram script download instead of after it.
      const slugPromise: Promise<string> = knownSlug
        ? Promise.resolve(knownSlug)
        : publicApi
            .get("/store/public/by-domain", { params: { domain: window.location.host } })
            .then((res) => String(res.data?.store?.slug || ""))
            .catch(() => "");
      try {
        await loadTelegramScript();
      } catch {
        /* continue */
      }
      if (cancelled) return;
      applyTelegramFullscreen(window.Telegram?.WebApp);
      applyTelegramSafeArea(window.Telegram?.WebApp);
      window.setTimeout(() => applyTelegramSafeArea(window.Telegram?.WebApp), 300);
      window.setTimeout(() => applyTelegramSafeArea(window.Telegram?.WebApp), 1000);

      const slug = await slugPromise;
      if (cancelled) return;

      if (!slug) {
        // Wait for initData a bit then fail clearly — never show token form in TG
        setError("Open the Mini App from the store bot (Open button).");
        setPhase("error");
        return;
      }

      setResolvedSlug(slug);

      // Wait for initData
      let ticks = 0;
      const waitInit = (): Promise<string> =>
        new Promise((resolve, reject) => {
          const tick = () => {
            if (cancelled) return;
            const data = window.Telegram?.WebApp?.initData || "";
            if (data) {
              resolve(data);
              return;
            }
            ticks += 1;
            if (ticks >= 100) {
              reject(new Error("Open this Mini App from the store bot inside Telegram."));
              return;
            }
            window.setTimeout(tick, 50);
          };
          tick();
        });

      try {
        const initData = await waitInit();
        if (cancelled || booted.current) return;
        booted.current = true;
        setPhase("authing");
        silentLogin.mutate({ slug, initData });
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Telegram sign-in failed");
        setPhase("error");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    phase,
    error,
    slug: resolvedSlug,
    inTelegram: phase !== "skip" && phase !== "idle",
    isBusy: phase === "checking" || phase === "authing",
  };
}
