import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { http, HttpResponse } from 'msw';
import { server } from '../../__mocks__/server';
import PipelineLog from "./PipelineLog";
import { useNotification } from "@appContext/AppNotificationContext";
import { render } from '../../__test__/unit/test-utils';
import { API_URL } from "@utils/constants";

const mockRequestFullscreen = vi.fn();
const mockExitFullscreen = vi.fn();
const mockFullscreenElement = vi.fn();

const mockFullscreenMethods = {
  requestFullscreen: { value: mockRequestFullscreen },
  mozRequestFullScreen: { value: mockRequestFullscreen },
  webkitRequestFullScreen: { value: mockRequestFullscreen },
  msRequestFullscreen: { value: mockRequestFullscreen },
};

const mockDocumentFullscreenMethods = {
  exitFullscreen: { value: mockExitFullscreen },
  webkitExitFullscreen: { value: mockExitFullscreen },
  msExitFullscreen: { value: mockExitFullscreen },
};

// fullscreen element getter
Object.defineProperty(document, 'fullscreenElement', {
  get: mockFullscreenElement
});

// Mock the document fullscreen methods
Object.defineProperties(document, mockDocumentFullscreenMethods);

vi.mock("@patternfly/react-log-viewer", () => ({
  LogViewer: ({ data, toolbar, id }: { data: string[]; toolbar: React.ReactNode; id: string }) => {
    return (
      <div
        data-testid="mock-log-viewer"
        id={id}
        ref={(node) => {
          if (node) {
            Object.defineProperties(node, {
              ...mockFullscreenMethods,
              id: { value: id }
            });
          }
        }}
      >
        <div data-testid="mock-log-viewer-toolbar">{toolbar}</div>
        <div data-testid="mock-log-viewer-content">
          {data.map((line, index) => (
            <div key={index} data-testid="log-line">
              {line}
            </div>
          ))}
        </div>
      </div>
    );
  },
  LogViewerSearch: ({ placeholder }: { placeholder: string }) => (
    <input
      type="text"
      placeholder={placeholder}
      aria-label="search"
      data-testid="log-viewer-search"
    />
  ),
}));

vi.mock("@appContext/AppNotificationContext", () => ({
  useNotification: vi.fn(),
}));

// Create a proper mock WebSocket class
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: (() => void) | null = null;
  onopen: (() => void) | null = null;
  readyState = MockWebSocket.OPEN;
  close = vi.fn();
  send = vi.fn();
  url: string;

  constructor(url: string) {
    this.url = url;
  }
}

global.WebSocket = MockWebSocket as unknown as typeof WebSocket;

