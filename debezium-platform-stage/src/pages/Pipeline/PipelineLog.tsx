import {
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
  Button,
  Tooltip,
} from "@patternfly/react-core";
import { DownloadIcon, ExpandIcon } from "@patternfly/react-icons";
import { LogViewer, LogViewerSearch } from "@patternfly/react-log-viewer";
import { API_URL } from "@utils/constants";
import { FC, useEffect, useState } from "react";
import "./PipelineLog.css";
import { useNotification } from "@appContext/AppNotificationContext";
import { fetchFile } from "src/apis/apis";

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

// eslint-disable-next-line no-empty-pattern
const PipelineLog: FC<PipelineLogProps> = ({
  activeTabKey,
  pipelineId,
  pipelineName,
}) => {
  const { addNotification } = useNotification();

  const [logs, setLogs] = useState<string[]>([]);
  // Set to track unique logs
  const logSet = new Set<string>();

  const [isLogLoading, setIsLogLoading] = useState<boolean>(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // useEffect(() => {
  //   const ws = new WebSocket("ws://localhost:8080/api/pipelines/1/logs/stream");
  //   ws.onopen = () => {
  //     console.log("WebSocket connection opened");
  //   };
  //   ws.onmessage = (event) => {
  //     setLogs((prevLogs) => prevLogs + "\n" + event.data); // Append new logs
  //   };
  //   ws.onerror = (error) => {
  //     console.error("WebSocket error:", error);
  //   };
  //   ws.onclose = () => {
  //     console.log("WebSocket connection closed");
  //   };
  //   return () => {
  //     if (ws.readyState === WebSocket.OPEN) {
  //       ws.close();
  //     }
  //   };
  // }, []);

  useEffect(() => {
    let ws: WebSocket;
    // Fetch initial logs via HTTP
    fetch(`${API_URL}/api/pipelines/${pipelineId}/logs`)
      .then((response) => response.text())
      .then((initialLogs) => {
        const initialLogLines = initialLogs.split("\n");

        // Add initial logs to the set and state
        initialLogLines.forEach((logLine) => {
          if (logLine && !logSet.has(logLine)) {
            logSet.add(logLine);
          }
        });

        setLogs((prevLogs) => [...prevLogs, ...initialLogLines]);
        
        // open WebSocket for real-time updates
        const webSocketURL = API_URL.replace(/^https?/, "ws")
        ws = new WebSocket(`${webSocketURL}/api/pipelines/${pipelineId}/logs/stream`);

        ws.onmessage = (event) => {
          const newLogs = event.data.split("\n");

          const newUniqueLogs = newLogs.filter((logLine: string) => {
            // Only keep logs that haven't been added
            return logLine && !logSet.has(logLine);
          });

          // Add new unique logs to the set and append them to the logs array
          newUniqueLogs.forEach((logLine: string) => {
            logSet.add(logLine);
          });

          if (newUniqueLogs.length > 0) {
            setLogs((prevLogs) => [...prevLogs, ...newUniqueLogs]);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
        };

        ws.onclose = () => {
          console.log("WebSocket connection closed");
        };
      })
      .catch((error) => console.error("Error fetching initial logs:", error));

    // Cleanup
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  const downloadLogFile = async (
    pipelineId: string | undefined,
    pipelineName: string
  ) => {
    setIsLogLoading(true);

    if (pipelineId === undefined) {
      addNotification(
        "danger",
        "Download Failed",
        "Failed to download logs: Pipeline ID is missing"
      );
      setIsLogLoading(false);
      return;
    }

    // Fetch the file as a Blob
    const response = await fetchFile(
      `${API_URL}/api/pipelines/${pipelineId}/logs`
    );

    if ("error" in response) {
      addNotification(
        "danger",
        `Download Failed log for ${pipelineName}`,
        `Failed to download logs: ${response.error}`
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

    setIsLogLoading(false);
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

  const logViewToolbar = (
    <Toolbar>
      <ToolbarContent>
        <ToolbarGroup align={{ default: "alignStart" }}>
          <ToolbarGroup variant="filter-group">
            <ToolbarItem>
              <LogViewerSearch placeholder="Search" minSearchChars={0} />
            </ToolbarItem>
          </ToolbarGroup>
        </ToolbarGroup>
        <ToolbarGroup align={{ default: "alignEnd" }}>
          <ToolbarGroup variant="action-group-plain">
            <ToolbarItem>
              <Tooltip content="Download Log File">
                <Button
                  variant="plain"
                  isDisabled={isLogLoading}
                  aria-label="edit"
                  icon={<DownloadIcon />}
                  onClick={() => downloadLogFile(pipelineId, pipelineName)}
                />
              </Tooltip>
            </ToolbarItem>

            <ToolbarItem>
              <Tooltip content="Full screen">
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
  // console.log(logs);

  return (
    <div className="pipeline_log">
      <LogViewer
        key={activeTabKey}
        // Fix with Patternfly team to be able to include id in LogViewer
        // id="pipeline-log-view"
        hasLineNumbers={true}
        data={logs}
        theme={"light"}
        toolbar={logViewToolbar}
        height={(isFullScreen && "100%") || "calc(100vh - 350px)"}
      />
    </div>
  );
};

export default PipelineLog;
