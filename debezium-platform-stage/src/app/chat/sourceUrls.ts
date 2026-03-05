/**
 * Transforms source URLs from Context7 (which may return GitHub URLs)
 * to debezium.io documentation URLs.
 */
const DEBEZIUM_DOCS_BASE = "https://debezium.io/documentation/reference/stable";

export function toDebeziumDocUrl(url: string): string {
  if (!url || typeof url !== "string") return url;

  const trimmed = url.trim();
  if (!trimmed) return url;

  if (trimmed.startsWith("https://debezium.io") || trimmed.startsWith("http://debezium.io")) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return `https://debezium.io${trimmed}`;
  }

  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    const path = trimmed.replace(/^\//, "");
    if (path.startsWith("documentation/") || path.startsWith("reference/")) {
      return `https://debezium.io/${path}`;
    }
    return `${DEBEZIUM_DOCS_BASE}/${path}`;
  }

  if (trimmed.includes("github.com") && trimmed.includes("debezium")) {
    return tryConvertGitHubToDebezium(trimmed);
  }

  return url;
}

function tryConvertGitHubToDebezium(githubUrl: string): string {
  try {
    const url = new URL(githubUrl);
    if (url.hostname !== "github.com") return githubUrl;

    const pathMatch = url.pathname.match(
      /\/debezium\/debezium\/blob\/[^/]+\/documentation\/modules\/([^/]+)\/(?:ROOT\/)?pages\/([^.]+)\.adoc/
    );
    if (pathMatch) {
      const [, module, page] = pathMatch;
      const pageSlug = page.replace(/_/g, "-");
      return `${DEBEZIUM_DOCS_BASE}/${module}/${pageSlug}.html`;
    }

    const connectorMatch = url.pathname.match(
      /\/debezium\/debezium\/.*documentation.*connectors\/([^/]+)/
    );
    if (connectorMatch) {
      return `${DEBEZIUM_DOCS_BASE}/connectors/${connectorMatch[1]}.html`;
    }
  } catch {
    /* ignore */
  }

  return `${DEBEZIUM_DOCS_BASE}/index.html`;
}
