import { Flex, FlexItem } from "@patternfly/react-core";
import { useRef, useEffect } from "react";
import type { ChatMessage } from "./types";
import { MessageBubble } from "./MessageBubble";

export interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        overflowY: "auto",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        backgroundColor: "#ffffff",
      }}
    >
      <Flex direction={{ default: "column" }} gap={{ default: "gapMd" }}>
        {messages.map((msg) => (
          <FlexItem key={msg.id}>
            <MessageBubble message={msg} />
          </FlexItem>
        ))}
      </Flex>
    </div>
  );
}
