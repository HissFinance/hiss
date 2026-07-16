import { describe, expect, it } from "vitest";
import { bpsToPercent, formatBaseUnits, formatDuration, truncateAddress } from "./format";

describe("truncateAddress", () => {
  it("truncates a full address", () => {
    expect(truncateAddress("0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3")).toBe("0x4716…eBa3");
  });
  it("leaves short strings unchanged", () => {
    expect(truncateAddress("0x1234")).toBe("0x1234");
  });
});

describe("formatBaseUnits", () => {
  it("formats 18-decimal base units exactly without float drift", () => {
    expect(formatBaseUnits("1000000000000000000", 18)).toBe("1");
    expect(formatBaseUnits("1234500000000000000", 18)).toBe("1.2345");
  });
  it("groups the integer part with commas", () => {
    expect(formatBaseUnits("1234567000000000000000", 18)).toBe("1,234.567");
  });
  it("returns non-numeric input as-is", () => {
    expect(formatBaseUnits("n/a", 18)).toBe("n/a");
  });
});

describe("bpsToPercent", () => {
  it("converts basis points", () => {
    expect(bpsToPercent(5000)).toBe("50%");
    expect(bpsToPercent(1000)).toBe("10%");
  });
});

describe("formatDuration", () => {
  it("formats 72h as days+hours", () => {
    expect(formatDuration(72 * 3600)).toBe("3d 0h");
  });
});