describe("PipelineLog", () => {
  const mockProps = {
    activeTabKey: "logs",
    pipelineId: "test-pipeline-id",
    pipelineName: "Test Pipeline",
  };

  const mockAddNotification = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useNotification as Mock).mockReturnValue({
      addNotification: mockAddNotification,
    });

    // Add MSW handler for pipeline logs
    server.use(
      http.get(`${API_URL}/api/pipelines/:pipelineId/logs`, () => {
        return new HttpResponse("log line 1\nlog line 2\nlog line 3", {
          headers: {
            'Content-Type': 'text/plain',
          },
        });
      })
    );

    mockRequestFullscreen.mockClear();
    mockExitFullscreen.mockClear();
    mockFullscreenElement.mockReturnValue(null);
  });

  it("renders the loading state when component is mounted", async () => {
    render(<PipelineLog {...mockProps} />);

    expect(screen.getByText("Loading pipeline log")).toBeInTheDocument();

  });

  it("fetches initial logs when tab is active", async () => {
    render(<PipelineLog {...mockProps} />);

    // Wait for logs to be fetched and displayed
    await waitFor(() => {
      const logLines = screen.getAllByTestId("log-line");
      expect(logLines).toHaveLength(3);
    });

    expect(screen.getByTestId("mock-log-viewer")).toBeInTheDocument();
    expect(screen.getByTestId("mock-log-viewer-toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("mock-log-viewer-content")).toBeInTheDocument();

    const logLines = screen.getAllByTestId("log-line");
    expect(logLines[0]).toHaveTextContent("log line 1");
    expect(logLines[1]).toHaveTextContent("log line 2");
    expect(logLines[2]).toHaveTextContent("log line 3");
  });

  it("does not fetch logs when tab is not active", async () => {
    render(<PipelineLog {...mockProps} activeTabKey="details" />);

    // Wait a bit to ensure no fetch happened
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(screen.getByTestId("mock-log-viewer")).toBeInTheDocument();
    expect(screen.queryByTestId("log-line")).not.toBeInTheDocument();
  });

  it("handles download log file click", async () => {
    const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
    const mockRevokeObjectURL = vi.fn();
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;
    
    const mockAnchor = document.createElement('a');
    const mockClick = vi.fn();
    mockAnchor.click = mockClick;
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = vi.fn((tagName: string) => {
      if (tagName === 'a') {
        return mockAnchor;
      }
      return originalCreateElement(tagName);
    }) as typeof document.createElement;

    render(<PipelineLog {...mockProps} />);

    // Wait for initial logs to be displayed
    await waitFor(() => {
      expect(screen.getByTestId("mock-log-viewer")).toBeInTheDocument();
    });

    const downloadButton = screen.getByRole("button", { name: /download log file/i });
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(mockClick).toHaveBeenCalled();
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
  });

  describe("Fullscreen functionality", () => {
    it("enters fullscreen mode when fullscreen button is clicked", async () => {
      render(<PipelineLog {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByTestId("mock-log-viewer")).toBeInTheDocument();
      });

      const fullscreenButton = screen.getByRole("button", { name: /view log viewer in full screen/i });

      const logViewer = screen.getByTestId("mock-log-viewer");

      // Mock that the element has the fullscreen methods
      Object.defineProperties(logViewer, mockFullscreenMethods);

      fireEvent.click(fullscreenButton);

      await waitFor(() => {
        expect(mockRequestFullscreen).toHaveBeenCalled();
      });
    });

    it("updates fullscreen state when fullscreenchange event is fired", async () => {
      render(<PipelineLog {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByTestId("mock-log-viewer")).toBeInTheDocument();
      });

      const logViewer = screen.getByTestId("mock-log-viewer");

      // Simulate entering fullscreen
      mockFullscreenElement.mockReturnValue(logViewer);
      act(() => {
        document.dispatchEvent(new Event('fullscreenchange'));
      });

      // Simulate exiting fullscreen
      mockFullscreenElement.mockReturnValue(null);
      act(() => {
        document.dispatchEvent(new Event('fullscreenchange'));
      });

      const fullscreenButton = screen.getByRole("button", { name: /view log viewer in full screen/i });
      expect(fullscreenButton).toBeInTheDocument();
    });

    it("handles fullscreen API errors gracefully", async () => {
      mockRequestFullscreen.mockRejectedValueOnce(new Error('Fullscreen request failed'));

      render(<PipelineLog {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByTestId("mock-log-viewer")).toBeInTheDocument();
      });

      const fullscreenButton = screen.getByRole("button", { name: /view log viewer in full screen/i });
      const logViewer = screen.getByTestId("mock-log-viewer");
      Object.defineProperties(logViewer, mockFullscreenMethods);

      fireEvent.click(fullscreenButton);

      // Wait for the async rejection to be handled
      await waitFor(() => {
        expect(mockRequestFullscreen).toHaveBeenCalled();
      });

      // Re-query the button after async operation
      const fullscreenButtonAfterError = screen.getByRole("button", { name: /view log viewer in full screen/i });
      expect(fullscreenButtonAfterError).toBeInTheDocument();
      fireEvent.click(fullscreenButtonAfterError);
    });
  });
});
