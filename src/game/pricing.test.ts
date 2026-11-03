import { describe, expect, it } from "vitest";
import { buyPrice, sellPrice, quoteSell, quoteBuy } from "./mockGame";

describe("Bloq pricing", () => {
  it("pays floor(100*40/(40+s))", () => {
    expect(buyPrice(5)).toBe(88);
    expect(buyPrice(0)).toBe(100);
  });
  it("charges buy price plus 2.5% spread, floored", () => {
    expect(sellPrice(5)).toBe(90);
  });
  it("prices multi-unit trades one unit at a time", () => {
    expect(quoteSell(5, 2)).toBe(88 + 86);
    expect(quoteBuy(5, 2)).toBe(90 + sellPrice(4));
  });
});
