import { describe, expect, it } from "vitest";
import { inventoryAdjustmentSchema, postInventoryAdjustmentSchema } from "@/lib/validation/schemas";

const lineId = "11111111-1111-4111-8111-111111111111";

describe("inventory adjustment schema", () => {
  it("accepts increase and decrease lines", () => {
    const parsed = inventoryAdjustmentSchema.safeParse({
      remarks: "Opening",
      lines: [
        { item_id: lineId, quantity: "4", direction: "increase" },
        { item_id: lineId, quantity: 1, direction: "decrease" },
      ],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.lines[0]?.quantity).toBe(4);
    }
  });

  it("rejects a missing direction or empty lines", () => {
    expect(
      inventoryAdjustmentSchema.safeParse({
        lines: [{ item_id: lineId, quantity: 1 }],
      }).success,
    ).toBe(false);
    expect(inventoryAdjustmentSchema.safeParse({ lines: [] }).success).toBe(false);
  });

  it("requires a posting reason", () => {
    expect(postInventoryAdjustmentSchema.safeParse({ id: lineId, reason: "" }).success).toBe(false);
    expect(postInventoryAdjustmentSchema.safeParse({ id: lineId, reason: "Count" }).success).toBe(true);
  });
});
