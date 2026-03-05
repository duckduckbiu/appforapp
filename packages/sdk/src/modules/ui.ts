/**
 * @billai/app-sdk — UI module
 *
 * Request the platform to show UI elements (toasts, dialogs)
 * and retrieve design tokens for theme synchronization.
 */

import { callPlatform } from "../transport";
import type { ThemeTokens, ToastType } from "../types";

/** Ask the platform to display a toast notification. */
export async function showToast(
  message: string,
  type: ToastType = "info"
): Promise<boolean> {
  const res = await callPlatform("ui", "showToast", { message, type });
  return res.success;
}

/** Get the current platform theme tokens (CSS variables). */
export async function getTheme(): Promise<ThemeTokens | null> {
  const res = await callPlatform<ThemeTokens>("ui", "getTheme");
  return res.success ? (res.data ?? null) : null;
}
