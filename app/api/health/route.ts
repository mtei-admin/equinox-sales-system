import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "equinox-sales-system",
    time: new Date().toISOString(),
  });
}
