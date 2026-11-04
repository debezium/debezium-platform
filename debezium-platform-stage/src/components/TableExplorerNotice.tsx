import { Alert, Button } from "@patternfly/react-core";
import { useTranslation } from "react-i18next";

type TableExplorerNoticeProps = {
  reason: "connection" | "unavailable";
  onRetry?: () => void;
};

const TableExplorerNotice: React.FC<TableExplorerNoticeProps> = ({ reason, onRetry }) => {
  const { t } = useTranslation();
  const title =
    reason === "connection"
      ? t("connector.create.tableExplorerNoConnection")
      : t("connector.create.tableExplorerUnavailable");

  return (
    <Alert variant="warning" isInline title={title}>
      {reason === "unavailable" && onRetry ? (
        <Button variant="link" isInline onClick={onRetry}>
          {t("tryAgain")}
        </Button>
      ) : null}
    </Alert>
  );
};

export default TableExplorerNotice;
