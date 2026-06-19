import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const GRAPH_VERSION = "v21.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = req.headers.get("Authorization");
  if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: conns } = await admin
    .from("meta_oauth_connections")
    .select("*")
    .eq("user_id", u.user.id);

  if (!conns?.length) {
    return new Response(JSON.stringify({ ok: true, refreshed: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let refreshed = 0;
  for (const c of conns) {
    const token = c.access_token;
    try {
      if (c.provider === "facebook" || c.provider === "instagram") {
        const url = `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`;
        const r = await fetch(url);
        if (!r.ok) continue;
        const pages = (await r.json()).data ?? [];
        for (const p of pages) {
          if (c.provider === "facebook") {
            await admin.from("meta_pages").upsert({
              organization_id: c.organization_id,
              oauth_connection_id: c.id,
              kind: "facebook_page",
              external_id: p.id,
              external_name: p.name,
              page_access_token: p.access_token,
            }, { onConflict: "organization_id,kind,external_id" });
          }
          if (c.provider === "instagram" && p.instagram_business_account) {
            await admin.from("meta_pages").upsert({
              organization_id: c.organization_id,
              oauth_connection_id: c.id,
              kind: "instagram_account",
              external_id: p.instagram_business_account.id,
              external_name: p.instagram_business_account.username,
              page_access_token: p.access_token,
              metadata: { facebook_page_id: p.id, facebook_page_name: p.name },
            }, { onConflict: "organization_id,kind,external_id" });
          }
        }
        refreshed++;
      }
    } catch (e) {
      console.error("sync error", e);
    }
  }

  return new Response(JSON.stringify({ ok: true, refreshed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});