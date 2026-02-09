import { Button } from "@patternfly/react-core";
import { ExternalLinkAltIcon } from "@patternfly/react-icons";
import { useTranslation } from "react-i18next";
import { useDocDrawer } from "./DocDrawer";

interface ContextualHelpProps {
  href: string;
  label?: string;
}

const ContextualHelp: React.FC<ContextualHelpProps> = ({ href, label }) => {
  const { t } = useTranslation();
  const { openDoc } = useDocDrawer();

  const displayLabel = label || t("helpTopic.readMoreInDocs");

  return (
    <Button
      variant="link"
      isInline
      icon={<ExternalLinkAltIcon />}
      iconPosition="end"
      onClick={() => openDoc(href, displayLabel)}
    >
      {displayLabel}
    </Button>
  );
};

export default ContextualHelp;
