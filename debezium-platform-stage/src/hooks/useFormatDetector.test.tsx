import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { isValidJson, useFormatDetector } from "./useFormatDetector";

describe("isValidJson", () => {
  it("accepts object literals", () => {
    expect(isValidJson({ a: 1 })).toBe(true);
  });

  it("accepts JSON object strings", () => {
    expect(isValidJson('{"a":1}')).toBe(true);
  });

  it("rejects arrays and invalid JSON strings", () => {
    expect(isValidJson("[1]")).toBe(false);
    expect(isValidJson("not-json")).toBe(false);
  });

  it("rejects non-plain objects", () => {
    expect(isValidJson(null as unknown as string)).toBe(false);
  });

  it("returns false when JSON.stringify throws", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(isValidJson(circular)).toBe(false);
  });
});

describe("useFormatDetector", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty format when code is falsy", () => {
    const { result } = renderHook(() =>
      useFormatDetector("", "source"),
    );
    expect(result.current.formatType).toBe("");
  });

  it("detects dbz-platform JSON", () => {
    const code = {
      name: "n",
      type: "t",
      schema: "s",
      config: { x: "1" },
    };
    const { result } = renderHook(() => useFormatDetector(code, "source"));
    expect(result.current.formatType).toBe("dbz-platform");
    expect(result.current.isValidFormat).toBe(true);
  });

  it("detects kafka-connect JSON for source", () => {
    const code = {
      name: "k",
      config: {
        "connector.class": "io.debezium.connector.mysql.MySqlConnector",
      },
    };
    const { result } = renderHook(() => useFormatDetector(code, "source"));
    expect(result.current.formatType).toBe("kafka-connect");
  });

  it("detects properties-file string for source", () => {
    const code = "debezium.source.connector.class=x\n";
    const { result } = renderHook(() => useFormatDetector(code, "source"));
    expect(result.current.formatType).toBe("properties-file");
  });

  it("logs and returns empty format for invalid non-properties strings", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { result } = renderHook(() => useFormatDetector("not-json", "source"));
    expect(result.current.formatType).toBe("");
    expect(log).toHaveBeenCalled();
  });

  it("returns empty format when JSON object fails platform schema validation", () => {
    const { result } = renderHook(() =>
      useFormatDetector({ invalid: true }, "source"),
    );
    expect(result.current.formatType).toBe("");
  });
});
