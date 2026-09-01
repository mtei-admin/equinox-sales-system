import { describe, expect, it } from "vitest";
import { inviteUserSchema, loginSchema, profileSchema, userAccessSchema } from "@/lib/validation/schemas";

describe("auth schemas", () => {
  it("accepts a valid invite for each role", () => {
    for (const role of ["admin", "sales", "warehouse", "accounting"] as const) {
      const parsed = inviteUserSchema.safeParse({
        email: `${role}@equinox.local`,
        full_name: `${role} user`,
        username: role,
        password: "password1",
        role,
      });
      expect(parsed.success).toBe(true);
    }
  });

  it("rejects invite without an approved role", () => {
    const parsed = inviteUserSchema.safeParse({
      email: "x@equinox.local",
      full_name: "Viewer",
      username: "viewer",
      password: "password1",
      role: "viewer",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects short invite passwords", () => {
    const parsed = inviteUserSchema.safeParse({
      email: "x@equinox.local",
      full_name: "Short",
      username: "shorty",
      password: "short",
      role: "sales",
    });
    expect(parsed.success).toBe(false);
  });

  it("profile updates cannot include role or status", () => {
    const parsed = profileSchema.safeParse({
      username: "ana",
      full_name: "Ana Reyes",
      department: "Sales",
      role: "admin",
      status: "inactive",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        username: "ana",
        full_name: "Ana Reyes",
        department: "Sales",
      });
    }
  });

  it("admin access update requires uuid, role, and status", () => {
    expect(
      userAccessSchema.safeParse({
        user_id: "00000000-0000-0000-0000-000000000001",
        role: "warehouse",
        status: "inactive",
      }).success,
    ).toBe(true);
    expect(userAccessSchema.safeParse({ user_id: "nope", role: "sales", status: "active" }).success).toBe(false);
  });

  it("login requires an email", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "user@equinox.local", password: "x" }).success).toBe(true);
  });
});
