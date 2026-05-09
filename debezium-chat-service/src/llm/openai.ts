import axios from 'axios';
import { Readable } from 'stream';
import { config } from '../config';
import type { ILLMProvider, LLMStreamOptions } from './base';

function parseSSEStream(
  stream: Readable,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: Error) => void
): Promise<void> {
  return new Promise((resolve) => {
    let buffer = '';
    stream.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            onDone();
            resolve();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (typeof content === 'string' && content) {
              onToken(content);
            }
            if (parsed.choices?.[0]?.finish_reason) {
              onDone();
              resolve();
              return;
            }
          } catch {
            // Skip malformed
          }
        }
      }
    });
    stream.on('end', () => {
      onDone();
      resolve();
    });
    stream.on('error', (err) => {
      onError(err);
      resolve();
    });
  });
}

export function createOpenAIProvider(): ILLMProvider {
  const { apiKey, model } = config.openai;

  return {
    async streamChat(options, onToken, onDone, onError) {
      if (!apiKey) {
        onError(new Error('OPENAI_API_KEY is not set'));
        return;
      }
      try {
        const messages = [
          { role: 'system' as const, content: options.system },
          ...options.messages.map((m) => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          })),
        ];

        const response = await axios({
          method: 'POST',
          url: 'https://api.openai.com/v1/chat/completions',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          data: {
            model,
            messages,
            stream: true,
            max_tokens: options.maxTokens ?? 1024,
          },
          responseType: 'stream',
        });

        const stream = response.data as Readable;
        await parseSSEStream(stream, onToken, onDone, onError);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error(String(err));
        console.error('[openai] stream error:', error.message);
        if (error.stack) console.error(error.stack);
        onError(error);
      }
    },
    getModelName() {
      return model;
    },
  };
}
