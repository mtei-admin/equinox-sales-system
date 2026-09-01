function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function lineAmount(quantity: number, unitPrice: number) {
  if (quantity <= 0) throw new Error("Quantity must be greater than 0");
  if (unitPrice < 0) throw new Error("Unit price cannot be negative");
  return roundMoney(quantity * unitPrice);
}

export function lineTotalAmount(amount: number, taxAmount = 0) {
  if (taxAmount < 0) throw new Error("Tax cannot be negative");
  return roundMoney(amount + taxAmount);
}

export function soLineTotals(quantity: number, unitPrice: number) {
  const amount = lineAmount(quantity, unitPrice);
  return { amount, total_amount: amount };
}

export function invoiceLineTotals(quantity: number, unitPrice: number, taxAmount = 0) {
  const amount = lineAmount(quantity, unitPrice);
  return { amount, tax_amount: roundMoney(taxAmount), total_amount: lineTotalAmount(amount, taxAmount) };
}

export function headerTotals(lines: { quantity: number; total_amount: number }[]) {
  return {
    total_quantity: roundMoney(lines.reduce((s, l) => s + l.quantity, 0)),
    grand_total: roundMoney(lines.reduce((s, l) => s + l.total_amount, 0)),
  };
}
