export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: DocSource[];
  isStreaming?: boolean;
}

export interface DocSource {
  title: string;
  url: string;
}

export interface PageContext {
  label: string;
  hint: string;
}

export interface ChatRequest {
  message: string;
  page_label: string;
  page_hint: string;
  history: Array<{ role: string; content: string }>;
}
