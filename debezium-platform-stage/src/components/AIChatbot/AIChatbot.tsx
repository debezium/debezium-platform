import React, { useState, useRef, useEffect } from 'react';
import {
  Button,
  TextInput,
  Stack,
  StackItem,
  Card,
  CardBody,
  Title,
  Split,
  SplitItem,
  Icon,
  Spinner,
} from '@patternfly/react-core';
import {
  CommentIcon,
  TimesIcon,
  PaperPlaneIcon,
  RobotIcon,
  TrashIcon,
} from '@patternfly/react-icons';
import { useChatbot } from './AIChatbotContext';
import './AIChatbot.css';

const AIChatbot: React.FC = () => {
  const { isOpen, messages, isLoading, connectionStatus, toggleChatbot, sendMessage, clearMessages } = useChatbot();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (inputValue.trim() && connectionStatus === 'connected') {
      await sendMessage(inputValue);
      setInputValue('');
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Connection Error';
      default:
        return '';
    }
  };

  const getConnectionStatusClass = () => {
    switch (connectionStatus) {
      case 'connecting':
        return 'chatbot-status-connecting';
      case 'connected':
        return 'chatbot-status-connected';
      case 'disconnected':
      case 'error':
        return 'chatbot-status-error';
      default:
        return '';
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) {
    return (
      <div className="chatbot-toggle-button">
        <Button
          variant="primary"
          onClick={toggleChatbot}
          icon={<CommentIcon />}
          aria-label="Open AI Assistant"
          className="chatbot-fab"
        >
          AI Assistant
        </Button>
      </div>
    );
  }

  return (
    <div className="chatbot-container">
      <Card className="chatbot-card">
        <CardBody className="chatbot-card-body">
          <Stack hasGutter>
            {/* Header */}
            <StackItem className="chatbot-header">
              <Split hasGutter>
                <SplitItem>
                  <Icon size="md" className="chatbot-icon">
                    <RobotIcon />
                  </Icon>
                </SplitItem>
                <SplitItem isFilled>
                  <Title headingLevel="h2" size="lg">
                    AI Assistant
                  </Title>
                  <div className="chatbot-subtitle-container">
                    <small className="chatbot-subtitle">
                      Powered by Debezium Platform
                    </small>
                    <span className={`chatbot-status ${getConnectionStatusClass()}`}>
                      {getConnectionStatusText()}
                    </span>
                  </div>
                </SplitItem>
                <SplitItem>
                  <Button
                    variant="plain"
                    onClick={clearMessages}
                    aria-label="Clear messages"
                    icon={<TrashIcon />}
                    size="sm"
                  />
                </SplitItem>
                <SplitItem>
                  <Button
                    variant="plain"
                    onClick={toggleChatbot}
                    aria-label="Close chatbot"
                    icon={<TimesIcon />}
                  />
                </SplitItem>
              </Split>
            </StackItem>

            {/* Messages */}
            <StackItem isFilled className="chatbot-messages">
              <Stack hasGutter>
                {messages.map((message) => (
                  <StackItem key={message.id}>
                    <div
                      className={`chatbot-message ${
                        message.role === 'user' ? 'chatbot-message-user' : 'chatbot-message-bot'
                      }`}
                    >
                      <div className="chatbot-message-header">
                        <small className="chatbot-message-role">
                          {message.role === 'user' ? 'You' : 'AI Assistant'}
                        </small>
                        <small className="chatbot-message-time">
                          {message.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </small>
                      </div>
                      <div className="chatbot-message-content">{message.content}</div>
                    </div>
                  </StackItem>
                ))}
                {isLoading && (
                  <StackItem>
                    <div className="chatbot-message chatbot-message-bot">
                      <div className="chatbot-typing-indicator">
                        <Spinner size="md" />
                        <small>AI is thinking...</small>
                      </div>
                    </div>
                  </StackItem>
                )}
                <div ref={messagesEndRef} />
              </Stack>
            </StackItem>

            {/* Input */}
            <StackItem className="chatbot-input-container">
              <Split hasGutter>
                <SplitItem isFilled>
                  <TextInput
                    type="text"
                    value={inputValue}
                    onChange={(_event, value) => setInputValue(value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Ask me anything about Debezium Platform..."
                    aria-label="Message input"
                    isDisabled={isLoading}
                  />
                </SplitItem>
                <SplitItem>
                  <Button
                    variant="primary"
                    onClick={handleSendMessage}
                    isDisabled={!inputValue.trim() || isLoading || connectionStatus !== 'connected'}
                    icon={<PaperPlaneIcon />}
                    aria-label="Send message"
                  />
                </SplitItem>
              </Split>
            </StackItem>
          </Stack>
        </CardBody>
      </Card>
    </div>
  );
};

export default AIChatbot;
