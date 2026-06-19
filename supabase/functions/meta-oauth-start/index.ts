import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const APP_ID = Deno.env.get("META_APP_ID") ?? "";
const APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";
const CONFIG_ID_WHATSAPP = Deno.env.get("META_CONFIG_ID_WHATSAPP") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

const GRAPH_VERSION = "v21.0";

const SCOPES: Record<string, string[]> = {
  whatsapp: ["whatsapp_business_management", "whatsapp_business_messaging", "business_management"],
  facebook: ["pages_show_list", "pages_messaging", "pages_manage_metadata", "pages_read_engagement", "business_management"],
  instagram: ["pages_show_list", "pages_manage_metadata", "instagram_basic", "instagram_manage_messages", "business_management"],
};

async function signState(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!APP_ID || !APP_SECRET) {
      return new Response(JSON.stringify({ error: "Meta App não configurado pela Gleego" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const provider = String(body.provider ?? "facebook");
    const organizationId = String(body.organization_id ?? "");
    const redirectUri = String(body.redirect_uri ?? "");
    if (!["facebook", "instagram", "whatsapp"].includes(provider)) {
      return new Response(JSON.stringify({ error: "invalid provider" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!organizationId || !redirectUri) {
      return new Response(JSON.stringify({ error: "missing organization_id or redirect_uri" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const statePayload = btoa(JSON.stringify({
      o: organizationId,
      u: userData.user.id,
      p: provider,
      r: redirectUri,
      t: Date.now(),
    }));
    const sig = await signState(statePayload);
    const state = `${statePayload}.${sig}`;

    const params = new URLSearchParams({
      client_id: APP_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
      scope: SCOPES[provider].join(","),
    });
    if (provider === "whatsapp" && CONFIG_ID_WHATSAPP) {
      params.set("config_id", CONFIG_ID_WHATSAPP);
    }

    const url = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
    return new Response(JSON.stringify({ url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});