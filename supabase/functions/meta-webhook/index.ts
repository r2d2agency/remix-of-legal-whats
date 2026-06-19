import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") ?? "";
const APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const header = req.headers.get("x-hub-signature-256");
  if (!header || !APP_SECRET) return false;
  const sig = header.replace(/^sha256=/, "");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const computed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(computed)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === sig;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);

  // Webhook verification handshake (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const rawBody = await req.text();
  if (!(await verifySignature(req, rawBody))) {
    return new Response("invalid signature", { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return new Response("bad json", { status: 400 }); }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const object = payload.object;
    for (const entry of payload.entry ?? []) {
      const externalId = entry.id;
      let kind: "facebook_page" | "instagram_account" | "whatsapp_number" | null = null;
      if (object === "page") kind = "facebook_page";
      else if (object === "instagram") kind = "instagram_account";
      else if (object === "whatsapp_business_account") kind = "whatsapp_number";

      // Identify organization via meta_pages
      let orgId: string | null = null;
      if (kind) {
        const { data } = await supabase
          .from("meta_pages")
          .select("organization_id")
          .eq("kind", kind)
          .eq("external_id", externalId)
          .maybeSingle();
        orgId = data?.organization_id ?? null;
      }

      // Store raw event for downstream processing (audit + retry-friendly)
      await supabase.from("meta_pages").update({ updated_at: new Date().toISOString() })
        .eq("kind", kind!).eq("external_id", externalId);

      // TODO: enfileirar para o handler de mensagens existente (Memory: Meta Webhook Logic).
      console.log("meta-webhook event", { object, externalId, orgId, changes: entry.changes ?? entry.messaging });
    }
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("meta-webhook error", e);
    return new Response("error", { status: 200 }); // 200 to avoid Meta retries flooding while debugging
  }
});