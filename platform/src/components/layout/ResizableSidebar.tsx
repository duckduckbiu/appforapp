import { useState, useRef, useEffect, useCallback } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";

interface ResizableSidebarProps {
  children: React.ReactNode;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  collapseThreshold?: number;
}

export function ResizableSidebar({
  children,
  minWidth = 180,
  maxWidth = 320,
  defaultWidth = 192, // 12rem
  collapseThreshold = 100,
}: ResizableSidebarProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const handleRef = useRef<HTMLDivElement>(null);
  const sidebarWrapperRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number>();
  const { setOpen, state } = useSidebar();

  // Cache DOM reference on mount
  useEffect(() => {
    sidebarWrapperRef.current = document.querySelector('.group\\/sidebar-wrapper') as HTMLElement;
  }, []);

  // Disable transitions during resize for smooth dragging
  useEffect(() => {
    const wrapper = sidebarWrapperRef.current;
    if (!wrapper) return;
    
    const sidebarElements = wrapper.querySelectorAll('[data-sidebar], .peer > div');
    
    if (isResizing) {
      sidebarElements.forEach(el => {
        (el as HTMLElement).style.transition = 'none';
      });
    } else {
      sidebarElements.forEach(el => {
        (el as HTMLElement).style.transition = '';
      });
    }
  }, [isResizing]);

  useEffect(() => {
    if (state === "collapsed") {
      setWidth(defaultWidth);
    }
  }, [state, defaultWidth]);

  // Throttled CSS variable update using RAF
  const updateWidth = useCallback((newWidth: number) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    rafRef.current = requestAnimationFrame(() => {
      sidebarWrapperRef.current?.style.setProperty('--sidebar-width', `${newWidth}px`);
    });
  }, []);

  // Update CSS variable for sidebar width
  useEffect(() => {
    if (state !== "collapsed") {
      sidebarWrapperRef.current?.style.setProperty('--sidebar-width', `${width}px`);
    } else {
      sidebarWrapperRef.current?.style.setProperty('--sidebar-width', '3rem');
    }
  }, [width, state]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      
      // If dragging too far left, collapse the sidebar
      if (newWidth < collapseThreshold) {
        setOpen(false);
        setIsResizing(false);
        return;
      }

      // Constrain width between min and max
      const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
      
      // Update CSS variable directly without triggering React re-render
      updateWidth(clampedWidth);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = e.clientX;
        const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
        
        // Persist the final width to state
        if (newWidth >= collapseThreshold) {
          setWidth(clampedWidth);
        }
      }
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      
      // Clean up RAF
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isResizing, minWidth, maxWidth, collapseThreshold, setOpen, updateWidth]);

  if (state === "collapsed") {
    return <>{children}</>;
  }

  return (
    <div className="relative h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
      
      {/* Resize Handle - positioned absolutely within the sidebar */}
      <div
        ref={handleRef}
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute top-0 right-0 bottom-0 w-1 cursor-col-resize z-50",
          "hover:bg-primary/10 active:bg-primary/20 transition-colors",
          "flex items-center justify-center group",
          isResizing && "bg-primary/20"
        )}
      >
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="h-3 w-3 text-primary/50" />
        </div>
      </div>
    </div>
  );
}
