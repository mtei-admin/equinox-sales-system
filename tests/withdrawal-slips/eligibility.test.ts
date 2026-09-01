import { describe, expect, it } from "vitest";
import {
  assertCanCreateWithdrawalSlip,
  assertCanUpdateWithdrawalSlip,
  assertWsQuantitiesMatchAtw,
  atwHasActiveWithdrawalSlip,
  atwLookupMatches,
  isUuid,
} from "@/lib/withdrawal-slips/eligibility";

const pipe = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const wire = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const atwLines = [
  { id: pipe, quantity: 10 },
  { id: wire, quantity: 5 },
];

describe("withdrawal slip from ATW/DR", () => {
  it("copies every ATW/DR line at the same quantity", () => {
    expect(() =>
      assertWsQuantitiesMatchAtw(atwLines, [
        { atw_item_id: pipe, quantity: 10 },
        { atw_item_id: wire, quantity: 5 },
      ]),
    ).not.toThrow();
  });

  it("rejects a partial copy or a quantity that does not match the ATW/DR line", () => {
    expect(() =>
      assertWsQuantitiesMatchAtw(atwLines, [{ atw_item_id: pipe, quantity: 10 }]),
    ).toThrow(/copy every ATW/);
    expect(() =>
      assertWsQuantitiesMatchAtw(atwLines, [
        { atw_item_id: pipe, quantity: 9 },
        { atw_item_id: wire, quantity: 5 },
      ]),
    ).toThrow(/must match ATW\/DR quantity 10/);
  });

  it("allows create only on a released ATW/DR that has no active slip", () => {
    expect(() => assertCanCreateWithdrawalSlip("released", false, atwLines)).not.toThrow();
    expect(() => assertCanCreateWithdrawalSlip("draft", false, atwLines)).toThrow(/released ATW/);
    expect(() => assertCanCreateWithdrawalSlip("cancelled", false, atwLines)).toThrow(/released ATW/);
    expect(() => assertCanCreateWithdrawalSlip("released", true, atwLines)).toThrow(/already has a withdrawal slip/);
  });

  it("treats a cancelled slip as no longer occupying the ATW/DR", () => {
    const atwId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    expect(
      atwHasActiveWithdrawalSlip(atwId, [
        { atw_id: atwId, status: "cancelled" },
      ]),
    ).toBe(false);
    expect(
      atwHasActiveWithdrawalSlip(atwId, [
        { atw_id: atwId, status: "draft" },
      ]),
    ).toBe(true);
    expect(
      atwHasActiveWithdrawalSlip(atwId, [
        { atw_id: atwId, status: "issued" },
      ]),
    ).toBe(true);
  });

  it("allows draft edits and rejects issued or cancelled edits", () => {
    expect(() => assertCanUpdateWithdrawalSlip("draft")).not.toThrow();
    expect(() => assertCanUpdateWithdrawalSlip("issued")).toThrow(/draft withdrawal slip can be edited/);
    expect(() => assertCanUpdateWithdrawalSlip("cancelled")).toThrow(/draft withdrawal slip can be edited/);
  });
});

describe("warehouse ATW/DR lookup", () => {
  const atw = {
    id: "11111111-1111-4111-8111-111111111111",
    atw_number: "ATW-2026-0004",
    document_type: "atw" as const,
  };
  const dr = {
    id: "22222222-2222-4222-8222-222222222222",
    atw_number: "ATW-2026-0005",
    document_type: "dr" as const,
  };

  it("matches ATW id, ATW number, and DR number", () => {
    expect(isUuid(atw.id)).toBe(true);
    expect(atwLookupMatches(atw.id, atw)).toBe(true);
    expect(atwLookupMatches("ATW-2026-0004", atw)).toBe(true);
    expect(atwLookupMatches("2026-0004", atw)).toBe(true);
    expect(atwLookupMatches("ATW-2026-0005", dr)).toBe(true);
    expect(atwLookupMatches(dr.id, dr)).toBe(true);
    expect(atwLookupMatches("ATW-2026-0004", dr)).toBe(false);
  });
});
