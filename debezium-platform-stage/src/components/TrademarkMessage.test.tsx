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

  it("renders only one message when multiple instances mount", async () => {
    vi.resetModules();
    const { default: TrademarkMessage } = await import("./TrademarkMessage");

    let nodeCount = 0;
    let captured: string | null = null;

    const Wrap: React.FC = () => {
      React.useLayoutEffect(() => {
        const nodes = document.querySelectorAll("#trademark-msg");
        nodeCount = nodes.length;
        captured = nodes[0]?.textContent ?? null;
      });
      return (
        <>
          <TrademarkMessage />
          <TrademarkMessage />
          <TrademarkMessage />
        </>
      );
    };

    render(<Wrap />);
    expect(nodeCount).toBe(1);
    expect(captured).toMatch(
      /All logos and trademarks are the property of their respective owners/,
    );
  });
});
