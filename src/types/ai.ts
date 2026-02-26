export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  stream?: boolean;
  context?: Record<string, unknown>;
}

export interface ChatResponse {
  message: string;
  model: string;
  tokens_used?: number;
}

export interface StreamToken {
  token: string;
  done: boolean;
  model?: string;
  error?: string;
}

export interface AnalysisRequest {
  content: string;
  task: "vulnerability" | "log" | "report" | "remediation";
  context?: Record<string, unknown>;
}

export interface AnalysisResponse {
  analysis: string;
  model: string;
}

export interface AiStatus {
  configured: boolean;
  provider: "anthropic" | "openai" | "ollama";
  model: string;
}
