function roundQty(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function lineAmount(quantity: number, unitCost: number) {
  if (quantity <= 0) throw new Error("Quantity must be greater than 0");
  if (unitCost < 0) throw new Error("Unit cost cannot be negative");
  return roundQty(quantity * unitCost);
}

export function remainingToShip(orderedQty: number, shippedQty: number) {
  return roundQty(orderedQty - shippedQty);
}

export function remainingToReceive(shippedQty: number, receivedQty: number) {
  return roundQty(shippedQty - receivedQty);
}

export function receivingFigures(expectedQty: number, goodQty: number, damagedQty: number) {
  if (goodQty < 0 || damagedQty < 0 || expectedQty < 0) {
    throw new Error("Quantity cannot be negative");
  }
  const actual = roundQty(goodQty + damagedQty);
  return {
    actual,
    shortQty: roundQty(Math.max(expectedQty - actual, 0)),
    excessQty: roundQty(Math.max(actual - expectedQty, 0)),
  };
}

export type PoProgress = {
  ordered: number;
  shipped: number;
  received: number;
  acceptedShort: number;
  openDiscrepancies: number;
};

export function purchaseOrderStatusAfterActivity(progress: PoProgress) {
  const ordered = roundQty(progress.ordered);
  const shipped = roundQty(progress.shipped);
  const received = roundQty(progress.received);
  const covered = roundQty(received + progress.acceptedShort);
  const fullyShipped = shipped >= ordered && ordered > 0;
  const uncovered = covered < ordered;
  if (fullyShipped && !uncovered && progress.openDiscrepancies === 0) return "completed" as const;
  if (received > 0 || progress.openDiscrepancies > 0) return "partially_received" as const;
  if (fullyShipped) return "fully_shipped" as const;
  if (shipped > 0) return "partially_shipped" as const;
  return "approved" as const;
}
