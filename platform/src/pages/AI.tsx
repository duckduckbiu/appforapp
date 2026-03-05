import { Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function AI() {
  const [input, setInput] = useState("");

  return (
    <div className="flex flex-col h-full">
      {/* Chat area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Bill.ai 助手</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          用自然语言描述你想要的应用，AI 帮你生成。你也可以问任何问题。
        </p>
        <div className="flex flex-wrap gap-2 mt-6 justify-center">
          {["帮我做一个记账App", "推荐热门应用", "今天有什么新动态"].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setInput(suggestion)}
              className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors text-muted-foreground"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-border p-3 pb-safe">
        <div className="flex gap-2 max-w-2xl mx-auto">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="问我任何事..."
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim()) {
                // Future: send message
                setInput("");
              }
            }}
          />
          <Button size="icon" disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
