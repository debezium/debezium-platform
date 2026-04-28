import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT ?? '8100', 10),
  llmProvider: process.env.LLM_PROVIDER ?? 'ollama',

  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://ollama:11434',
    model: process.env.OLLAMA_MODEL ?? 'llama3.1',
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.OPENAI_MODEL ?? 'gpt-4o',
  },

  context7: {
    apiKey: process.env.CONTEXT7_API_KEY ?? '',
    libraryId: process.env.CONTEXT7_LIBRARY_ID ?? '/debezium/debezium',
    baseUrl: process.env.CONTEXT7_BASE_URL ?? 'https://context7.com',
  },
} as const;
