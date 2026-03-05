/**
 * @billai/app-sdk — Wallet module
 *
 * Provides access to the current user's Bill.ai wallet.
 * Apps can query balances and charge users for in-app transactions.
 */

import { callPlatform } from "../transport";

export interface WalletInfo {
  balance: number;
}

export interface ChargeResult {
  success: boolean;
  newBalance: number;
  error?: string;
}

/** Get the current user's wallet balance (in credits). */
export async function getBalance(): Promise<WalletInfo | null> {
  const res = await callPlatform<WalletInfo>("wallet", "getBalance");
  return res.success ? (res.data ?? null) : null;
}

/**
 * Charge the user a specified number of credits for an in-app transaction.
 *
 * @param amount - Number of credits to charge (must be > 0)
 * @param description - Human-readable transaction description
 * @returns Charge result with new balance, or null on failure
 */
export async function charge(
  amount: number,
  description: string
): Promise<ChargeResult | null> {
  const res = await callPlatform<ChargeResult>("wallet", "charge", {
    amount,
    description,
  });
  return res.success ? (res.data ?? null) : null;
}
