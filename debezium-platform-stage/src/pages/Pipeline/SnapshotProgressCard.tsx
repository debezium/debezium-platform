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
import type { SnapshotProgressResponse, SnapshotType } from "../../apis/snapshots";
import { formatDuration } from "./snapshotModel";
import { useSnapshotElapsed } from "./useSnapshotProgress";
import "./snapshotProgress.css";
import { RhUiPauseCircleIcon, RhUiRunningIcon } from "@patternfly/react-icons";

type SnapshotProgressCardProps = {
  progress: SnapshotProgressResponse;
  onViewDetails: () => void;
};

const typeLabelKey = (type: SnapshotType | null): string => {
  if (type === "INCREMENTAL") return "pipeline:snapshots.typeIncremental";
  if (type === "INITIAL") return "pipeline:snapshots.typeInitial";
  return "pipeline:snapshots.typeBlocking";
};

const SnapshotProgressCard: FC<SnapshotProgressCardProps> = ({
  progress,
  onViewDetails,
}) => {
  const { t } = useTranslation();
  const elapsedSeconds = useSnapshotElapsed(progress);
  const isPaused = progress.status === "PAUSED";
  const isRunning = progress.status === "RUNNING";
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
              {t("pipeline:snapshots.snapshotTitle")}
            </span>
            {isPaused && (
              <Label color={LabelColor.orange} icon={<RhUiPauseCircleIcon />}>
                {t("pipeline:snapshots.paused")}
              </Label>
            )}
            {isRunning && (
              <Label color={LabelColor.blue} icon={<RhUiRunningIcon />}>
                {t("pipeline:snapshots.running")}
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
          <Content component="p" style={{ marginBottom: 0, whiteSpace: "nowrap" }}>
            {t(typeLabelKey(progress.type))}
          </Content>
          <div className="snapshot-progress__bar">
            <SnapshotProgressBar
              measureLocation="inside"
              percentage={percentage}
              isPaused={isPaused}
              // size="md"
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
              ? t("pipeline:snapshots.pausedAfter")
              : t("pipeline:snapshots.runningFor")}
            {" "}<strong>{duration}</strong>
          </Content>
        )}
      </CardBody>
    </Card>
  );
};

export default SnapshotProgressCard;
