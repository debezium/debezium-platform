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
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta) {
              const text = parsed.delta.type === 'text_delta' ? parsed.delta.text : parsed.delta.text ?? '';
              if (text) onToken(text);
            }
            if (parsed.type === 'message_stop') {
              onDone();
              resolve();
              return;
            }
            if (parsed.type === 'error') {
              onError(new Error(parsed.error?.message ?? 'Anthropic API error'));
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

export function createClaudeProvider(): ILLMProvider {
  const { apiKey, model } = config.anthropic;

  return {
    async streamChat(options, onToken, onDone, onError) {
      if (!apiKey) {
        onError(new Error('ANTHROPIC_API_KEY is not set'));
        return;
      }
      try {
        const messages = options.messages
          .filter((m) => m.content && typeof m.content === 'string')
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }));

        if (messages.length === 0 || messages[messages.length - 1]?.role !== 'user') {
          onError(new Error('Last message must be from user'));
          return;
        }

        const response = await axios({
          method: 'POST',
          url: 'https://api.anthropic.com/v1/messages',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          data: {
            model,
            max_tokens: options.maxTokens ?? 1024,
            system: options.system,
            messages,
            stream: true,
          },
          responseType: 'stream',
        });

        const stream = response.data as Readable;
        await parseSSEStream(stream, onToken, onDone, onError);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error(String(err));
        console.error('[claude] stream error:', error.message);
        if (axios.isAxiosError(err) && err.response) {
          const data = err.response.data;
          if (typeof data === 'string') {
            console.error('[claude] response body:', data);
          } else if (data && typeof data.pipe === 'function') {
            const chunks: Buffer[] = [];
            data.on('data', (c: Buffer) => chunks.push(c));
            data.on('end', () =>
              console.error('[claude] 400 body:', Buffer.concat(chunks).toString())
            );
          } else if (data) {
            console.error('[claude] response body:', JSON.stringify(data));
          }
        }
        if (error.stack) console.error(error.stack);
        onError(error);
      }
    },
    getModelName() {
      return model;
    },
  };
}
