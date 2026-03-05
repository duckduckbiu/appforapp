import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check } from "lucide-react";
import { MultiImageMaskEditor, type MultiImageMaskConfig } from "@/components/posts/MultiImageMaskEditor";

interface MaskSettingsState {
  imagePreviews: string[];
  maskConfig: MultiImageMaskConfig;
  returnPath: string;
}

export default function MaskSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isInitialized, setIsInitialized] = useState(false);
  const [config, setConfig] = useState<MultiImageMaskConfig>({
    unlockMode: "unified",
    unifiedPrice: 10,
    images: [],
  });
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [returnPath, setReturnPath] = useState("/post/create");

  useEffect(() => {
    const state = location.state as MaskSettingsState | null;
    console.log('[MaskSettings] location.state:', state);
    
    if (state && state.imagePreviews && state.imagePreviews.length > 0) {
      console.log('[MaskSettings] Setting imagePreviews:', state.imagePreviews.length);
      setImagePreviews(state.imagePreviews);
      setConfig(state.maskConfig);
      setReturnPath(state.returnPath);
      setIsInitialized(true);
    } else {
      console.log('[MaskSettings] No valid state, navigating back');
      // 没有状态，返回上一页
      navigate(-1);
    }
  }, [location.state, navigate]);

  const handleSave = () => {
    // 返回并传递配置
    navigate(returnPath, {
      state: {
        maskConfig: config,
        fromMaskSettings: true,
      },
      replace: true,
    });
  };

  const handleCancel = () => {
    navigate(-1);
  };

  const hasMaskRegions = config.images.some(img => img.regions.length > 0);

  // 等待初始化完成
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">付费观看设置</h1>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasMaskRegions}
          size="sm"
          className="gap-1"
        >
          <Check className="h-4 w-4" />
          完成
        </Button>
      </div>

      {/* 打码编辑器 */}
      <MultiImageMaskEditor
        imagePreviews={imagePreviews}
        config={config}
        onConfigChange={setConfig}
      />
    </div>
  );
}
