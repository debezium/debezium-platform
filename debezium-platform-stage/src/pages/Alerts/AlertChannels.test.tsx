import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "../../__test__/unit/test-utils";
import AlertChannels from "./AlertChannels";
import { NotificationChannel } from "./alertsTypes";

vi.mock("../../apis/alerts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../apis/alerts")>();
  return {
    ...actual,
    fetchAlertChannels: vi.fn(),
    createAlertChannel: vi.fn(),
    updateAlertChannel: vi.fn(),
    deleteAlertChannel: vi.fn(),
    testAlertChannel: vi.fn(),
  };
});

import {
  createAlertChannel,
  deleteAlertChannel,
  fetchAlertChannels,
  testAlertChannel,
  updateAlertChannel,
} from "../../apis/alerts";

const sampleChannel = (overrides: Partial<NotificationChannel> = {}): NotificationChannel => ({
  id: 3,
  name: "Platform Ops Email",
  type: "EMAIL",
  config: {
    recipients: ["ops@example.com", "oncall@example.com"],
    subjectPrefix: "[Debezium]",
  },
  enabled: true,
  createdAt: "2026-08-18T07:46:01.158652Z",
  updatedAt: "2026-08-18T07:46:01.158652Z",
  ...overrides,
});

describe("AlertChannels", () => {
  beforeEach(() => {
    vi.mocked(fetchAlertChannels).mockReset();
    vi.mocked(createAlertChannel).mockReset();
    vi.mocked(updateAlertChannel).mockReset();
    vi.mocked(deleteAlertChannel).mockReset();
    vi.mocked(testAlertChannel).mockReset();
    vi.mocked(fetchAlertChannels).mockResolvedValue([sampleChannel()]);
  });

  it("shows a loading state, then renders the fetched channels", async () => {
    render(<AlertChannels />);

    expect(screen.getByLabelText("Loading notification channels")).toBeInTheDocument();

    expect(await screen.findByRole("button", { name: "Platform Ops Email" })).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("ops@example.com (+1)")).toBeInTheDocument();
    await userEvent.hover(screen.getByText("ops@example.com (+1)"));
    expect(await screen.findByText("oncall@example.com")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Enable Platform Ops Email" })).toBeChecked();
    expect(screen.getByText("1 items")).toBeInTheDocument();
  });

  it("shows the full webhook URL in a tooltip when the details column is truncated", async () => {
    const url = "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX";
    vi.mocked(fetchAlertChannels).mockResolvedValue([
      sampleChannel({
        id: 5,
        name: "Slack #cdc-alerts",
        type: "WEBHOOK",
        config: { url, method: "POST" },
      }),
    ]);

    render(<AlertChannels />);

    const truncated = await screen.findByText(`${url.slice(0, 42)}...`);
    await userEvent.hover(truncated);
    expect(await screen.findByText(url)).toBeInTheDocument();
  });

  it("shows the empty state when the API returns no channels", async () => {
    vi.mocked(fetchAlertChannels).mockResolvedValue([]);

    render(<AlertChannels />);

    expect(await screen.findByText("No notification channels")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add channel" })).toBeInTheDocument();
  });

  it("shows an error state when the channels request fails", async () => {
    vi.mocked(fetchAlertChannels).mockRejectedValue(new Error("network down"));

    render(<AlertChannels />);

    expect(await screen.findByText("Failed to load notification channels")).toBeInTheDocument();
  });

  it("opens the create form from the empty state", async () => {
    vi.mocked(fetchAlertChannels).mockResolvedValue([]);

    render(<AlertChannels />);
    await userEvent.click(await screen.findByRole("button", { name: "Add channel" }));

    expect(await screen.findByText("Create notification channel")).toBeInTheDocument();
  });

  it("opens the edit form when the channel name is clicked", async () => {
    render(<AlertChannels />);
    await userEvent.click(await screen.findByRole("button", { name: "Platform Ops Email" }));

    expect(await screen.findByText("Edit notification channel")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Platform Ops Email")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ops@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("[Debezium]")).toBeInTheDocument();
  });

  it("opens the edit form from row actions", async () => {
    render(<AlertChannels />);
    const row = (await screen.findByRole("button", { name: "Platform Ops Email" })).closest("tr");
    await userEvent.click(
      within(row as HTMLElement).getByRole("button", { name: /kebab toggle/i })
    );
    await userEvent.click(await screen.findByRole("menuitem", { name: /edit/i }));

    expect(await screen.findByText("Edit notification channel")).toBeInTheDocument();
  });

  it("creates a channel through the API", async () => {
    vi.mocked(createAlertChannel).mockResolvedValue({ data: sampleChannel({ id: 7, name: "ops-email" }) });

    render(<AlertChannels />);
    await screen.findByRole("button", { name: "Platform Ops Email" });
    await userEvent.click(screen.getByRole("button", { name: "Add channel" }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox", { name: /name/i }), "ops-email");
    await userEvent.type(within(dialog).getByLabelText("Recipient 1"), "ops@example.com");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create channel" }));

    await waitFor(() => {
      expect(createAlertChannel).toHaveBeenCalledWith({
        name: "ops-email",
        type: "EMAIL",
        config: { recipients: ["ops@example.com"] },
        enabled: true,
      });
    });
  });

  it("updates a channel through the API", async () => {
    vi.mocked(updateAlertChannel).mockResolvedValue({
      data: sampleChannel({ name: "Platform Ops Email Updated" }),
    });

    render(<AlertChannels />);
    await userEvent.click(await screen.findByRole("button", { name: "Platform Ops Email" }));

    const dialog = await screen.findByRole("dialog");
    const nameInput = within(dialog).getByRole("textbox", { name: /name/i });
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Platform Ops Email Updated");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save channel" }));

    await waitFor(() => {
      expect(updateAlertChannel).toHaveBeenCalledWith(
        3,
        expect.objectContaining({
          name: "Platform Ops Email Updated",
          type: "EMAIL",
          enabled: true,
        })
      );
    });
  });

  it("deletes a channel after name confirmation", async () => {
    vi.mocked(deleteAlertChannel).mockResolvedValue(undefined);

    render(<AlertChannels />);
    const row = (await screen.findByRole("button", { name: "Platform Ops Email" })).closest("tr");
    await userEvent.click(
      within(row as HTMLElement).getByRole("button", { name: /kebab toggle/i })
    );
    await userEvent.click(await screen.findByRole("menuitem", { name: /delete/i }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("delete channel name"), "Platform Ops Email");
    await userEvent.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(deleteAlertChannel).toHaveBeenCalledWith(3);
    });
  });

  it("calls the update endpoint when the status switch is toggled", async () => {
    vi.mocked(updateAlertChannel).mockResolvedValue({
      data: sampleChannel({ enabled: false }),
    });

    render(<AlertChannels />);
    await screen.findByRole("button", { name: "Platform Ops Email" });

    await userEvent.click(screen.getByRole("switch", { name: "Enable Platform Ops Email" }));

    await waitFor(() => {
      expect(updateAlertChannel).toHaveBeenCalledWith(3, {
        name: "Platform Ops Email",
        type: "EMAIL",
        config: {
          recipients: ["ops@example.com", "oncall@example.com"],
          subjectPrefix: "[Debezium]",
        },
        enabled: false,
      });
    });
  });

  it("sends a test notification through the API", async () => {
    vi.mocked(testAlertChannel).mockResolvedValue({
      data: { success: true, message: "Test notification sent successfully" },
    });

    render(<AlertChannels />);
    const row = (await screen.findByRole("button", { name: "Platform Ops Email" })).closest("tr");
    await userEvent.click(
      within(row as HTMLElement).getByRole("button", { name: /kebab toggle/i })
    );
    await userEvent.click(await screen.findByRole("menuitem", { name: /test/i }));

    await waitFor(() => {
      expect(testAlertChannel).toHaveBeenCalledWith(3);
    });
  });

  describe("type filter", () => {
    const webhookChannel = sampleChannel({
      id: 5,
      name: "Slack #cdc-alerts",
      type: "WEBHOOK",
      config: {
        url: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX",
        method: "POST",
      },
    });

    beforeEach(() => {
      vi.mocked(fetchAlertChannels).mockResolvedValue([sampleChannel(), webhookChannel]);
    });

    it("filters to a single type", async () => {
      render(<AlertChannels />);
      await screen.findByRole("button", { name: "Platform Ops Email" });
      expect(screen.getByRole("button", { name: "Slack #cdc-alerts" })).toBeInTheDocument();
      expect(screen.getByText("2 items")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Filter by type" }));
      const listbox = await screen.findByRole("listbox");
      await userEvent.click(within(listbox).getByText("Webhook"));

      expect(screen.queryByRole("button", { name: "Platform Ops Email" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Slack #cdc-alerts" })).toBeInTheDocument();
      expect(screen.getByText("1 of 2 items")).toBeInTheDocument();
    });

    it("restores every channel when All types is selected", async () => {
      render(<AlertChannels />);
      await screen.findByRole("button", { name: "Platform Ops Email" });

      await userEvent.click(screen.getByRole("button", { name: "Filter by type" }));
      await userEvent.click(within(await screen.findByRole("listbox")).getByText("Email"));
      expect(screen.queryByRole("button", { name: "Slack #cdc-alerts" })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Filter by type" }));
      await userEvent.click(within(await screen.findByRole("listbox")).getByText("All types"));

      expect(screen.getByRole("button", { name: "Platform Ops Email" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Slack #cdc-alerts" })).toBeInTheDocument();
      expect(screen.getByText("2 items")).toBeInTheDocument();
    });

    it("clears the type filter from the empty matching state", async () => {
      vi.mocked(fetchAlertChannels).mockResolvedValue([sampleChannel()]);

      render(<AlertChannels />);
      await screen.findByRole("button", { name: "Platform Ops Email" });

      await userEvent.click(screen.getByRole("button", { name: "Filter by type" }));
      const listbox = await screen.findByRole("listbox");
      await userEvent.click(within(listbox).getByText("Webhook"));

      expect(await screen.findByText("No matching channel is present.")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Clear filter" }));

      expect(await screen.findByRole("button", { name: "Platform Ops Email" })).toBeInTheDocument();
    });
  });
});
