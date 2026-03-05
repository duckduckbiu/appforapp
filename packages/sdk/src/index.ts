/**
 * @billai/app-sdk
 *
 * SDK for apps running inside the Bill.ai platform.
 * Apps use this SDK to communicate with the platform via iframe postMessage.
 *
 * Usage:
 *   import billai from "@billai/app-sdk";
 *   await billai.init();
 *   const user = await billai.user.getInfo();
 */

import { initSDK } from "./transport";
import * as user from "./modules/user";
import * as ui from "./modules/ui";
import * as events from "./modules/events";
import * as wallet from "./modules/wallet";

export type {
  SDKRequest,
  SDKResponse,
  SDKEvent,
  EventCallback,
  UserInfo,
  ThemeTokens,
  ToastType,
  AppManifest,
  PlatformMethods,
  AppMethods,
} from "./types";

const billai = {
  /** Initialize SDK connection. Must be called once before using other methods. */
  init: initSDK,
  /** User information */
  user,
  /** UI interactions (toast, theme) */
  ui,
  /** Platform event subscriptions */
  events,
  /** Wallet: balance and in-app payments */
  wallet,
};

export default billai;
