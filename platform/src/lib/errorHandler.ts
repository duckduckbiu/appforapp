import { toast } from "@/hooks/use-toast";

/**
 * 统一错误处理工具
 * 用于在整个应用中一致地处理和显示错误
 */

export interface ErrorHandlerOptions {
  title?: string;
  showToast?: boolean;
  logToConsole?: boolean;
  customMessage?: string;
}

/**
 * 处理错误并显示用户友好的提示
 */
export function handleError(
  error: unknown,
  options: ErrorHandlerOptions = {}
): void {
  const {
    title = "操作失败",
    showToast = true,
    logToConsole = true,
    customMessage,
  } = options;

  // 解析错误信息
  const errorMessage = customMessage || parseErrorMessage(error);

  // 记录到控制台
  if (logToConsole) {
    console.error(`[${title}]`, error);
  }

  // 显示Toast提示
  if (showToast) {
    toast({
      variant: "destructive",
      title,
      description: errorMessage,
    });
  }
}

/**
 * 解析错误对象，返回用户友好的错误信息
 */
export function parseErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as any).message === "string"
  ) {
    return (error as any).message;
  }

  return "发生未知错误，请稍后重试";
}

/**
 * 异步操作包装器，自动处理错误
 */
export async function withErrorHandler<T>(
  operation: () => Promise<T>,
  options: ErrorHandlerOptions = {}
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    handleError(error, options);
    return null;
  }
}

/**
 * 网络错误处理
 */
export function handleNetworkError(error: unknown): void {
  handleError(error, {
    title: "网络错误",
    customMessage: "网络连接失败，请检查网络后重试",
  });
}

/**
 * 数据库错误处理
 */
export function handleDatabaseError(error: unknown, operation: string): void {
  handleError(error, {
    title: "数据库错误",
    customMessage: `${operation}失败，请稍后重试`,
  });
}

/**
 * 权限错误处理
 */
export function handlePermissionError(error: unknown): void {
  handleError(error, {
    title: "权限不足",
    customMessage: "您没有权限执行此操作",
  });
}

/**
 * 验证错误处理
 */
export function handleValidationError(message: string): void {
  handleError(message, {
    title: "验证失败",
    showToast: true,
  });
}
