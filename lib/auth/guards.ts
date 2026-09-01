import { redirect } from "next/navigation";
import { getSessionProfile, type SessionProfile } from "@/lib/auth/session";
import { can, type Permission } from "@/lib/permissions/policies";

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireProfile(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.status !== "active") redirect("/login?error=inactive");
  return profile;
}

export async function requirePermission(permission: Permission): Promise<SessionProfile> {
  const profile = await requireProfile();
  if (!can(profile.role, permission)) {
    redirect("/dashboard");
  }
  return profile;
}

export async function assertPermission(permission: Permission): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile || profile.status !== "active") {
    throw new AuthError("Unauthorized", 401);
  }
  if (!can(profile.role, permission)) {
    throw new AuthError("Forbidden", 403);
  }
  return profile;
}
