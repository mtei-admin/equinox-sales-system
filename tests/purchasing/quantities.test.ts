import { describe, expect, it } from "vitest";
import {
  lineAmount,
  purchaseOrderStatusAfterActivity,
  receivingFigures,
  remainingToReceive,
  remainingToShip,
} from "@/lib/purchasing/quantities";

describe("purchasing quantities", () => {
  it("computes amount and remaining shipment with two-decimal rounding", () => {
    expect(lineAmount(1000, 12.5)).toBe(12500);
    expect(remainingToShip(10000, 6000)).toBe(4000);
    expect(remainingToReceive(600, 300)).toBe(300);
  });

  it("flags short, damaged, and excess without changing the shipped quantity", () => {
    expect(receivingFigures(6000, 5980, 0)).toEqual({ actual: 5980, shortQty: 20, excessQty: 0 });
    expect(receivingFigures(600, 590, 10)).toEqual({ actual: 600, shortQty: 0, excessQty: 0 });
    expect(receivingFigures(600, 605, 0)).toEqual({ actual: 605, shortQty: 0, excessQty: 5 });
  });

  it("does not complete a purchase order while a shortage is unresolved", () => {
    expect(
      purchaseOrderStatusAfterActivity({
        ordered: 10000,
        shipped: 10000,
        received: 9980,
        acceptedShort: 0,
        openDiscrepancies: 1,
      }),
    ).toBe("partially_received");
  });

  it("completes a purchase order after the shortage is accepted", () => {
    expect(
      purchaseOrderStatusAfterActivity({
        ordered: 10000,
        shipped: 10000,
        received: 9980,
        acceptedShort: 20,
        openDiscrepancies: 0,
      }),
    ).toBe("completed");
  });

  it("keeps a partial shipment partial", () => {
    expect(
      purchaseOrderStatusAfterActivity({
        ordered: 1000,
        shipped: 600,
        received: 0,
        acceptedShort: 0,
        openDiscrepancies: 0,
      }),
    ).toBe("partially_shipped");
  });
});
