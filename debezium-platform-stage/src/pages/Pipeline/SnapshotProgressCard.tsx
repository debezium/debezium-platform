import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Content,
  Flex,
  Label,
  LabelColor,
} from "@patternfly/react-core";
import { FC } from "react";
import { useTranslation } from "react-i18next";
import SnapshotProgressBar from "./SnapshotProgressBar";
import {
  formatDuration,
  type SnapshotProgressResponse,
  type SnapshotType,
} from "./snapshotModel";
import { useSnapshotElapsed } from "./useSnapshotProgress";
import "./snapshotProgress.css";

type SnapshotProgressCardProps = {
  progress: SnapshotProgressResponse;
  onViewDetails: () => void;
};

const typeLabelKey = (type: SnapshotType | null): string =>
  type === "INCREMENTAL"
    ? "pipeline:snapshots.typeIncremental"
    : "pipeline:snapshots.typeInitial";

const SnapshotProgressCard: FC<SnapshotProgressCardProps> = ({
  progress,
  onViewDetails,
}) => {
  const { t } = useTranslation();
  const elapsedSeconds = useSnapshotElapsed(progress);
  const isPaused = progress.status === "PAUSED";
  const duration = formatDuration(elapsedSeconds);
  const globalProgress = progress.globalProgress;
  const percentage = globalProgress?.percentage ?? null;

  return (
    <Card ouiaId="snapshot-progress-card">
      <CardHeader
        actions={{
          actions: (
            <Button variant="link" onClick={onViewDetails}>
              {t("pipeline:snapshots.viewDetails")}
            </Button>
          ),
        }}
      >
        <CardTitle>
          <Flex
            spaceItems={{ default: "spaceItemsSm" }}
            alignItems={{ default: "alignItemsCenter" }}
          >
            <span>
              {isPaused
                ? t("pipeline:snapshots.pausedTitle")
                : t("pipeline:snapshots.inProgressTitle")}
            </span>
            {isPaused && (
              <Label isCompact color={LabelColor.orange}>
                {t("pipeline:snapshots.paused")}
              </Label>
            )}
          </Flex>
        </CardTitle>
      </CardHeader>
      <CardBody>
        <Flex
          alignItems={{ default: "alignItemsCenter" }}
          flexWrap={{ default: "nowrap" }}
          spaceItems={{ default: "spaceItemsMd" }}
        >
          <Content component="p" style={{ margin: 0, whiteSpace: "nowrap" }}>
            {t(typeLabelKey(progress.type))}
          </Content>
          <div className="snapshot-progress__bar">
            <SnapshotProgressBar
              percentage={percentage}
              isPaused={isPaused}
              ariaLabel={
                percentage == null
                  ? t("pipeline:snapshots.unknownProgress")
                  : t("pipeline:snapshots.progressTitle")
              }
            />
          </div>
          {globalProgress && globalProgress.totalTables > 0 && (
            <Content component="p" style={{ margin: 0, whiteSpace: "nowrap" }}>
              {t("pipeline:snapshots.tableCount", {
                completed: globalProgress.completedTables,
                total: globalProgress.totalTables,
              })}
            </Content>
          )}
        </Flex>
        {duration && (
          <Content component="p" className="snapshot-progress__summary">
            {isPaused
              ? t("pipeline:snapshots.pausedAfter", { duration })
              : t("pipeline:snapshots.runningFor", { duration })}
          </Content>
        )}
      </CardBody>
    </Card>
  );
};

export default SnapshotProgressCard;
