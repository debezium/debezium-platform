import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "../../__test__/unit/test-utils";
import { CreateAlertRule } from "./CreateAlertRule";
import { AlertRule, NotificationChannel } from "./alertsTypes";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useNavigate: () => mockNavigate,
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
    createAlertRule: vi.fn(),
  };
});

vi.mock("../../apis/apis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../apis/apis")>();
  return {
    ...actual,
    fetchMonitoringPanels: vi.fn(),
  };
});

import { createAlertRule, fetchAlertChannels, fetchAlertRules } from "../../apis/alerts";
import { fetchMonitoringPanels } from "../../apis/apis";

const existingRule: AlertRule = {
  id: 14,
  name: "high-error-rate",
  description: "Any erroneous events over 1m",
  panelId: "erroneous-events",
  panelTitle: "Erroneous Events Rate",
  operator: "GREATER_THAN",
  threshold: 0,
  forDuration: 60,
  reduceFunction: "AVG",
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

describe("CreateAlertRule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    vi.mocked(fetchAlertRules).mockResolvedValue([existingRule]);
    vi.mocked(fetchAlertChannels).mockResolvedValue(sampleChannels);
    vi.mocked(createAlertRule).mockResolvedValue({ data: existingRule });
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

  it("renders the create page and cancels back to the rules list", async () => {
    render(<CreateAlertRule />);

    expect(await screen.findByText("Create alert rule")).toBeInTheDocument();
    await screen.findByLabelText(/name/i);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockNavigate).toHaveBeenCalledWith("/alerts/rules");
  });

  it("creates a rule and navigates back to the list", async () => {
    render(<CreateAlertRule />);
    const nameInput = await screen.findByRole("textbox", { name: /name/i });
    const createButton = screen.getByRole("button", { name: "Create rule" });
    expect(createButton).toBeDisabled();

    await userEvent.type(nameInput, "source-lag-critical");
    await userEvent.click(await screen.findByRole("button", { name: "Select a monitoring panel" }));
    await userEvent.click(await screen.findByText("Source Lag"));
    await userEvent.type(screen.getByRole("spinbutton", { name: "Threshold" }), "30");

    await waitFor(() => expect(createButton).toBeEnabled());
    await userEvent.click(createButton);

    await waitFor(() => {
      expect(createAlertRule).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "source-lag-critical",
          panelId: "source-lag",
          threshold: 30,
          operator: "GREATER_THAN",
          enabled: true,
        })
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith("/alerts/rules");
  });
});
