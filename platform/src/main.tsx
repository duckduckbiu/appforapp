import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";
import '@/lib/i18n';

// 配置 React Query 全局缓存策略
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,        // 5分钟内数据视为新鲜，不重新请求
      gcTime: 1000 * 60 * 30,          // 缓存保留30分钟（原 cacheTime）
      refetchOnWindowFocus: false,     // 避免窗口焦点切换时频繁刷新
      refetchOnReconnect: true,        // 网络重连时刷新
      retry: 3,                        // 失败重试3次
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // 指数退避
    },
    mutations: {
      retry: 2,                        // 变更操作重试2次
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
