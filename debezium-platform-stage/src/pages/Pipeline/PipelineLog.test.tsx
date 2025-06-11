import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
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

// Mock fetch and WebSocket
const mockFetch = vi.fn();

// Create a mock WebSocket constructor
const MockWebSocket = vi.fn() as unknown as Mock & typeof WebSocket;
Object.defineProperties(MockWebSocket, {
  CONNECTING: { value: 0 },
  OPEN: { value: 1 },
  CLOSING: { value: 2 },
  CLOSED: { value: 3 },
});

const mockWsInstance = {
  onmessage: null,
  onerror: null,
  onclose: null,
  close: vi.fn(),
  readyState: WebSocket.OPEN,
};

MockWebSocket.mockImplementation(() => mockWsInstance as unknown as WebSocket);

global.fetch = mockFetch;
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

    mockFetch.mockResolvedValueOnce({
      text: () => Promise.resolve("log line 1\nlog line 2\nlog line 3"),
    });

    mockRequestFullscreen.mockClear();
    mockExitFullscreen.mockClear();
    mockFullscreenElement.mockReturnValue(null);
  });

  it("renders the log viewer component", async () => {
    render(<PipelineLog {...mockProps} />);

    expect(screen.getByTestId("mock-log-viewer")).toBeInTheDocument();
    expect(screen.getByTestId("mock-log-viewer-toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("mock-log-viewer-content")).toBeInTheDocument();
    
    expect(screen.getByTestId("log-viewer-search")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download log file/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view log viewer in full screen/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /grep notification log/i })).toBeInTheDocument();
  });

//   it("fetches initial logs when tab is active", async () => {
//     render(<PipelineLog {...mockProps} />);

//     await waitFor(() => {
//       const expectedUrl = `${API_URL}/api/pipelines/${mockProps.pipelineId}/logs`;
//       expect(mockFetch).toHaveBeenCalledWith(expect.any(Request));
//       const request = mockFetch.mock.calls[0][0] as Request;
//       expect(request.url).toBe(expectedUrl);
//     });

//     // Verify that logs are displayed
//     const logLines = screen.getAllByTestId("log-line");
//     expect(logLines).toHaveLength(3);
//     expect(logLines[0]).toHaveTextContent("log line 1");
//     expect(logLines[1]).toHaveTextContent("log line 2");
//     expect(logLines[2]).toHaveTextContent("log line 3");
//   });

  it("does not fetch logs when tab is not active", () => {
    render(<PipelineLog {...mockProps} activeTabKey="details" />);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("handles download log file click", async () => {
    const mockBlob = new Blob(["test log content"], { type: "text/plain" });
    mockFetch.mockResolvedValueOnce(mockBlob);

    render(<PipelineLog {...mockProps} />);

    const downloadButton = screen.getByRole("button", { name: /download log file/i });
    fireEvent.click(downloadButton);

    await waitFor(() => {
      const expectedUrl = `${API_URL}/api/pipelines/${mockProps.pipelineId}/logs`;
      expect(mockFetch).toHaveBeenCalledWith(expect.any(Request));
      const request = mockFetch.mock.calls[0][0] as Request;
      expect(request.url).toBe(expectedUrl);
    });
  });

  describe("Fullscreen functionality", () => {
    it("enters fullscreen mode when fullscreen button is clicked", async () => {
      render(<PipelineLog {...mockProps} />);

      const fullscreenButton = screen.getByRole("button", { name: /view log viewer in full screen/i });
      
      const logViewer = screen.getByTestId("mock-log-viewer");
      
      // Mock that the element has the fullscreen methods
      Object.defineProperties(logViewer, mockFullscreenMethods);
      
      fireEvent.click(fullscreenButton);

      await waitFor(() => {
        expect(mockRequestFullscreen).toHaveBeenCalled();
      });
    });

    it("exits fullscreen mode when fullscreen button is clicked in fullscreen", async () => {
      render(<PipelineLog {...mockProps} />);

      const logViewer = screen.getByTestId("mock-log-viewer");
      
      // First enter fullscreen
      Object.defineProperties(logViewer, mockFullscreenMethods);
      const fullscreenButton = screen.getByRole("button", { name: /view log viewer in full screen/i });
      
      // Click to enter fullscreen
      fireEvent.click(fullscreenButton);
      await waitFor(() => {
        expect(mockRequestFullscreen).toHaveBeenCalled();
      });

      mockFullscreenElement.mockReturnValue(logViewer);
      
      // Simulate fullscreen change event
      act(() => {
        document.dispatchEvent(new Event('fullscreenchange'));
      });

      mockRequestFullscreen.mockClear();
      mockExitFullscreen.mockClear();

      // Click to exit fullscreen
      fireEvent.click(fullscreenButton);

      await waitFor(() => {
        expect(mockExitFullscreen).toHaveBeenCalled();
      });
    });

    it("updates fullscreen state when fullscreenchange event is fired", async () => {
      render(<PipelineLog {...mockProps} />);

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

      const fullscreenButton = screen.getByRole("button", { name: /view log viewer in full screen/i });
      const logViewer = screen.getByTestId("mock-log-viewer");
      Object.defineProperties(logViewer, mockFullscreenMethods);

      fireEvent.click(fullscreenButton);

      expect(fullscreenButton).toBeInTheDocument();
      fireEvent.click(fullscreenButton);
    });
  });
});
