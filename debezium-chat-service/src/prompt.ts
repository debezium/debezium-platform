import type { Context7Chunk } from './context7';

const SYSTEM_PROMPT = `You are a documentation assistant for the Debezium Platform.
Answer questions using ONLY the provided documentation context below.

Rules:
- Be concise and direct. Get to the answer quickly.
- Do NOT use markdown headings (# or ##). Use **bold** for emphasis on property names only.
- Always wrap config property names in backticks e.g. \`snapshot.mode\`, \`signaling.collection.name\`.
- Use short paragraphs. Bullet points for lists of options or steps.
- If the answer is not in the context, say "This is not covered in the documentation" — do not guess.
- Do not repeat the user's question back. Start with the answer.

DOCUMENTATION CONTEXT:
{chunks}`;

/**
 * Assembles the system prompt string from Context7 chunks and page context.
 * Replaces {chunks} with chunks joined by "\\n---\\n" or fallback text if empty.
 */
export function buildSystemPrompt(chunks: Context7Chunk[]): string {
  const chunksText =
    chunks.length > 0
      ? chunks.map((c) => c.content).join('\n---\n')
      : 'No documentation context available.';
  return SYSTEM_PROMPT.replace('{chunks}', chunksText);
}
