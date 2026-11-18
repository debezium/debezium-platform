import {
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
  Button,
  Tooltip,
  Skeleton,
  Alert,
} from "@patternfly/react-core";
import { BellIcon, DownloadIcon, ExpandIcon } from "@patternfly/react-icons";
import { LogViewer, LogViewerSearch } from "@patternfly/react-log-viewer";
import { NOTIFICATION_SERVICE_LOG_PREFIX } from "@utils/constants";
import { FC, useEffect, useState, useRef, useContext } from "react";
import "./PipelineLog.css";
import { useNotification } from "@appContext/AppNotificationContext";
import { fetchFile, fetchText } from "src/apis/apis";
import { useTranslation } from "react-i18next";
import { LogViewerToolbarContext } from "@patternfly/react-log-viewer/dist/esm/LogViewer/LogViewerContext";
import { pipelineLogsPath, pipelineLogsStreamPath } from "../../apis/endpoints";
import { subscribeToEventStream } from "../../apis/streams";

// Extend the Document interface
interface ExtendedDocument extends Document {
  mozFullScreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
  msExitFullscreen?: () => void;
}

// Extend the HTMLElement interface
interface ExtendedHTMLElement extends HTMLElement {
  mozRequestFullScreen?: () => Promise<void>;
  webkitRequestFullScreen?: (keyboardInput?: number) => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

interface PipelineLogProps {
  activeTabKey: string;
  pipelineId: string | undefined;
  pipelineName: string;
}

// Maximum number of log lines to keep in memory
const MAX_LOG_LINES = 1000;

type LogStreamStatus = "reconnecting" | "stopped";

const PipelineLog: FC<PipelineLogProps> = ({
  activeTabKey,
  pipelineId,
  pipelineName,
}) => {
  const { addNotification } = useNotification();
  const { t } = useTranslation();

  const [logs, setLogs] = useState<string[]>([]);
  // Lines currently on screen. Updated with the set so a second chunk in the
  // same turn sees the trim from the first.
  const logsRef = useRef<string[]>([]);
  // Set to track unique logs still on screen.
  const logSet = useRef(new Set<string>());

  const [isLogDownloading, setIsLogDownloading] = useState<boolean>(false);
  const [isLogStreamLoading, setIsLogStreamLoading] = useState<boolean>(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [notificationLogToggle, setNotificationLogToggle] = useState(false);
  const [streamStatus, setStreamStatus] = useState<LogStreamStatus | null>(null);

  useEffect(() => {
    if (activeTabKey !== "logs" || !pipelineId) return;

    // Leaving the tab or changing pipeline runs this effect's cleanup, which
    // closes the stream — no separate teardown effect is needed.
    let cancelled = false;
    let closeStream: (() => void) | undefined;
    setIsLogStreamLoading(true);
    setStreamStatus(null);

    /**
     * Keeps the newest MAX_LOG_LINES and remembers only those. The set drops a
     * replay of lines still on screen. Lines that have scrolled off are
     * forgotten, so the same text can show again and the set stays bounded.
     */
    const publishLogs = (lines: string[]) => {
      const kept =
        lines.length > MAX_LOG_LINES
          ? lines.slice(lines.length - MAX_LOG_LINES)
          : lines;
      logsRef.current = kept;
      logSet.current = new Set(kept);
      setLogs(kept);
    };

    /** Appends lines not seen yet, keeping only the newest MAX_LOG_LINES. */
    const appendLogLines = (chunk: string) => {
      const newUniqueLogs = chunk
        .split("\n")
        .filter((logLine) => logLine && !logSet.current.has(logLine));

      if (newUniqueLogs.length === 0) return;
      publishLogs([...logsRef.current, ...newUniqueLogs]);
    };

    fetchText(pipelineLogsPath(pipelineId))
      .then((initialLogs) => {
        if (cancelled) return;

        // Reset logs when the tab becomes active. Dedup the snapshot with a
        // local set, then remember only the lines that stay on screen.
        const seen = new Set<string>();
        const uniqueInitialLogs = initialLogs.split("\n").filter((logLine) => {
          if (!logLine || seen.has(logLine)) return false;
          seen.add(logLine);
          return true;
        });

        publishLogs(uniqueInitialLogs);
        setIsLogStreamLoading(false);

        // The stream replays history before tailing, so most of its first
        // messages repeat what the fetch above already showed. `logSet` drops
        // them, which is also what makes a reconnect idempotent.
        closeStream = subscribeToEventStream(pipelineLogsStreamPath(pipelineId), {
          onOpen: () => {
            if (!cancelled) setStreamStatus(null);
          },
          onMessage: (data) => {
            setIsLogStreamLoading(false);
            appendLogLines(data);
          },
          onRetry: () => {
            if (!cancelled) setStreamStatus("reconnecting");
          },
          onError: (error) => {
            console.error("Pipeline log stream failed:", error);
            setIsLogStreamLoading(false);
            if (!cancelled) setStreamStatus("stopped");
          },
        });
      })
      .catch((error) => {
        console.error("Error fetching initial logs:", error);
        if (!cancelled) setIsLogStreamLoading(false);
      });

    return () => {
      cancelled = true;
      closeStream?.();
      setIsLogStreamLoading(false);
      setStreamStatus(null);
    };
  }, [activeTabKey, pipelineId]);

  const downloadLogFile = async (
    pipelineId: string | undefined,
    pipelineName: string
  ) => {
    setIsLogDownloading(true);

    if (pipelineId === undefined) {
      addNotification(
        "danger",
        t('statusMessage:download.failedTitle'),
        t('statusMessage:download.pipelineLogFail'),
      );
      setIsLogDownloading(false);
      return;
    }

    // Fetch the file as a Blob
    const response = await fetchFile(
      pipelineLogsPath(pipelineId)
    );

    if ("error" in response) {
      addNotification(
        "danger",
        t('statusMessage:download.failedTitle'),
        t('statusMessage:download.failedDescription', { val: `${pipelineName} : response.error` }),
      );
    } else {
      const url = window.URL.createObjectURL(response);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pipeline.log";
      document.body.appendChild(a);
      a.click();

      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }

    setIsLogDownloading(false);
  };

  // Listening escape key on full screen mode.
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen =
        document.fullscreenElement ||
        (document as ExtendedDocument).mozFullScreenElement ||
        (document as ExtendedDocument).webkitFullscreenElement ||
        (document as ExtendedDocument).msFullscreenElement;

      setIsFullScreen(!!isFullscreen);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("msfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "msfullscreenchange",
        handleFullscreenChange
      );
    };
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onExpandClick = (_event: React.MouseEvent<HTMLElement>) => {
    const element = document.querySelector(
      "#pipeline-log-view"
    ) as ExtendedHTMLElement | null;

    if (element) {
      if (!isFullScreen) {
        if (element.requestFullscreen) {
          element.requestFullscreen();
        } else if (element.mozRequestFullScreen) {
          element.mozRequestFullScreen();
        } else if (element.webkitRequestFullScreen) {
          element.webkitRequestFullScreen();
        } else if (element.msRequestFullscreen) {
          element.msRequestFullscreen();
        }
        setIsFullScreen(true);
      } else {
        const doc = document as ExtendedDocument;
        if (doc.exitFullscreen) {
          doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) {
          doc.msExitFullscreen();
        }
        setIsFullScreen(false);
      }
    }
  };

  const LogViewToolbar: FC = () => {
    const logViewerToolbarContext = useContext(LogViewerToolbarContext);
    const defaultRowInFocus = { rowIndex: -1, matchIndex: 0 };

    const applySearchText = (value: string) => {
      if (!logViewerToolbarContext) {
        return;
      }
      logViewerToolbarContext.setSearchedInput(value);

      if (!value) {
        logViewerToolbarContext.setCurrentSearchedItemCount(0);
        logViewerToolbarContext.setSearchedWordIndexes([]);
        logViewerToolbarContext.setRowInFocus(defaultRowInFocus);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleManualChange = (_event: React.FormEvent<HTMLInputElement>, _value: string) => {
      if (notificationLogToggle) {
        setNotificationLogToggle(false);
      }
    };

    const handleManualClear = () => {
      if (notificationLogToggle) {
        setNotificationLogToggle(false);
      }
    };

    const handleNotificationToggle = () => {
      const nextToggle = !notificationLogToggle;
      const nextSearch = nextToggle ? NOTIFICATION_SERVICE_LOG_PREFIX : "";
      setNotificationLogToggle(nextToggle);
      applySearchText(nextSearch);
    };

    return (
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <LogViewerSearch
              placeholder={t('searchPlaceholder')}
              minSearchChars={3}
              onChange={handleManualChange}
              onClear={handleManualClear}
            />
          </ToolbarItem>

          <ToolbarItem style={{ marginRight: "10px" }}>
            <Tooltip content={!notificationLogToggle ? t('pipeline:logs.notification.showTooltip') : t('pipeline:logs.notification.hideTooltip')}>
              <Button
                variant="stateful"
                isDisabled={isLogDownloading}
                aria-label="grep notification log"
                icon={<BellIcon />}
                onClick={handleNotificationToggle}
                state={!notificationLogToggle ? "read" : "unread"}
              >
                {t('pipeline:logs.notification.grepNotification')}
              </Button>
            </Tooltip>
          </ToolbarItem>

          <ToolbarGroup align={{ default: "alignEnd" }}>
            <ToolbarGroup variant="action-group-plain">
              <ToolbarItem>
                <Tooltip content={t('pipeline:logs.download')}>
                  <Button
                    variant="plain"
                    isDisabled={isLogDownloading}
                    aria-label="download log file"
                    icon={<DownloadIcon />}
                    onClick={() => downloadLogFile(pipelineId, pipelineName)}
                  />
                </Tooltip>
              </ToolbarItem>

              <ToolbarItem>
                <Tooltip content={t('pipeline:logs.fullScreen')}>
                  <Button
                    variant="plain"
                    aria-label="View log viewer in full screen"
                    icon={<ExpandIcon />}
                    onClick={onExpandClick}
                  />
                </Tooltip>
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarGroup>
        </ToolbarContent>
      </Toolbar>
    );
  };

  return (
    <div className="pipeline_log">
      {isLogStreamLoading ?
      <>
        <Skeleton width="25%" screenreaderText="Loading pipeline log" />
        <br />
        <Skeleton width="33%" />
        <br />
        <Skeleton width="50%" />
        <br />
        <Skeleton width="66%" />
        <br />
        <Skeleton width="75%" />
        <br />
        <Skeleton />
      </> : 
      <>
      {streamStatus && (
        <Alert
          variant="warning"
          isInline
          title={t(`pipeline:logs.stream.${streamStatus}`)}
        />
      )}
      <LogViewer
        key={activeTabKey}
        {...({ id: "pipeline-log-view" } as
          {
            id: string;
          })}
        hasLineNumbers={false}
        isTextWrapped={false}
        data={logs}
        theme={"light"}
        toolbar={<LogViewToolbar />}
        height={(isFullScreen && "100%") || "calc(100vh - 350px)"}
      />
      </>}
    </div>
  );
};

export default PipelineLog;