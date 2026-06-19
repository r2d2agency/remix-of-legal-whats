import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const APP_ID = Deno.env.get("META_APP_ID") ?? "";
const APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";
const CONFIG_ID_WHATSAPP = Deno.env.get("META_CONFIG_ID_WHATSAPP") ?? "";
const WEBHOOK_VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type ConnRow = {
  id: string;
  organization_id: string;
  user_id: string;
  provider: string;
  fb_user_id: string | null;
  access_token: string;
  token_expires_at: string | null;
  scopes: string[];
  created_at: string;
  updated_at: string;
};

type PageRow = {
  id: string;
  organization_id: string;
  oauth_connection_id: string;
  kind: string;
  external_id: string;
  external_name: string | null;
  status: string;
  phone_number: string | null;
  created_at: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isSuperadmin(req: Request): boolean {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  // Service role bypasses RLS; we still validate the JWT belongs to a superadmin by checking app_metadata.
  // Edge functions run in a constrained environment; use the anon client with the user's token to call auth.getUser().
  return true; // additional check done below via auth client
}

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

async function fetchConnections(supabaseAdmin: ReturnType<typeof createClient>) {
  const { data: connections, error } = await supabaseAdmin
    .from("meta_oauth_connections")
    .select("id, organization_id, user_id, provider, fb_user_id, token_expires_at, scopes, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return connections ?? [];
}

async function fetchPages(supabaseAdmin: ReturnType<typeof createClient>) {
  const { data: pages, error } = await supabaseAdmin
    .from("meta_pages")
    .select("id, organization_id, oauth_connection_id, kind, external_id, external_name, status, phone_number, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return pages ?? [];
}

async function fetchOrganizations(supabaseAdmin: ReturnType<typeof createClient>) {
  const { data, error } = await supabaseAdmin.from("organizations").select("id, name, slug");
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; name: string; slug: string }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, "");

  try {
    const user = await getUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    // Validate superadmin via service_role lookup on a safe view. We rely on the existing user_roles table pattern if present.
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    const isAdmin = roleData?.role === "admin" || user.app_metadata?.is_superadmin === true;
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    if (path === "/meta-admin/status" || path === "/meta-admin") {
      const { count: connCount } = await supabaseAdmin
        .from("meta_oauth_connections")
        .select("*", { count: "exact", head: true });
      const { count: pageCount } = await supabaseAdmin
        .from("meta_pages")
        .select("*", { count: "exact", head: true });

      return json({
        configured: !!(APP_ID && APP_SECRET && WEBHOOK_VERIFY_TOKEN),
        app_id_configured: !!APP_ID,
        app_secret_configured: !!APP_SECRET,
        webhook_verify_token_configured: !!WEBHOOK_VERIFY_TOKEN,
        whatsapp_config_id_configured: !!CONFIG_ID_WHATSAPP,
        connections_count: connCount ?? 0,
        pages_count: pageCount ?? 0,
      });
    }

    if (path === "/meta-admin/connections") {
      const [connections, pages, orgs] = await Promise.all([
        fetchConnections(supabaseAdmin),
        fetchPages(supabaseAdmin),
        fetchOrganizations(supabaseAdmin),
      ]);
      const orgMap = new Map(orgs.map((o) => [o.id, o]));
      return json({ connections, pages, organizations: orgMap });
    }

    if (path === "/meta-admin/revoke" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const connectionId = String(body.connection_id ?? "");
      if (!connectionId) return json({ error: "connection_id required" }, 400);

      const { data: conn } = await supabaseAdmin
        .from("meta_oauth_connections")
        .select("id, access_token")
        .eq("id", connectionId)
        .single();
      if (conn) {
        // Best-effort revoke on Meta side
        try {
          await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${encodeURIComponent(conn.access_token)}`, {
            method: "DELETE",
          });
        } catch {
          // ignore
        }
      }

      await supabaseAdmin.from("meta_pages").update({ status: "revoked" }).eq("oauth_connection_id", connectionId);
      await supabaseAdmin.from("meta_oauth_connections").delete().eq("id", connectionId);

      return json({ success: true });
    }

    if (path === "/meta-admin/sync" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const connectionId = String(body.connection_id ?? "");
      if (!connectionId) return json({ error: "connection_id required" }, 400);

      const { data: conn } = await supabaseAdmin
        .from("meta_oauth_connections")
        .select("*")
        .eq("id", connectionId)
        .single();
      if (!conn) return json({ error: "connection not found" }, 404);

      // Invoke the existing pages-sync function with service role headers
      const syncUrl = `${SUPABASE_URL}/functions/v1/meta-pages-sync`;
      const res = await fetch(syncUrl, {
        method: "POST",
        headers: {
          "Authorization": req.headers.get("Authorization")!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ connection_id: connectionId }),
      });
      const result = await res.json().catch(() => ({ raw: await res.text() }));
      return json(result, res.status);
    }

    return json({ error: "not found" }, 404);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
