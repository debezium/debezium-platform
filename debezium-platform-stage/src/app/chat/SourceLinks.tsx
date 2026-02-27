import { Button, Content } from "@patternfly/react-core";
import type { DocSource } from "./types";
import { toDebeziumDocUrl } from "./sourceUrls";

const MAX_SOURCES = 5;

export interface SourceLinksProps {
  sources?: DocSource[];
}

export function SourceLinks({ sources }: SourceLinksProps) {
  if (!sources || sources.length === 0) return null;

  const displaySources = sources.slice(0, MAX_SOURCES);

  return (
    <div style={{ marginTop: 8 }}>
      <Content component="small" style={{ color: "var(--pf-v5-global--Color--200)" }}>
        📄 Sources
      </Content>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
        {displaySources.map((source, i) => (
          <Button
            key={i}
            variant="link"
            isInline
            component="a"
            href={toDebeziumDocUrl(source.url)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {source.title}
          </Button>
        ))}
      </div>
    </div>
  );
}
