function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function onHandQty(movements: { quantity: number }[]) {
  return roundMoney(movements.reduce((sum, row) => sum + row.quantity, 0));
}

export function reservedQty(openClosedSoQty: number, issuedWsQty: number) {
  return roundMoney(Math.max(0, openClosedSoQty - issuedWsQty));
}

export function availableQty(onHand: number, reserved: number) {
  return roundMoney(onHand - reserved);
}

export function assertEnoughAvailable(available: number, required: number) {
  if (required <= 0) throw new Error("Quantity must be greater than 0");
  if (required > available + 1e-9) {
    throw new Error(`Available quantity ${available} is less than required ${required}`);
  }
}

export function signedAdjustmentQty(quantity: number, direction: "increase" | "decrease") {
  const qty = roundMoney(quantity);
  return direction === "increase" ? qty : roundMoney(qty * -1);
}
