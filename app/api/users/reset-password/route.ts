import { NextResponse } from "next/server";
import { AuthError, assertPermission } from "@/lib/auth/guards";
import { resetUserPassword } from "@/lib/auth/actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  try {
    await assertPermission("users.manage");
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const body = (await request.json()) as Record<string, unknown>;
  const formData = new FormData();
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string") formData.set(key, value);
  }

  const result = await resetUserPassword(formData);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
