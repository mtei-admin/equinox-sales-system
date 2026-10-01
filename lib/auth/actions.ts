"use server";

import { revalidatePath } from "next/cache";
import { AuthError, assertPermission, requireProfile } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { adminEnvError, isAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/config";
import {
  inviteUserSchema,
  loginSchema,
  profileSchema,
  resetPasswordSchema,
  userAccessSchema,
  userAdminSchema,
} from "@/lib/validation/schemas";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function signIn(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid credentials" };
  }
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured" };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    if (error.message === "fetch failed") {
      return {
        ok: false,
        error: "Cannot reach Supabase. Check NEXT_PUBLIC_SUPABASE_URL in .env.local and that the project is running.",
      };
    }
    return { ok: false, error: error.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Invalid login credentials" };

  const { data: profile } = await supabase.from("users").select("status").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "active") {
    await supabase.auth.signOut();
    return { ok: false, error: "This account is inactive. Ask an administrator to reactivate it." };
  }

  return { ok: true };
}

export async function updateOwnProfile(formData: FormData): Promise<ActionResult> {
  const profile = await requireProfile();
  const parsed = profileSchema.safeParse({
    username: formData.get("username"),
    full_name: formData.get("full_name"),
    department: formData.get("department") || "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid profile" };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("users")
    .update({
      username: parsed.data.username,
      full_name: parsed.data.full_name,
      department: parsed.data.department || null,
      updated_by: profile.id,
    })
    .eq("id", profile.id);

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Username is already taken" };
    return { ok: false, error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/users");
  return { ok: true };
}

export async function updateUser(formData: FormData): Promise<ActionResult> {
  let actor;
  try {
    actor = await assertPermission("users.manage");
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    throw err;
  }
  const parsed = userAdminSchema.safeParse({
    user_id: formData.get("user_id"),
    full_name: formData.get("full_name"),
    username: formData.get("username"),
    department: formData.get("department") || "",
    role: formData.get("role"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid user" };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .update({
      full_name: parsed.data.full_name,
      username: parsed.data.username,
      department: parsed.data.department || null,
      role: parsed.data.role,
      status: parsed.data.status,
      updated_by: actor.id,
    })
    .eq("id", parsed.data.user_id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Username is already taken" };
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: "User not found" };

  revalidatePath("/users");
  revalidatePath(`/users/${parsed.data.user_id}`);
  return { ok: true };
}

export async function updateUserAccess(formData: FormData): Promise<ActionResult> {
  let actor;
  try {
    actor = await assertPermission("users.manage");
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    throw err;
  }
  const parsed = userAccessSchema.safeParse({
    user_id: formData.get("user_id"),
    role: formData.get("role"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid user" };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("users")
    .update({
      role: parsed.data.role,
      status: parsed.data.status,
      updated_by: actor.id,
    })
    .eq("id", parsed.data.user_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/users");
  return { ok: true };
}

export async function inviteUser(formData: FormData): Promise<ActionResult> {
  let actor;
  try {
    actor = await assertPermission("users.manage");
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    throw err;
  }
  const parsed = inviteUserSchema.safeParse({
    email: formData.get("email"),
    full_name: formData.get("full_name"),
    username: formData.get("username"),
    password: formData.get("password"),
    role: formData.get("role"),
    department: formData.get("department") || "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid invite" };
  }
  if (!isAdminConfigured()) {
    return { ok: false, error: adminEnvError() };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        full_name: parsed.data.full_name,
        username: parsed.data.username,
        role: parsed.data.role,
      },
    });
    if (error) throw error;
    if (data.user) {
      const { error: profileError } = await admin
        .from("users")
        .update({
          role: parsed.data.role,
          full_name: parsed.data.full_name,
          username: parsed.data.username,
          department: parsed.data.department || null,
          status: "active",
          created_by: actor.id,
          updated_by: actor.id,
        })
        .eq("id", data.user.id);
      if (profileError) throw profileError;
    }
    revalidatePath("/users");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not create user" };
  }
}

export async function resetUserPassword(formData: FormData): Promise<ActionResult> {
  try {
    await assertPermission("users.manage");
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = resetPasswordSchema.safeParse({
    user_id: formData.get("user_id"),
    password: formData.get("password"),
    confirm_password: formData.get("confirm_password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid password" };
  }
  if (!isAdminConfigured()) {
    return { ok: false, error: adminEnvError() };
  }

  try {
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("id")
      .eq("id", parsed.data.user_id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return { ok: false, error: "User not found" };

    const { error } = await admin.auth.admin.updateUserById(parsed.data.user_id, {
      password: parsed.data.password,
    });
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not reset password" };
  }
}
