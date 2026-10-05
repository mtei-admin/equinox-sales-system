function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function parsePurchasingFilters(searchParams: Record<string, string | string[] | undefined>) {
  const status = firstParam(searchParams.status);
  return {
    q: firstParam(searchParams.q).trim(),
    status: status || "all",
    from: firstParam(searchParams.from),
    to: firstParam(searchParams.to),
  };
}
