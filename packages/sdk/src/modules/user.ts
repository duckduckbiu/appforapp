/**
 * @billai/app-sdk — User module
 *
 * Provides access to current user information.
 */

import { callPlatform } from "../transport";
import type { UserInfo } from "../types";

/** Get the current user's profile info. */
export async function getInfo(): Promise<UserInfo | null> {
  const res = await callPlatform<UserInfo>("user", "getInfo");
  return res.success ? (res.data ?? null) : null;
}

/**
 * Get a short-lived App Token (JWT) for authenticating requests to this app's backend.
 * The token includes the user's ID and the app ID, signed by the platform.
 *
 * @param appId - The UUID of the app (from the apps table)
 * @returns A signed JWT string valid for 1 hour, or null on failure
 */
export async function getAppToken(appId: string): Promise<string | null> {
  const res = await callPlatform<{ token: string }>("user", "getAppToken", { appId });
  return res.success ? (res.data?.token ?? null) : null;
}
