import {
  CodeBlock,
  CodeBlockCode,
  Content,
  Flex,
  FlexItem,
} from "@patternfly/react-core";
import type { ChatMessage } from "./types";
import { SourceLinks } from "./SourceLinks";

function stripMarkdownHeadings(text: string): string {
  return text.replace(/^#+\s*/gm, "").trim();
}

function parseInlineFormatting(text: string): React.ReactNode {
  const cleaned = stripMarkdownHeadings(text);
  const segments: React.ReactNode[] = [];
  let remaining = cleaned;
  let key = 0;

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/^(`[^`]+`)/);
    const boldMatch = remaining.match(/^(\*\*[^*]+\*\*)/);
    const italicMatch = remaining.match(/^(\*[^*]+\*)/);

    if (codeMatch) {
      segments.push(
        <code
          key={key++}
          style={{
            backgroundColor: "rgba(0,0,0,0.06)",
            padding: "2px 6px",
            borderRadius: 4,
            fontFamily: "monospace",
            fontSize: "0.9em",
          }}
        >
          {codeMatch[1].slice(1, -1)}
        </code>
      );
      remaining = remaining.slice(codeMatch[1].length);
    } else if (boldMatch) {
      segments.push(
        <strong key={key++}>{boldMatch[1].slice(2, -2)}</strong>
      );
      remaining = remaining.slice(boldMatch[1].length);
    } else if (italicMatch) {
      segments.push(
        <em key={key++}>{italicMatch[1].slice(1, -1)}</em>
      );
      remaining = remaining.slice(italicMatch[1].length);
    } else {
      const nextSpecial = remaining.search(/[`*]/);
      const chunk = nextSpecial >= 0 ? remaining.slice(0, nextSpecial) : remaining;
      if (chunk) segments.push(chunk);
      if (nextSpecial >= 0) {
        remaining = remaining.slice(nextSpecial);
        if (!chunk && remaining.length > 0) {
          segments.push(remaining[0]);
          remaining = remaining.slice(1);
        }
      } else {
        remaining = "";
      }
    }
  }
  return <>{segments}</>;
}

function parseContentWithCodeBlocks(content: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  let partKey = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textSegment = stripMarkdownHeadings(content.slice(lastIndex, match.index));
      const paragraphs = textSegment.split(/\n\n+/);
      paragraphs.forEach((para) => {
        if (para.trim()) {
          const lines = para.split("\n");
          parts.push(
            <Content
              key={`text-${partKey++}`}
              component="p"
              style={{ marginBottom: 8, lineHeight: 1.6 }}
            >
              {lines.map((line, i) => (
                <span key={i}>
                  {parseInlineFormatting(line)}
                  {i < lines.length - 1 && <br />}
                </span>
              ))}
            </Content>
          );
        }
      });
    }
    parts.push(
      <CodeBlock key={`code-${partKey++}`} style={{ marginTop: 8, marginBottom: 8 }}>
        <CodeBlockCode id={`code-${partKey}`}>{match[2].trim()}</CodeBlockCode>
      </CodeBlock>
    );
    lastIndex = codeBlockRegex.lastIndex;
  }

  if (lastIndex < content.length) {
    const textSegment = stripMarkdownHeadings(content.slice(lastIndex));
    const paragraphs = textSegment.split(/\n\n+/);
    paragraphs.forEach((para) => {
      if (para.trim()) {
        const lines = para.split("\n");
        parts.push(
          <Content
            key={`text-${partKey++}`}
            component="p"
            style={{ marginBottom: 8, lineHeight: 1.6 }}
          >
            {lines.map((line, i) => (
              <span key={i}>
                {parseInlineFormatting(line)}
                {i < lines.length - 1 && <br />}
              </span>
            ))}
          </Content>
        );
      }
    });
  }

  if (parts.length === 0 && content) {
    return [
      <Content key="text-0" component="p" style={{ lineHeight: 1.6 }}>
        {parseInlineFormatting(stripMarkdownHeadings(content))}
      </Content>,
    ];
  }

  return parts;
}

export interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <Flex
      direction={{ default: "column" }}
      gap={{ default: "gapSm" }}
      style={{
        alignSelf: "flex-start",
        maxWidth: "100%",
      }}
    >
      <FlexItem>
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            backgroundColor: isUser
              ? "var(--pf-v5-global--primary-color--100)"
              : "#f5f5f5",
            color: isUser ? "var(--pf-v5-global--Color--light-100)" : "var(--pf-v5-global--Color--100)",
          }}
        >
          {message.content ? parseContentWithCodeBlocks(message.content) : null}
          {message.isStreaming && (
            <span
              style={{
                borderRight: "2px solid currentColor",
                paddingRight: 2,
                marginLeft: 2,
                display: "inline-block",
              }}
              aria-hidden
            >
              &#8203;
            </span>
          )}
        </div>
      </FlexItem>
      {!message.isStreaming && message.sources && message.sources.length > 0 && (
        <FlexItem>
          <SourceLinks sources={message.sources} />
        </FlexItem>
      )}
    </Flex>
  );
}
