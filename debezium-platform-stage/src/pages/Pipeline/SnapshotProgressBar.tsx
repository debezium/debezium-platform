import { FC } from "react";
import { Progress } from "@patternfly/react-core";
import { clampPercent, formatPercent } from "./snapshotModel";
import "./snapshotProgress.css";

type SnapshotProgressBarProps = {
  percentage: number | null;
  isPaused?: boolean;
  ariaLabel: string;
  size?: "sm" | "md" | "lg";
};

const SnapshotProgressBar: FC<SnapshotProgressBarProps> = ({
  percentage,
  isPaused = false,
  ariaLabel,
  size = "sm",
}) => {
  if (percentage == null || Number.isNaN(percentage)) {
    return (
      <div
        className={
          isPaused
            ? "snapshot-progress__indeterminate snapshot-progress__indeterminate--paused"
            : "snapshot-progress__indeterminate"
        }
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuetext={ariaLabel}
      >
        <div className="snapshot-progress__indeterminate-bar" />
      </div>
    );
  }

  const clamped = clampPercent(percentage);
  const label = formatPercent(clamped);

  return (
    <Progress
      value={clamped}
      label={label}
      valueText={label}
      measureLocation="outside"
      size={size}
      aria-label={ariaLabel}
    />
  );
};

export default SnapshotProgressBar;
