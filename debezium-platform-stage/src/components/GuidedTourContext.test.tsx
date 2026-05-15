import { screen, fireEvent } from "@testing-library/react";
import { render as rtlRender } from "@testing-library/react";
import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import {
  GuidedTourProvider,
  useGuidedTour,
  isWalkthroughCompleted,
  isWalkthroughDeferred,
  markWalkthroughCompleted,
  markWalkthroughDeferred,
  clearWalkthrough,
  getStoredTourMode,
  setStoredTourMode,
  getStoredTourLevel,
  setStoredTourLevel,
  arePageToursDisabled,
} from "./GuidedTourContext";
import { render } from "../__test__/unit/test-utils";

const lsStore = new Map<string, string>();
const setupLocalStorageFromSetup = window.localStorage;

beforeAll(() => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (lsStore.has(k) ? lsStore.get(k)! : null),
      setItem: (k: string, v: string) => {
        lsStore.set(k, String(v));
      },
      removeItem: (k: string) => {
        lsStore.delete(k);
      },
      clear: () => {
        lsStore.clear();
      },
      get length() {
        return lsStore.size;
      },
      key: (i: number) => Array.from(lsStore.keys())[i] ?? null,
    },
  });
});

afterAll(() => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: setupLocalStorageFromSetup,
  });
});

function TourControls() {
  const ctx = useGuidedTour();
  return (
    <div>
      <span data-testid="active">{String(ctx.isTourActive)}</span>
      <span data-testid="mode">{String(ctx.tourMode)}</span>
      <span data-testid="step">{String(ctx.stepIndex)}</span>
      <span data-testid="advanced">{String(ctx.isAdvancedUser)}</span>
      <span data-testid="page-done">
        {String(ctx.isPageTourCompleted("source"))}
      </span>
      <button type="button" onClick={() => ctx.setTourActive(false)}>
        deactivate
      </button>
      <button type="button" onClick={() => ctx.setTourMode("basic")}>
        basic
      </button>
      <button type="button" onClick={() => ctx.setTourMode("advanced")}>
        advanced
      </button>
      <button type="button" onClick={() => ctx.setTourMode(null)}>
        clear-mode
      </button>
      <button type="button" onClick={() => ctx.setStepIndex(3)}>
        step3
      </button>
      <button type="button" onClick={() => ctx.completeTour()}>
        complete
      </button>
      <button type="button" onClick={() => ctx.deferTour()}>
        defer
      </button>
      <button type="button" onClick={() => ctx.replayTour()}>
        replay
      </button>
      <button type="button" onClick={() => ctx.markPageTourCompleted("source")}>
        mark-source
      </button>
      <button type="button" onClick={() => ctx.skipAllPageTours()}>
        skip-all
      </button>
    </div>
  );
}

describe("GuidedTourContext storage helpers", () => {
  beforeEach(() => {
    lsStore.clear();
  });

  it("tracks walkthrough completion and deferral", () => {
    expect(isWalkthroughCompleted()).toBe(false);
    expect(isWalkthroughDeferred()).toBe(false);
    markWalkthroughCompleted();
    expect(isWalkthroughCompleted()).toBe(true);
    clearWalkthrough();
    markWalkthroughDeferred();
    expect(isWalkthroughDeferred()).toBe(true);
  });

  it("persists tour mode and level", () => {
    expect(getStoredTourMode()).toBeNull();
    setStoredTourMode("basic");
    expect(getStoredTourMode()).toBe("basic");
    setStoredTourMode(null);
    expect(getStoredTourMode()).toBeNull();

    setStoredTourLevel("advanced");
    expect(getStoredTourLevel()).toBe("advanced");
    setStoredTourLevel(null);
    expect(getStoredTourLevel()).toBeNull();
  });

  it("detects when page tours are disabled", () => {
    expect(arePageToursDisabled()).toBe(false);
    lsStore.set("dbz-page-tours-disabled", "true");
    expect(arePageToursDisabled()).toBe(true);
  });
});

describe("GuidedTourProvider", () => {
  beforeEach(() => {
    lsStore.clear();
  });

  it("updates tour mode, step index, and advanced flag", () => {
    lsStore.set("dbz-page-tours-completed", "{not-json");
    render(
      <GuidedTourProvider>
        <TourControls />
      </GuidedTourProvider>,
    );

    expect(screen.getByTestId("active").textContent).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "deactivate" }));
    expect(screen.getByTestId("active").textContent).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "basic" }));
    expect(screen.getByTestId("mode").textContent).toBe("basic");
    expect(screen.getByTestId("advanced").textContent).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "advanced" }));
    expect(screen.getByTestId("advanced").textContent).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "step3" }));
    expect(screen.getByTestId("step").textContent).toBe("3");
  });

  it("completes the tour", () => {
    render(
      <GuidedTourProvider>
        <TourControls />
      </GuidedTourProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "complete" }));
    expect(screen.getByTestId("active").textContent).toBe("false");
    expect(isWalkthroughCompleted()).toBe(true);
  });

  it("defers the tour", () => {
    lsStore.delete("dbz-walkthrough-completed");
    render(
      <GuidedTourProvider>
        <TourControls />
      </GuidedTourProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "defer" }));
    expect(screen.getByTestId("active").textContent).toBe("false");
    expect(isWalkthroughDeferred()).toBe(true);
  });

  it("replays tour and resets storage flags", () => {
    lsStore.set("dbz-walkthrough-completed", "true");
    lsStore.set("dbz-page-tours-completed", JSON.stringify(["source"]));
    lsStore.set("dbz-page-tours-disabled", "true");

    render(
      <GuidedTourProvider>
        <TourControls />
      </GuidedTourProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "replay" }));
    expect(screen.getByTestId("active").textContent).toBe("true");
    expect(lsStore.has("dbz-walkthrough-completed")).toBe(false);
    expect(lsStore.has("dbz-page-tours-completed")).toBe(false);
    expect(lsStore.has("dbz-page-tours-disabled")).toBe(false);
  });

  it("marks page tours and skip-all updates storage", () => {
    render(
      <GuidedTourProvider>
        <TourControls />
      </GuidedTourProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "mark-source" }));
    expect(screen.getByTestId("page-done").textContent).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "mark-source" }));
    expect(screen.getByTestId("page-done").textContent).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "skip-all" }));
    expect(arePageToursDisabled()).toBe(true);
    expect(isWalkthroughCompleted()).toBe(true);
  });
});

describe("useGuidedTour", () => {
  it("throws when used outside GuidedTourProvider", () => {
    const Bad = () => {
      useGuidedTour();
      return null;
    };
    expect(() => rtlRender(<Bad />)).toThrow(
      /useGuidedTour must be used within a GuidedTourProvider/,
    );
  });
});
