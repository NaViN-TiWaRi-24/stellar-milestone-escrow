import { describe, expect, it } from "vitest";
import {
  formatTokenAmount,
  formatXlm,
  STROOPS_PER_XLM,
  xlmToStroops,
} from "./amounts";

describe("XLM amount helpers", () => {
  it("converts decimal XLM strings to stroops exactly", () => {
    expect(xlmToStroops("1")).toBe(STROOPS_PER_XLM);
    expect(xlmToStroops("1.2345678")).toBe(12_345_678n);
    expect(xlmToStroops("9007199254740993.0000001")).toBe(
      90_071_992_547_409_930_000_001n,
    );
  });

  it("rejects invalid, over-precision, and non-positive syntax", () => {
    expect(xlmToStroops("1.00000001")).toBeNull();
    expect(xlmToStroops("1e3")).toBeNull();
    expect(xlmToStroops("-1")).toBeNull();
    expect(xlmToStroops("")).toBeNull();
  });

  it("formats stroops without floating-point rounding", () => {
    expect(formatXlm(0n)).toBe("0 XLM");
    expect(formatXlm(12_345_678n)).toBe("1.2345678 XLM");
    expect(formatXlm(90_071_992_547_409_930_000_001n)).toBe(
      "9007199254740993.0000001 XLM",
    );
    expect(formatXlm(-1n)).toBe("-0.0000001 XLM");
  });

  it("keeps non-XLM token amounts in exact integer units", () => {
    expect(formatTokenAmount(12345678901234567890n, false)).toBe(
      "12345678901234567890 token units",
    );
  });
});
