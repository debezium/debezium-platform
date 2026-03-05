import { Label } from "@patternfly/react-core";
import { useChatContext } from "./ChatContextProvider";
import { defaultContext } from "./pageContextMap";

export function ContextChip() {
  const pageContext = useChatContext();

  if (pageContext.label === defaultContext.label) {
    return null;
  }

  return (
    <Label color="blue" style={{ marginBottom: 8 }}>
      📍 {pageContext.label}
    </Label>
  );
}
