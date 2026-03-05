/**
 * 简单的内存速率限制器
 * 用于 Edge Functions 防止 DDoS 攻击
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// 内存存储（每个 Edge Function 实例独立）
const requestCounts = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  windowMs: number;      // 时间窗口（毫秒）
  maxRequests: number;   // 窗口内最大请求数
}

// 默认配置：每分钟 60 次请求
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 60,
};

/**
 * 检查是否超过速率限制
 * @param clientId 客户端标识（通常是 IP 或 userId）
 * @param config 速率限制配置
 * @returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(
  clientId: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = requestCounts.get(clientId);

  // 如果没有记录或已过期，创建新记录
  if (!entry || now > entry.resetAt) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    requestCounts.set(clientId, newEntry);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // 检查是否超限
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // 增加计数
  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * 获取客户端 IP（从请求头中提取）
 */
export function getClientIP(req: Request): string {
  // 尝试从各种代理头获取真实 IP
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  
  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }
  
  const cfConnectingIP = req.headers.get("cf-connecting-ip");
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // 默认返回 unknown
  return "unknown";
}

/**
 * 速率限制中间件 - 返回 429 响应
 */
export function rateLimitResponse(resetAt: number, corsHeaders: Record<string, string>): Response {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return new Response(
    JSON.stringify({ 
      error: "Too many requests", 
      message: "请求过于频繁，请稍后重试",
      retryAfter 
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  );
}

/**
 * 清理过期的速率限制记录（可选，用于内存管理）
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of requestCounts.entries()) {
    if (now > entry.resetAt) {
      requestCounts.delete(key);
    }
  }
}
