import type { AtwStatus, WsStatus } from "@/types/database";

export type AtwLineForSlip = {
  id: string;
  quantity: number;
};

export type WsLineQty = {
  atw_item_id: string;
  quantity: number;
};

export type ActiveSlip = {
  atw_id: string;
  status: WsStatus;
};

export function atwHasActiveWithdrawalSlip(atwId: string, slips: ActiveSlip[]) {
  return slips.some((slip) => slip.atw_id === atwId && slip.status !== "cancelled");
}

export function assertWsQuantitiesMatchAtw(atwLines: AtwLineForSlip[], wsLines: WsLineQty[]) {
  if (atwLines.length < 1) {
    throw new Error("ATW/DR has no lines");
  }
  if (wsLines.length !== atwLines.length) {
    throw new Error("Withdrawal slip must copy every ATW/DR line");
  }
  for (const atwLine of atwLines) {
    const wsLine = wsLines.find((line) => line.atw_item_id === atwLine.id);
    if (!wsLine) {
      throw new Error("Withdrawal slip is missing an ATW/DR line");
    }
    if (Math.abs(wsLine.quantity - atwLine.quantity) > 1e-9) {
      throw new Error(
        `Withdrawal slip quantity ${wsLine.quantity} must match ATW/DR quantity ${atwLine.quantity}`,
      );
    }
  }
}

export function assertCanCreateWithdrawalSlip(
  atwStatus: AtwStatus | string,
  hasActiveSlip: boolean,
  atwLines: AtwLineForSlip[],
  nextLines?: WsLineQty[],
) {
  if (atwStatus !== "released") {
    throw new Error("Withdrawal slip requires a released ATW/DR");
  }
  if (hasActiveSlip) {
    throw new Error("This ATW/DR already has a withdrawal slip");
  }
  if (atwLines.length < 1) {
    throw new Error("ATW/DR has no lines");
  }
  if (nextLines && nextLines.length > 0) {
    assertWsQuantitiesMatchAtw(atwLines, nextLines);
  }
}

export function assertCanUpdateWithdrawalSlip(status: WsStatus | string) {
  if (status !== "draft") {
    throw new Error("Only a draft withdrawal slip can be edited");
  }
}

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_RE.test(value.trim());
}

export function atwLookupMatches(
  q: string,
  doc: { id: string; atw_number: string; document_type: "atw" | "dr" },
) {
  const needle = q.trim().toLowerCase();
  if (!needle) return false;
  if (doc.id.toLowerCase() === needle) return true;
  return doc.atw_number.toLowerCase().includes(needle);
}
