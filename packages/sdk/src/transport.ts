/**
 * @billai/app-sdk — Transport layer
 *
 * Uses Penpal v6 `connect()` + `WindowMessenger` to establish
 * a connection with the parent platform window.
 * All SDK module calls go through `callPlatform()`.
 */

import { connect, WindowMessenger, type RemoteProxy } from "penpal";
import type { PlatformMethods, SDKResponse, SDKEvent, AppMethods, EventCallback } from "./types";

let connection: RemoteProxy<PlatformMethods> | null = null;
const eventListeners = new Map<string, Set<EventCallback>>();

/**
 * Initialize the SDK by connecting to the parent platform.
 * Must be called once before using any SDK methods.
 */
export async function initSDK(): Promise<void> {
  if (connection) return; // already initialized

  const messenger = new WindowMessenger({
    remoteWindow: window.parent,
    allowedOrigins: ["*"],
  });

  const penpalConnection = connect<PlatformMethods>({
    messenger,
    methods: {
      // Platform can push events to the app
      handleEvent(event: SDKEvent) {
        const listeners = eventListeners.get(event.type);
        if (listeners) {
          listeners.forEach((cb) => cb(event));
        }
        // Also notify wildcard listeners
        const wildcardListeners = eventListeners.get("*");
        if (wildcardListeners) {
          wildcardListeners.forEach((cb) => cb(event));
        }
      },
    } satisfies AppMethods,
  });

  connection = await penpalConnection.promise;
}

/**
 * Call a platform method via the SDK protocol.
 */
export async function callPlatform<T = unknown>(
  module: string,
  method: string,
  params?: Record<string, unknown>
): Promise<SDKResponse<T>> {
  if (!connection) {
    return {
      success: false,
      error: { code: "SDK_NOT_INITIALIZED", message: "Call billai.init() first" },
    };
  }

  try {
    const response = await connection.handleSDKRequest(module, method, params);
    return response as SDKResponse<T>;
  } catch (err) {
    return {
      success: false,
      error: {
        code: "TRANSPORT_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * Subscribe to platform events.
 */
export function onEvent(type: string, callback: EventCallback): void {
  if (!eventListeners.has(type)) {
    eventListeners.set(type, new Set());
  }
  eventListeners.get(type)!.add(callback);
}

/**
 * Unsubscribe from platform events.
 */
export function offEvent(type: string, callback: EventCallback): void {
  const listeners = eventListeners.get(type);
  if (listeners) {
    listeners.delete(callback);
    if (listeners.size === 0) {
      eventListeners.delete(type);
    }
  }
}
