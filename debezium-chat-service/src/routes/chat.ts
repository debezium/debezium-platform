import { Router, Request, Response } from 'express';
import { config } from '../config';
import { search } from '../context7';
import { buildSystemPrompt } from '../prompt';
import { getLLMProvider } from '../llm/router';
import type { DocSource } from '../llm/base';

interface ChatRequest {
  message: string;
  page_label: string;
  page_hint: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export const chatRouter = Router();

chatRouter.get('/health', (_req: Request, res: Response) => {
  try {
    const provider = getLLMProvider();
    const model = provider.getModelName();
    const status = config.context7.apiKey
      ? 'ok'
      : 'degraded';
    const body: Record<string, string> = {
      status,
      llmProvider: config.llmProvider,
      model,
    };
    if (status === 'degraded') {
      body.message = 'CONTEXT7_API_KEY is not set — doc retrieval disabled';
    }
    res.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      status: 'error',
      message,
    });
  }
});

chatRouter.post('/chat', async (req: Request, res: Response) => {
  const body = req.body as ChatRequest;
  const { message, page_label, page_hint, history } = body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const STREAM_TIMEOUT_MS = 60000; // 60s – force-complete if LLM hangs
  let responded = false;
  let sourcesRef: DocSource[] = [];
  const timeoutId = setTimeout(() => {
    console.warn('[chat] Stream timeout – forcing completion');
    if (!responded) {
      responded = true;
      try {
        if (sourcesRef.length > 0) send({ type: 'sources', docs: sourcesRef });
        send({ type: 'done' });
        res.end();
      } catch (e) {
        console.error('[chat] timeout safeEnd error:', e);
      }
    }
  }, STREAM_TIMEOUT_MS);

  try {
    // 1. Context event
    send({ type: 'context', label: page_label ?? 'Documentation' });

    // 2. Fetch doc chunks from Context7 (query = page_hint + message)
    const query = `${page_hint ?? ''} ${message}`.trim() || message;
    const chunks = await search(query, 5);

    // 3. Build system prompt
    const systemPrompt = buildSystemPrompt(chunks);

    // 4. Build sources for later
    const sources: DocSource[] = chunks.map((c) => ({
      title: c.title,
      url: c.url,
    }));
    sourcesRef = sources;

    // 5. Stream LLM response
    const provider = getLLMProvider();
    const messages = [
      ...(history ?? []),
      { role: 'user' as const, content: message },
    ];

    await provider.streamChat(
      {
        system: systemPrompt,
        messages,
        maxTokens: 2048,
      },
      (token) => send({ type: 'delta', content: token }),
      () => {
        clearTimeout(timeoutId);
        if (responded) return;
        responded = true;
        send({ type: 'sources', docs: sources });
        send({ type: 'done' });
        res.end();
      },
      (err) => {
        clearTimeout(timeoutId);
        console.error('[chat] LLM error:', err.message);
        if (err.stack) console.error(err.stack);
        if (!responded) {
          responded = true;
          send({ type: 'error', message: 'LLM error — check service logs' });
          send({ type: 'done' });
          res.end();
        }
      }
    );
  } catch (err) {
    clearTimeout(timeoutId);
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[chat] error:', error.message);
    if (error.stack) console.error(error.stack);
    if (!responded) {
      responded = true;
      send({ type: 'error', message: error.message });
      send({ type: 'done' });
      res.end();
    }
  }
});
