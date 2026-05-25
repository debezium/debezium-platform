import { config } from '../config';
import type { ILLMProvider } from './base';
import { createOllamaProvider } from './ollama';
import { createClaudeProvider } from './claude';
import { createOpenAIProvider } from './openai';

/**
 * Returns the ILLMProvider instance based on config.llmProvider.
 * @throws Error if an unknown provider value is set
 */
export function getLLMProvider(): ILLMProvider {
  const provider = config.llmProvider;

  switch (provider) {
    case 'ollama':
      return createOllamaProvider();
    case 'claude':
      return createClaudeProvider();
    case 'openai':
      return createOpenAIProvider();
    default:
      throw new Error(
        `Unknown LLM provider "${provider}". Expected one of: ollama, claude, openai. Check LLM_PROVIDER env var.`
      );
  }
}
