function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function remainingQty(ordered: number, consumedByNonCancelled: number) {
  return roundMoney(Math.max(0, ordered - consumedByNonCancelled));
}

export function assertQtyWithinRemaining(ordered: number, consumed: number, next: number, label: string) {
  if (next <= 0) throw new Error(`${label} quantity must be greater than 0`);
  const remaining = remainingQty(ordered, consumed);
  if (next > remaining + 1e-9) {
    throw new Error(`${label} quantity ${next} exceeds remaining ${remaining}`);
  }
}

export function consumedQty(
  children: { quantity: number; cancelled: boolean }[],
) {
  return roundMoney(
    children.filter((row) => !row.cancelled).reduce((sum, row) => sum + row.quantity, 0),
  );
}
