import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const APP_ID = Deno.env.get("META_APP_ID") ?? "";
const APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const GRAPH_VERSION = "v21.0";

async function verifyState(state: string): Promise<{ o: string; u: string; p: string; r: string; t: number } | null> {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expectedHex = Array.from(new Uint8Array(expected)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expectedHex !== sig) return null;
  try {
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

async function exchangeCode(code: string, redirectUri: string) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
  url.searchParams.set("client_id", APP_ID);
  url.searchParams.set("client_secret", APP_SECRET);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`exchange failed: ${res.status} ${await res.text()}`);
  return await res.json() as { access_token: string; token_type: string; expires_in?: number };
}

async function longLived(shortToken: string) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", APP_ID);
  url.searchParams.set("client_secret", APP_SECRET);
  url.searchParams.set("fb_exchange_token", shortToken);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  return await res.json() as { access_token: string; expires_in?: number };
}

async function fetchMe(token: string) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/me?fields=id,name&access_token=${encodeURIComponent(token)}`);
  if (!res.ok) return null;
  return await res.json() as { id: string; name: string };
}

async function fetchPagesAndInstagram(token: string) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}

async function fetchWhatsappNumbers(token: string) {
  // List WABAs the user can manage, then phone numbers for each
  const wabasRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/me/businesses?access_token=${encodeURIComponent(token)}`);
  if (!wabasRes.ok) return [];
  const businesses = (await wabasRes.json()).data ?? [];
  const numbers: Array<{ waba_id: string; phone_number_id: string; display_phone_number: string; verified_name: string }> = [];
  for (const b of businesses) {
    const wabaListRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${b.id}/owned_whatsapp_business_accounts?access_token=${encodeURIComponent(token)}`);
    if (!wabaListRes.ok) continue;
    const wabaList = (await wabaListRes.json()).data ?? [];
    for (const w of wabaList) {
      const phonesRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${w.id}/phone_numbers?access_token=${encodeURIComponent(token)}`);
      if (!phonesRes.ok) continue;
      const phones = (await phonesRes.json()).data ?? [];
      for (const p of phones) {
        numbers.push({
          waba_id: w.id,
          phone_number_id: p.id,
          display_phone_number: p.display_phone_number,
          verified_name: p.verified_name,
        });
      }
    }
  }
  return numbers;
}

function htmlResponse(redirectTo: string, ok: boolean, message: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Meta</title></head><body style="font-family:system-ui;padding:24px;">
<h2>${ok ? "✅ Conta conectada" : "❌ Erro ao conectar"}</h2>
<p>${message}</p>
<script>setTimeout(function(){location.href=${JSON.stringify(redirectTo)}},1500)</script>
<p><a href="${redirectTo}">Voltar à plataforma</a></p>
</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (!APP_ID || !APP_SECRET) {
    return htmlResponse("/", false, "Meta App não configurado pela Gleego.");
  }

  if (error) return htmlResponse("/", false, `A Meta retornou: ${error}`);
  if (!code || !state) return htmlResponse("/", false, "Resposta inválida da Meta.");

  const verified = await verifyState(state);
  if (!verified) return htmlResponse("/", false, "State inválido (possível tentativa de CSRF).");

  try {
    const short = await exchangeCode(code, verified.r);
    const long = await longLived(short.access_token);
    const accessToken = long?.access_token ?? short.access_token;
    const expiresIn = long?.expires_in ?? short.expires_in;
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

    const me = await fetchMe(accessToken);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: connRow, error: connErr } = await supabase
      .from("meta_oauth_connections")
      .insert({
        organization_id: verified.o,
        user_id: verified.u,
        provider: verified.p,
        fb_user_id: me?.id ?? null,
        access_token: accessToken,
        token_expires_at: expiresAt,
        metadata: { name: me?.name ?? null },
      })
      .select()
      .single();
    if (connErr) throw connErr;

    // Discover assets based on provider
    if (verified.p === "facebook" || verified.p === "instagram") {
      const pages = await fetchPagesAndInstagram(accessToken);
      for (const p of pages) {
        if (verified.p === "facebook") {
          await supabase.from("meta_pages").upsert({
            organization_id: verified.o,
            oauth_connection_id: connRow.id,
            kind: "facebook_page",
            external_id: p.id,
            external_name: p.name,
            page_access_token: p.access_token,
          }, { onConflict: "organization_id,kind,external_id" });
        }
        if (verified.p === "instagram" && p.instagram_business_account) {
          await supabase.from("meta_pages").upsert({
            organization_id: verified.o,
            oauth_connection_id: connRow.id,
            kind: "instagram_account",
            external_id: p.instagram_business_account.id,
            external_name: p.instagram_business_account.username,
            page_access_token: p.access_token,
            metadata: { facebook_page_id: p.id, facebook_page_name: p.name },
          }, { onConflict: "organization_id,kind,external_id" });
        }
      }
    }

    if (verified.p === "whatsapp") {
      const numbers = await fetchWhatsappNumbers(accessToken);
      for (const n of numbers) {
        await supabase.from("meta_pages").upsert({
          organization_id: verified.o,
          oauth_connection_id: connRow.id,
          kind: "whatsapp_number",
          external_id: n.phone_number_id,
          external_name: n.verified_name,
          waba_id: n.waba_id,
          phone_number: n.display_phone_number,
        }, { onConflict: "organization_id,kind,external_id" });
      }
    }

    return htmlResponse(`${verified.r.split("/api/")[0]}/configuracoes/conexoes?meta=ok`, true, "Sua conta Meta foi conectada com sucesso.");
  } catch (e) {
    return htmlResponse("/", false, `Falha: ${String(e)}`);
  }
});