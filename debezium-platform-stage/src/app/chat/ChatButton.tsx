import { Button, Badge } from "@patternfly/react-core";
import { OutlinedCommentsIcon } from "@patternfly/react-icons";
import { useState, useEffect } from "react";

const CHAT_SEEN_KEY = "chat-seen";

export interface ChatButtonProps {
  onClick: () => void;
}

export function ChatButton({ onClick }: ChatButtonProps) {
  const [showBadge, setShowBadge] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(CHAT_SEEN_KEY);
    setShowBadge(!seen);
  }, []);

  const handleClick = () => {
    localStorage.setItem(CHAT_SEEN_KEY, "true");
    setShowBadge(false);
    onClick();
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
      }}
    >
      {showBadge && (
        <Badge
          isRead={false}
          style={{ position: "absolute", top: -4, right: -4, zIndex: 1 }}
        >
          1
        </Badge>
      )}
      <Button
        variant="primary"
        icon={<OutlinedCommentsIcon />}
        onClick={handleClick}
        aria-label="Open chat assistant"
      >
        Chat
      </Button>
    </div>
  );
}
