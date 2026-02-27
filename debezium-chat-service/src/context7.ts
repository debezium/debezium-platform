import axios from 'axios';
import { config } from './config';

export interface Context7Chunk {
  content: string;
  url: string;
  title: string;
}

/** Context7 API response structures (from OpenAPI) */
interface InfoSnippet {
  pageId: string;
  breadcrumb?: string;
  content: string;
  contentTokens?: number;
}

interface CodeExample {
  language: string;
  code: string;
}

interface CodeSnippet {
  codeTitle: string;
  codeDescription?: string;
  codeId: string;
  pageTitle: string;
  codeList?: CodeExample[];
}

interface Context7Response {
  codeSnippets?: CodeSnippet[];
  infoSnippets?: InfoSnippet[];
}

/**
 * Fetches documentation context from the Context7 API.
 * @param query - Natural language query (e.g. page_hint + message combined)
 * @param topK - Maximum number of chunks to return
 * @returns Array of chunks with content, url, title. Returns empty array on error.
 */
export async function search(
  query: string,
  topK: number
): Promise<Context7Chunk[]> {
  const { apiKey, libraryId, baseUrl } = config.context7;

  if (!apiKey) {
    console.error('[context7] CONTEXT7_API_KEY is not set');
    return [];
  }

  if (!query.trim()) {
    return [];
  }

  try {
    const url = `${baseUrl.replace(/\/$/, '')}/api/v2/context`;
    const response = await axios.get<Context7Response>(url, {
      params: {
        libraryId,
        query: query.trim(),
        type: 'json',
      },
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const chunks: Context7Chunk[] = [];

    const data = response.data;

    if (data.infoSnippets) {
      for (const s of data.infoSnippets) {
        chunks.push({
          content: s.content ?? '',
          url: s.pageId ?? '',
          title: s.breadcrumb ?? s.pageId ?? 'Documentation',
        });
      }
    }

    if (data.codeSnippets) {
      for (const s of data.codeSnippets) {
        const codeContent =
          s.codeList?.[0]?.code ??
          s.codeDescription ??
          `${s.codeTitle}: ${s.pageTitle}`;
        chunks.push({
          content: codeContent,
          url: s.codeId ?? '',
          title: s.codeTitle ?? s.pageTitle ?? 'Code',
        });
      }
    }

    return chunks.slice(0, topK);
  } catch (err) {
    const message = axios.isAxiosError(err)
      ? `${err.response?.status ?? err.code}: ${err.message}`
      : err instanceof Error
        ? err.message
        : String(err);
    console.error('[context7] API call failed:', message);
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    return [];
  }
}
