import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "../__test__/unit/test-utils";

describe("TrademarkMessage", () => {
  it("exposes trademark text in the DOM on initial layout", async () => {
    vi.resetModules();
    const { default: TrademarkMessage } = await import("./TrademarkMessage");

    let captured: string | null = null;

    const Wrap: React.FC = () => {
      React.useLayoutEffect(() => {
        captured = document.querySelector("#trademark-msg")?.textContent ?? null;
      });
      return <TrademarkMessage />;
    };

    render(<Wrap />);
    expect(captured).toMatch(
      /All logos and trademarks are the property of their respective owners/,
    );
  });
});
