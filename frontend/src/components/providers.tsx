"use client";

import { useEffect, useState } from "react";
import { QueryClient, type Query } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { ThemeProvider } from "./ThemeProvider";
import { PremiumBootstrap } from "./PremiumBootstrap";
import { LocaleProvider } from "@/i18n";
import { useAuth } from "@/store/auth";

const QUERY_CACHE_KEY = "hm-query-cache";
const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Small, non-sensitive summaries that make the first screen render instantly on relaunch. */
const PERSISTED_QUERY_ROOTS = new Set([
  "platform-license",
  "premium-modules",
  "overview",
  "trends",
  "reseller-overview",
  "store-dashboard",
  "admin-recharge-pending-count",
]);

function shouldPersist(query: Query) {
  const root = query.queryKey[0];
  return (
    query.state.status === "success" &&
    typeof root === "string" &&
    PERSISTED_QUERY_ROOTS.has(root)
  );
}

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            gcTime: PERSIST_MAX_AGE_MS,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window === "undefined" ? noopStorage : window.localStorage,
      key: QUERY_CACHE_KEY,
      throttleTime: 2000,
    }),
  );
  const adminId = useAuth((s) => s.admin?.id ?? null);
  const token = useAuth((s) => s.token);

  useEffect(() => {
    let lastAdmin = useAuth.getState().admin?.id ?? null;
    return useAuth.subscribe((state) => {
      const next = state.token ? state.admin?.id ?? lastAdmin : null;
      if (next !== lastAdmin) {
        client.clear();
        try {
          localStorage.removeItem(QUERY_CACHE_KEY);
        } catch {
          /* storage disabled */
        }
      }
      lastAdmin = next;
    });
  }, [client]);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <PersistQueryClientProvider
        client={client}
        persistOptions={{
          persister,
          maxAge: PERSIST_MAX_AGE_MS,
          buster: token ? adminId ?? "anon" : "anon",
          dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
        }}
      >
        <LocaleProvider>
          <PremiumBootstrap />
          {children}
        </LocaleProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
