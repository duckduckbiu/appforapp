import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostEditor } from "@/components/posts/PostEditor";

export default function PostCreate() {
  const navigate = useNavigate();

  const handleSuccess = () => {
    navigate("/feed");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 backdrop-blur px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">发布动态</h1>
      </header>

      {/* 编辑器 - 与Feed页面相同的max-w-2xl */}
      <div className="max-w-2xl mx-auto p-4">
        <PostEditor onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
