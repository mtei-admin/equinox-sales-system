import { describe, expect, it } from "vitest";
import { updateWithdrawalSlipSchema, withdrawalSlipSchema } from "@/lib/validation/schemas";

const atwId = "33333333-3333-4333-8333-333333333333";
const slipId = "44444444-4444-4444-8444-444444444444";
const lineId = "55555555-5555-4555-8555-555555555555";

const wh = "11111111-1111-4111-8111-111111111111";

describe("withdrawal slip schema", () => {
  it("accepts create from an ATW/DR with optional remarks and copied lines", () => {
    const parsed = withdrawalSlipSchema.safeParse({
      atw_id: atwId,
      warehouse_id: wh,
      remarks: "Dock 3",
      lines: [{ atw_item_id: lineId, quantity: "10" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a missing ATW/DR and non-positive line qty", () => {
    expect(withdrawalSlipSchema.safeParse({ remarks: "x" }).success).toBe(false);
    expect(
      withdrawalSlipSchema.safeParse({
        atw_id: atwId,
        warehouse_id: wh,
        lines: [{ atw_item_id: lineId, quantity: 0 }],
      }).success,
    ).toBe(false);
  });

  it("accepts a draft update with id", () => {
    const parsed = updateWithdrawalSlipSchema.safeParse({
      id: slipId,
      remarks: "Updated note",
      lines: [{ atw_item_id: lineId, quantity: 10 }],
    });
    expect(parsed.success).toBe(true);
  });
});
