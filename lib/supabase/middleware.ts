import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { accessForPath, canAccessPath, isPublicPath, safeNextPath } from "@/lib/auth/routes";
import type { UserRole } from "@/types/database";

function passPathname(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

function unauthorized(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const redirect = request.nextUrl.clone();
  redirect.pathname = "/login";
  redirect.search = "";
  const next = safeNextPath(request.nextUrl.pathname + request.nextUrl.search);
  if (next !== "/dashboard") {
    redirect.searchParams.set("next", next);
  }
  return NextResponse.redirect(redirect);
}

function forbidden(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const redirect = request.nextUrl.clone();
  redirect.pathname = "/dashboard";
  redirect.search = "";
  return NextResponse.redirect(redirect);
}

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;
  const publicPath = isPublicPath(pathname);

  let response = passPathname(request);

  if (!url || !key) {
    if (publicPath) return response;
    return unauthorized(request);
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Parameters<typeof response.cookies.set>[2] }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = passPathname(request);
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !publicPath) {
    return unauthorized(request);
  }

  if (user && pathname === "/login") {
    const redirect = request.nextUrl.clone();
    redirect.pathname = safeNextPath(request.nextUrl.searchParams.get("next"));
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  if (!user) {
    return response;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active") {
    await supabase.auth.signOut();
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Inactive" }, { status: 401 });
    }
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.search = "";
    redirect.searchParams.set("error", "inactive");
    return NextResponse.redirect(redirect);
  }

  const access = accessForPath(pathname);
  if (access !== "public" && access !== "authenticated") {
    if (!canAccessPath(profile.role as UserRole, pathname)) {
      return forbidden(request);
    }
  }

  return response;
}
