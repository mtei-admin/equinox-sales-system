import { describe, expect, it } from "vitest";
import {
  branchCommitmentSnapshot,
  companyCommittedRemaining,
  warehouseAllocatedRemaining,
} from "@/lib/inventory/presentation";
import { signedAdjustmentQty } from "@/lib/inventory/stock";

/**
 * Phase 1 example:
 * SO commits 10. ATW/DR allocates 6 to DAVAO and 4 to CEBU.
 * Partial withdrawal of 2 from DAVAO releases commitment once at issue_withdrawal_slip.
 */
describe("DAVAO / CEBU warehouse allocation scenario", () => {
  const davaoOnHand = 60;
  const cebuOnHand = 20;

  it("keeps the open sales order unallocated and company-wide until ATW/DR", () => {
    const open = branchCommitmentSnapshot({
      onHandByWarehouse: { DAVAO: davaoOnHand, CEBU: cebuOnHand },
      allocatedByWarehouse: { DAVAO: 0, CEBU: 0 },
      committed: 10,
      incoming: 15,
    });
    expect(open.company).toMatchObject({
      on_hand: 80,
      committed: 10,
      allocated: 0,
      unallocated: 10,
      available: 70,
      incoming: 15,
    });
    expect(open.branches.DAVAO).toEqual({ on_hand: 60, committed: 0, available: 60 });
    expect(open.branches.CEBU).toEqual({ on_hand: 20, committed: 0, available: 20 });
  });

  it("allocates 6 to DAVAO and 4 to CEBU without double-counting company committed", () => {
    const allocated = branchCommitmentSnapshot({
      onHandByWarehouse: { DAVAO: davaoOnHand, CEBU: cebuOnHand },
      allocatedByWarehouse: { DAVAO: 6, CEBU: 4 },
      committed: 10,
      incoming: 15,
    });
    expect(allocated.company).toMatchObject({
      on_hand: 80,
      committed: 10,
      allocated: 10,
      unallocated: 0,
      available: 70,
      incoming: 15,
    });
    expect(allocated.branches.DAVAO).toEqual({ on_hand: 60, committed: 6, available: 54 });
    expect(allocated.branches.CEBU).toEqual({ on_hand: 20, committed: 4, available: 16 });
    expect(allocated.company.allocated + allocated.company.unallocated).toBe(allocated.company.committed);
  });

  it("releases commitment once when a partial DAVAO withdrawal of 2 is issued", () => {
    const issued = 2;
    const movement = signedAdjustmentQty(issued, "decrease");
    expect(movement).toBe(-2);

    const afterIssue = branchCommitmentSnapshot({
      onHandByWarehouse: {
        DAVAO: davaoOnHand + movement,
        CEBU: cebuOnHand,
      },
      allocatedByWarehouse: {
        DAVAO: warehouseAllocatedRemaining(6, issued),
        CEBU: warehouseAllocatedRemaining(4, 0),
      },
      committed: companyCommittedRemaining(10, issued),
      incoming: 15,
    });

    expect(afterIssue.branches.DAVAO).toEqual({ on_hand: 58, committed: 4, available: 54 });
    expect(afterIssue.branches.CEBU).toEqual({ on_hand: 20, committed: 4, available: 16 });
    expect(afterIssue.company).toMatchObject({
      on_hand: 78,
      committed: 8,
      allocated: 8,
      unallocated: 0,
      available: 70,
      incoming: 15,
    });
    // Same issued qty is subtracted once from company committed and warehouse reserved.
    expect(companyCommittedRemaining(10, issued)).toBe(8);
    expect(warehouseAllocatedRemaining(6, issued)).toBe(4);
  });

  it("restores DAVAO balances when the issued slip is cancelled, then allows a second issue", () => {
    const afterCancel = branchCommitmentSnapshot({
      onHandByWarehouse: { DAVAO: davaoOnHand, CEBU: cebuOnHand },
      allocatedByWarehouse: { DAVAO: 6, CEBU: 4 },
      committed: 10,
      incoming: 15,
    });
    expect(afterCancel.branches.DAVAO).toEqual({ on_hand: 60, committed: 6, available: 54 });
    expect(afterCancel.company.committed).toBe(10);

    const afterRepost = branchCommitmentSnapshot({
      onHandByWarehouse: { DAVAO: davaoOnHand - 2, CEBU: cebuOnHand },
      allocatedByWarehouse: {
        DAVAO: warehouseAllocatedRemaining(6, 2),
        CEBU: 4,
      },
      committed: companyCommittedRemaining(10, 2),
      incoming: 15,
    });
    expect(afterRepost.branches.DAVAO.on_hand).toBe(58);
    expect(afterRepost.branches.CEBU).toEqual({ on_hand: 20, committed: 4, available: 16 });
    expect(afterRepost.company.committed).toBe(8);
  });
});
