import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$/;
const CLASS_RE = /^[A-Za-z0-9_-]{1,16}$/;
const SEAT_RE = /^[A-Za-z0-9_-]{1,8}$/;

type Action = "create" | "set_password" | "set_status";

interface ProvisionBody {
  action?: Action;
  username?: string;
  password?: string;
  role?: string;
  class_code?: string | null;
  seat_no?: string | null;
  user_id?: string;
  status?: string;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function adminKey(): string {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed.default) return parsed.default;
    } catch (_err) {
      // Fall through to the legacy service-role JWT, which Auth admin still accepts.
    }
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!legacy) throw new Error("missing_admin_key");
  return legacy;
}

function publishableKey(): string {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed.default) return parsed.default;
    } catch (_err) {
      // Fall through.
    }
  }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}

function createAdmin(url: string, key: string): SupabaseClient {
  const secretKey = key.startsWith("sb_secret_") || key.startsWith("sb_publishable_");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: secretKey
      ? {
          fetch(input, init) {
            const headers = new Headers(init?.headers);
            headers.delete("Authorization");
            headers.set("apikey", key);
            return fetch(input, { ...init, headers });
          },
        }
      : undefined,
  });
}

function cleanOptional(value: string | null | undefined, pattern: RegExp): string | null | "invalid" {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (!pattern.test(trimmed)) return "invalid";
  return trimmed;
}

function passwordOk(password: string): boolean {
  return typeof password === "string" && password.length >= 8 && password.length <= 72;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!url || !token) return json(401, { error: "not_signed_in" });

  const userClient = createClient(url, publishableKey(), {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) return json(401, { error: "not_signed_in" });

  const { data: caller, error: callerError } = await userClient
    .from("profiles")
    .select("id, role, status")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (callerError || !caller || caller.role !== "teacher" || caller.status !== "active") {
    return json(403, { error: "teacher_only" });
  }

  let body: ProvisionBody;
  try {
    body = await req.json();
  } catch (_err) {
    return json(400, { error: "invalid_json" });
  }

  const admin = createAdmin(url, adminKey());

  if (body.action === "create") {
    const username = (body.username ?? "").trim();
    if (!USERNAME_RE.test(username)) return json(400, { error: "invalid_username" });
    if (!passwordOk(body.password ?? "")) return json(400, { error: "invalid_password" });
    if (body.role !== "student" && body.role !== "teacher") {
      return json(400, { error: "invalid_role" });
    }
    const classCode = cleanOptional(body.class_code, CLASS_RE);
    const seatNo = cleanOptional(body.seat_no, SEAT_RE);
    if (classCode === "invalid" || seatNo === "invalid") {
      return json(400, { error: "invalid_class" });
    }
    if (body.role === "student" && !classCode) {
      return json(400, { error: "invalid_class" });
    }

    const { data: existingNames, error: namesError } = await admin
      .from("profiles")
      .select("username");
    if (namesError) return json(400, { error: "create_failed" });
    const taken = (existingNames ?? []).some((row) =>
      String(row.username).toLowerCase() === username.toLowerCase()
    );
    if (taken) return json(409, { error: "username_taken" });

    const email = `${username.toLowerCase()}@homework.local`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      app_metadata: { role: body.role },
      user_metadata: {},
    });
    if (createError || !created.user) {
      const message = createError?.message ?? "";
      if (/already|registered|exists/i.test(message)) {
        return json(409, { error: "username_taken" });
      }
      return json(400, { error: "create_failed" });
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      username,
      role: body.role,
      class_code: classCode,
      seat_no: seatNo,
      status: "active",
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      if (/duplicate|unique/i.test(profileError.message)) {
        return json(409, { error: "username_taken" });
      }
      return json(400, { error: "create_failed" });
    }

    return json(200, { ok: true, user_id: created.user.id });
  }

  if (body.action === "set_password") {
    if (!body.user_id) return json(400, { error: "not_found" });
    if (!passwordOk(body.password ?? "")) return json(400, { error: "invalid_password" });
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", body.user_id)
      .maybeSingle();
    if (profileError || !profile) return json(404, { error: "not_found" });
    const { error } = await admin.auth.admin.updateUserById(body.user_id, {
      password: body.password,
    });
    if (error) return json(400, { error: "create_failed" });
    return json(200, { ok: true });
  }

  if (body.action === "set_status") {
    if (!body.user_id) return json(400, { error: "not_found" });
    if (body.status !== "active" && body.status !== "disabled") {
      return json(400, { error: "invalid_status" });
    }
    if (body.user_id === caller.id) return json(400, { error: "cannot_change_self" });
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", body.user_id)
      .maybeSingle();
    if (profileError || !profile) return json(404, { error: "not_found" });

    const { error: updateError } = await admin
      .from("profiles")
      .update({ status: body.status })
      .eq("id", body.user_id);
    if (updateError) return json(400, { error: "create_failed" });

    const { error: banError } = await admin.auth.admin.updateUserById(body.user_id, {
      ban_duration: body.status === "disabled" ? "876000h" : "none",
    });
    if (banError) return json(400, { error: "create_failed" });
    return json(200, { ok: true });
  }

  return json(400, { error: "invalid_action" });
});
