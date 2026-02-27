import {
  Alert,
  AlertActionCloseButton,
  Button,
  Flex,
  FlexItem,
  TextArea,
  Title,
} from "@patternfly/react-core";
import { TimesIcon } from "@patternfly/react-icons";
import { useState } from "react";
import { useChat } from "./useChat";
import { ContextChip } from "./ContextChip";
import { MessageList } from "./MessageList";
import { SuggestedQuestions } from "./SuggestedQuestions";

export interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const { messages, sendMessage, isLoading, error, setError } = useChat();
  const [inputValue, setInputValue] = useState("");

  const handleSend = () => {
    if (inputValue.trim() && !isLoading) {
      sendMessage(inputValue.trim());
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        height: "100vh",
        width: window.innerWidth < 768 ? "100vw" : 400,
        maxWidth: 400,
        zIndex: 9998,
        backgroundColor: "#ffffff",
        boxShadow: "-4px 0 12px rgba(0,0,0,0.15)",
        display: "flex",
        flexDirection: "column",
        transform: "translateX(0)",
        transition: "transform 300ms ease",
      }}
    >
      <Flex
        direction={{ default: "row" }}
        justifyContent={{ default: "justifyContentSpaceBetween" }}
        alignItems={{ default: "alignItemsCenter" }}
        style={{ padding: 16, borderBottom: "1px solid var(--pf-v5-global--BorderColor--100)" }}
      >
        <FlexItem>
          <Title headingLevel="h2" size="lg">
            Debezium Docs Assistant
          </Title>
        </FlexItem>
        <FlexItem>
          <Button variant="plain" icon={<TimesIcon />} onClick={onClose} aria-label="Close chat" />
        </FlexItem>
      </Flex>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, backgroundColor: "#ffffff" }}>
          <Flex
            direction={{ default: "column" }}
            style={{
              height: "100%",
              padding: 16,
              backgroundColor: "#ffffff",
            }}
          >
            <FlexItem>
              <ContextChip />
            </FlexItem>
            {error && (
              <FlexItem>
              <Alert
                variant="warning"
                title="Chat unavailable"
                actionClose={
                  <AlertActionCloseButton onClose={() => setError(null)} />
                }
              >
                {error}
              </Alert>
              </FlexItem>
            )}
            <FlexItem
              grow={{ default: "grow" }}
              style={{ minHeight: 0, display: "flex", flexDirection: "column" }}
            >
              <MessageList messages={messages} />
            </FlexItem>
            {messages.length === 0 && (
              <FlexItem style={{ padding: 16 }}>
                <SuggestedQuestions onSelect={handleSuggestedQuestion} />
              </FlexItem>
            )}
            <FlexItem>
              <Flex direction={{ default: "row" }} gap={{ default: "gapSm" }}>
                <FlexItem grow={{ default: "grow" }}>
                  <TextArea
                    value={inputValue}
                    onChange={(_, v) => setInputValue(v)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a question..."
                    disabled={isLoading}
                    resizeOrientation="vertical"
                    rows={2}
                  />
                </FlexItem>
                <FlexItem>
                  <Button
                    variant="primary"
                    onClick={handleSend}
                    isDisabled={!inputValue.trim() || isLoading}
                  >
                    Send
                  </Button>
                </FlexItem>
              </Flex>
            </FlexItem>
          </Flex>
      </div>
    </div>
  );
}
