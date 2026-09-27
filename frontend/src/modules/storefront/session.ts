"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  publicApi,
  setCustomerSessionToken,
  getCustomerSessionToken,
} from "@/lib/api";
import type { CustomerDashboard } from "./types";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Mark-read mutations patch the cached dashboard instantly and never refetch it —
 * rebuilding the full customer dashboard per click made the portal feel frozen.
 * The regular session poll reconciles with the server afterwards.
 */
export function optimisticNotificationRead(queryClient: QueryClient, queryKey: QueryKey) {
  const patch = (ids: string[] | "all") => {
    const previous = queryClient.getQueryData<CustomerDashboard>(queryKey);
    if (previous?.notifications) {
      const now = new Date().toISOString();
      queryClient.setQueryData<CustomerDashboard>(queryKey, {
        ...previous,
        notifications: previous.notifications.map((n) =>
          ids === "all" || ids.includes(n.id) ? { ...n, isRead: true, readAt: n.readAt || now } : n,
        ),
      });
    }
    return { previous };
  };
  const rollback = (ctx?: { previous?: CustomerDashboard }) => {
    if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
  };
  return {
    single: {
      mutationFn: async (notificationId: string) =>
        (await publicApi.post(`/store/customer/notifications/${notificationId}/read`)).data,
      onMutate: async (notificationId: string) => {
        await queryClient.cancelQueries({ queryKey });
        return patch([notificationId]);
      },
      onError: (_err: unknown, _id: string, ctx?: { previous?: CustomerDashboard }) => rollback(ctx),
    },
    all: {
      mutationFn: async (_?: void) =>
        (await publicApi.post(`/store/customer/notifications/read-all`)).data,
      onMutate: async (_?: void) => {
        await queryClient.cancelQueries({ queryKey });
        return patch("all");
      },
      onError: (_err: unknown, _v: void, ctx?: { previous?: CustomerDashboard }) => rollback(ctx),
    },
  };
}

export function useCustomerSession() {
  const queryClient = useQueryClient();

  const sessionQuery = useQuery<CustomerDashboard>({
    queryKey: ["customer-session"],
    queryFn: async () => (await publicApi.get("/store/customer/session")).data,
    retry: false,
    enabled: typeof window !== "undefined" && !!getCustomerSessionToken(),
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const login = useMutation({
    mutationFn: async (token: string) =>
      (await publicApi.post("/store/customer/session", { token })).data,
    onSuccess: async (data) => {
      setCustomerSessionToken(data.sessionToken);
      await queryClient.invalidateQueries({ queryKey: ["customer-session"] });
    },
  });

  const logout = useMutation({
    mutationFn: async () => (await publicApi.post("/store/customer/logout")).data,
    onSettled: async () => {
      setCustomerSessionToken(null);
      await queryClient.removeQueries({ queryKey: ["customer-session"] });
    },
  });

  const notifRead = optimisticNotificationRead(queryClient, ["customer-session"]);
  const markNotificationRead = useMutation(notifRead.single);
  const markAllNotificationsRead = useMutation(notifRead.all);

  const cancelOrder = useMutation({
    mutationFn: async (orderId: string) =>
      (await publicApi.post(`/store/customer/orders/${orderId}/cancel`)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customer-session"] });
    },
  });

  const claimService = useMutation({
    mutationFn: async (input: { subscriptionLink: string; categoryId: string }) =>
      (
        await publicApi.post("/store/customer/services/claim", {
          subscriptionLink: input.subscriptionLink,
          categoryId: input.categoryId,
        })
      ).data as { service: CustomerDashboard["services"][0]; dashboard: CustomerDashboard },
    onSuccess: async (data) => {
      queryClient.setQueryData(["customer-session"], data.dashboard);
      await queryClient.invalidateQueries({ queryKey: ["customer-session"] });
    },
  });

  const assignServiceCategory = useMutation({
    mutationFn: async (input: { clientId: string; categoryId: string }) =>
      (
        await publicApi.post(
          `/store/customer/services/${encodeURIComponent(input.clientId)}/category`,
          { categoryId: input.categoryId },
        )
      ).data as CustomerDashboard,
    onSuccess: async (dashboard) => {
      if (dashboard?.token) {
        queryClient.setQueryData(["customer-session"], dashboard);
      }
      await queryClient.invalidateQueries({ queryKey: ["customer-session"] });
    },
  });

  const hideService = useMutation({
    mutationFn: async (clientId: string) =>
      (
        await publicApi.post(`/store/customer/services/${encodeURIComponent(clientId)}/hide`)
      ).data as { dashboard: CustomerDashboard },
    onSuccess: async (data) => {
      if (data?.dashboard) {
        queryClient.setQueryData(["customer-session"], data.dashboard);
      }
      await queryClient.invalidateQueries({ queryKey: ["customer-session"] });
    },
  });

  const requestCancel = useMutation({
    mutationFn: async (input: {
      id: string;
      targetType?: "vpn_client" | "payg_sub";
      reason?: string;
    }) =>
      (
        await publicApi.post(`/store/customer/services/${encodeURIComponent(input.id)}/cancel-request`, {
          targetType: input.targetType,
          reason: input.reason,
        })
      ).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customer-cancel-requests"] });
    },
  });

  const requestSettlement = useMutation({
    mutationFn: async (input: { amount: number; cardNumber: string; cardHolder?: string }) =>
      (await publicApi.post("/store/customer/wallet/settlement", input)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customer-wallet-settlements"] });
      await queryClient.invalidateQueries({ queryKey: ["customer-wallet"] });
    },
  });

  return {
    ...sessionQuery,
    login,
    logout,
    markNotificationRead,
    markAllNotificationsRead,
    cancelOrder,
    claimService,
    assignServiceCategory,
    hideService,
    requestCancel,
    requestSettlement,
  };
}
