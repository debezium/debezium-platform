export interface DocSource {
  title: string;
  url: string;
}

export interface LLMStreamOptions {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
}

export interface ILLMProvider {
  streamChat(
    options: LLMStreamOptions,
    onToken: (token: string) => void,
    onDone: () => void,
    onError: (err: Error) => void
  ): Promise<void>;

  getModelName(): string;
}
