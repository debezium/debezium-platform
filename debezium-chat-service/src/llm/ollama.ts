import axios from 'axios';
import { Readable } from 'stream';
import { config } from '../config';
import type { ILLMProvider, LLMStreamOptions } from './base';

function readNdjsonStream(
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
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          const content = parsed.message?.content;
          if (typeof content === 'string' && content) {
            onToken(content);
          }
          if (parsed.done) {
            onDone();
            resolve();
            return;
          }
        } catch {
          // Skip malformed lines
        }
      }
    });
    stream.on('end', () => {
      if (!buffer.trim()) return;
      try {
        const parsed = JSON.parse(buffer);
        const content = parsed.message?.content;
        if (typeof content === 'string' && content) onToken(content);
      } catch {
        // Ignore
      }
      onDone();
      resolve();
    });
    stream.on('error', (err) => {
      onError(err);
      resolve();
    });
  });
}

export function createOllamaProvider(): ILLMProvider {
  const { baseUrl, model } = config.ollama;

  return {
    async streamChat(options, onToken, onDone, onError) {
      try {
        const messages = [
          { role: 'system' as const, content: options.system },
          ...options.messages,
        ];

        const response = await axios({
          method: 'POST',
          url: `${baseUrl}/api/chat`,
          data: {
            model,
            stream: true,
            messages,
          },
          responseType: 'stream',
        });

        const stream = response.data as Readable;
        await readNdjsonStream(stream, onToken, onDone, onError);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error(String(err));
        console.error('[ollama] stream error:', error.message);
        if (error.stack) console.error(error.stack);
        onError(error);
      }
    },
    getModelName() {
      return model;
    },
  };
}
