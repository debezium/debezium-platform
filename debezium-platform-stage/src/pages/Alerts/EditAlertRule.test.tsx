import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "../../__test__/unit/test-utils";
import { EditAlertRule } from "./EditAlertRule";
import { AlertRule, NotificationChannel } from "./alertsTypes";

const mockNavigate = vi.fn();
const hoisted = vi.hoisted(() => ({ search: "state=view" }));

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useNavigate: () => mockNavigate,
    useParams: () => ({ ruleId: "14" }),
    useSearchParams: () => [new URLSearchParams(hoisted.search), vi.fn()],
  };
});

vi.mock("@components/FeatureGate", () => ({
  FeatureGate: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../../appLayout/AppContext", () => ({
  useData: () => ({
    darkMode: false,
    navigationCollapsed: false,
    setDarkMode: vi.fn(),
    updateNavigationCollapsed: vi.fn(),
  }),
}));

vi.mock("../../apis/alerts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../apis/alerts")>();
  return {
    ...actual,
    fetchAlertRules: vi.fn(),
    fetchAlertChannels: vi.fn(),
    updateAlertRule: vi.fn(),
  };
});

vi.mock("../../apis/apis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../apis/apis")>();
  return {
    ...actual,
    fetchMonitoringPanels: vi.fn(),
  };
});

import { fetchAlertChannels, fetchAlertRules, updateAlertRule } from "../../apis/alerts";
import { fetchMonitoringPanels } from "../../apis/apis";

const sampleRule: AlertRule = {
  id: 14,
  name: "high-error-rate",
  description: "Any erroneous events over 1m",
  panelId: "source-lag",
  panelTitle: "Source Lag",
  operator: "GREATER_THAN",
  threshold: 30,
  forDuration: 60,
  reduceFunction: "LAST",
  evaluationWindow: 300,
  severity: "CRITICAL",
  enabled: true,
  channels: [{ id: 3, name: "Platform Ops Email", type: "EMAIL" }],
  createdAt: "2026-08-18T07:47:03.921895Z",
  updatedAt: "2026-08-18T07:47:03.921895Z",
};

const sampleChannels: NotificationChannel[] = [
  {
    id: 3,
    name: "Platform Ops Email",
    type: "EMAIL",
    config: { recipients: ["ops@example.com"] },
    enabled: true,
    createdAt: "2026-08-18T07:46:01.158652Z",
    updatedAt: "2026-08-18T07:46:01.158652Z",
  },
];

describe("EditAlertRule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    hoisted.search = "state=view";
    vi.mocked(fetchAlertRules).mockResolvedValue([sampleRule]);
    vi.mocked(fetchAlertChannels).mockResolvedValue(sampleChannels);
    vi.mocked(updateAlertRule).mockResolvedValue({ data: sampleRule });
    vi.mocked(fetchMonitoringPanels).mockResolvedValue({
      data: {
        panels: [
          {
            id: "source-lag",
            title: "Source Lag",
            description: "Source lag in seconds",
            category: "streaming",
            unit: "s",
            visualization: { type: "line", suggestedStep: "15s" },
          },
        ],
      },
    });
  });

  it("opens in view mode and switches to edit", async () => {
    render(<EditAlertRule />);

    expect(await screen.findByRole("heading", { name: "high-error-rate" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /name/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(await screen.findByRole("heading", { name: "Edit alert rule" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /name/i })).toHaveValue("high-error-rate");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("saves changes and returns to view mode", async () => {
    hoisted.search = "state=edit";
    render(<EditAlertRule />);

    const nameInput = await screen.findByRole("textbox", { name: /name/i });
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "high-error-rate-updated");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updateAlertRule).toHaveBeenCalledWith(
        14,
        expect.objectContaining({
          name: "high-error-rate-updated",
          panelId: "source-lag",
          threshold: 30,
        })
      );
    });

    expect(await screen.findByRole("heading", { name: "high-error-rate" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });

  it("shows not found when the rule is missing", async () => {
    vi.mocked(fetchAlertRules).mockResolvedValue([]);
    render(<EditAlertRule />);

    expect(await screen.findByText("Alert rule not found")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back to alert rules" }));
    expect(mockNavigate).toHaveBeenCalledWith("/alerts/rules");
  });
});
