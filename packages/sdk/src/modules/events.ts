/**
 * @billai/app-sdk — Events module
 *
 * Subscribe to platform-initiated events (theme changes, etc.).
 */

import { onEvent, offEvent } from "../transport";
import type { EventCallback } from "../types";

/** Listen for a specific event type from the platform. */
export function on(type: string, callback: EventCallback): void {
  onEvent(type, callback);
}

/** Stop listening for a specific event type. */
export function off(type: string, callback: EventCallback): void {
  offEvent(type, callback);
}
