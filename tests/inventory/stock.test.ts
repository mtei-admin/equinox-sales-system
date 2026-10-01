import { describe, expect, it } from "vitest";
import { assertEnoughAvailable, availableQty, onHandQty, reservedQty, signedAdjustmentQty } from "@/lib/inventory/stock";

describe("inventory quantities", () => {
  it("on-hand is the signed movement total", () => {
    expect(onHandQty([{ quantity: 10 }, { quantity: -3 }, { quantity: 1 }])).toBe(8);
  });

  it("reserved is open/closed SO qty minus issued WS qty", () => {
    expect(reservedQty(10, 4)).toBe(6);
    expect(reservedQty(10, 10)).toBe(0);
  });

  it("available is on-hand minus reserved", () => {
    expect(availableQty(10, 4)).toBe(6);
    expect(availableQty(5, 5)).toBe(0);
  });

  it("rejects a required qty above available", () => {
    expect(() => assertEnoughAvailable(4, 5)).toThrow(/Available quantity 4 is less than required 5/);
    expect(() => assertEnoughAvailable(5, 5)).not.toThrow();
  });

  it("maps adjustment direction to a signed movement", () => {
    expect(signedAdjustmentQty(3, "increase")).toBe(3);
    expect(signedAdjustmentQty(3, "decrease")).toBe(-3);
  });
});
