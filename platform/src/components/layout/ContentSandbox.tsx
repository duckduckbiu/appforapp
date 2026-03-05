import { ReactNode, createContext, useContext, useEffect, useRef } from "react";
import { ErrorBoundary } from "./ErrorBoundary";

interface ContentSandboxProps {
  children: ReactNode;
}

// 读取 portal 容器
export const ContentPortalContext = createContext<HTMLDivElement | null>(null);
// 设置 portal 容器的 setter
export const SetContentPortalContext = createContext<(el: HTMLDivElement | null) => void>(() => {});

export function ContentSandbox({ children }: ContentSandboxProps) {
  const setPortalContainer = useContext(SetContentPortalContext);
  const portalRef = useRef<HTMLDivElement>(null);
  
  // 组件挂载时注册 portal 容器
  useEffect(() => {
    if (portalRef.current) {
      setPortalContainer(portalRef.current);
    }
    return () => {
      setPortalContainer(null);
    };
  }, [setPortalContainer]);

  return (
    <div className="w-full h-full relative">
      {/* 滚动内容区域 */}
      <div className="w-full h-full overflow-y-auto">
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>
      {/* Portal 容器，在滚动内容外部，用于渲染弹窗等覆盖层 */}
      <div ref={portalRef} className="absolute inset-0 pointer-events-none z-[60]" />
    </div>
  );
}
