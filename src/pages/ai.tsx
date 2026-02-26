import { Bot } from "lucide-react";
import { ChatInterface } from "@/components/ai-assistant/chat-interface";

export function AIPage() {
  return (
    <div className="flex h-full flex-col -m-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Bot className="h-6 w-6 text-accent" />
        <div>
          <h1 className="text-lg font-bold text-text-primary">
            AI Security Assistant
          </h1>
          <p className="text-xs text-text-muted">
            Powered by CyberForge AI -- vulnerability analysis, log review, and
            remediation guidance
          </p>
        </div>
      </div>

      {/* Chat area fills remaining space */}
      <div className="flex-1 overflow-hidden">
        <ChatInterface />
      </div>
    </div>
  );
}
