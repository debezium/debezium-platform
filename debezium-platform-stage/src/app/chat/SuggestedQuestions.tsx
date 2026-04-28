import { Button, Flex, FlexItem } from "@patternfly/react-core";
import { useChatContext } from "./ChatContextProvider";

const suggestedQuestions: Record<string, string[]> = {
  "Creating a Source": [
    "What connector types are supported?",
    "What database permissions are required?",
    "How do I configure SSL for PostgreSQL?",
  ],
  "Creating a Destination": [
    "What destination types are supported?",
    "How do I configure Kafka as a destination?",
  ],
  Transforms: [
    "How do I filter out specific tables?",
    "How do I flatten nested change events?",
    "How do I rename fields in the event?",
  ],
  "Pipeline Details": [
    "What does pipeline status STOPPED mean?",
    "How does Debezium handle schema changes?",
  ],
  "Creating a Pipeline": [
    "How do I create a pipeline?",
    "What components do I need?",
  ],
  "Source Details": [
    "How do I edit a source?",
    "What is snapshot.mode?",
  ],
  "Destination Details": [
    "How do I configure a Kafka sink?",
  ],
  default: [
    "How do I set up a PostgreSQL source?",
    "What is Change Data Capture?",
    "How does snapshotting work?",
  ],
};

export interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

export function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  const { label } = useChatContext();
  const questions = suggestedQuestions[label] ?? suggestedQuestions.default;

  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
      {questions.map((q, i) => (
        <FlexItem key={i}>
          <Button
            variant="tertiary"
            onClick={() => onSelect(q)}
            style={{ justifyContent: "flex-start", textAlign: "left" }}
          >
            {q}
          </Button>
        </FlexItem>
      ))}
    </Flex>
  );
}
