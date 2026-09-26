export type QuotaLedgerAction =
  | 'ADMIN_INITIAL_ALLOCATION'
  | 'ADMIN_RECHARGE'
  | 'ADMIN_DEDUCTION';

/** Ledger label when the reseller spends one shared bucket on every assigned panel. */
export const GLOBAL_POOL_TX_DESCRIPTION = 'Global pool — all panels';

/**
 * Super-admin balance edits must keep totalAssigned in sync with the net grant.
 * Credits increase totalAssigned; deductions decrease it so "used = assigned − balance"
 * only reflects reseller-created consumption (not revoked mistaken grants).
 */
export function nextQuotaLedger(
  existing: { balance: number; totalAssigned: number } | null,
  nextBalance: number,
): {
  balance: number;
  totalAssigned: number | undefined;
  totalAssignedIncrement: number;
  diff: number;
  action: QuotaLedgerAction | null;
} {
  const balance = Math.max(0, Math.round(Number(nextBalance) || 0));
  if (!existing) {
    return {
      balance,
      totalAssigned: balance,
      totalAssignedIncrement: 0,
      diff: balance,
      action: balance > 0 ? 'ADMIN_INITIAL_ALLOCATION' : null,
    };
  }
  const diff = balance - existing.balance;
  return {
    balance,
    totalAssigned: undefined,
    totalAssignedIncrement: diff,
    diff,
    action: diff > 0 ? 'ADMIN_RECHARGE' : diff < 0 ? 'ADMIN_DEDUCTION' : null,
  };
}
