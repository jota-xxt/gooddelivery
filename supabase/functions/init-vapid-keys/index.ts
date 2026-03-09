import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateVAPIDKeys() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );

  const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyRaw)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return {
    publicKey: publicKeyBase64,
    privateKeyJwk: JSON.stringify(privateKeyJwk),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // Check if admin
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) throw new Error("Only admins can initialize VAPID keys");

    // Check if keys already exist
    const { data: existing } = await supabaseAdmin
      .from("app_settings")
      .select("key")
      .in("key", ["vapid_public_key", "vapid_private_key_jwk"]);

    if (existing && existing.length === 2) {
      // Keys exist, return the public key
      const { data: pubKey } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "vapid_public_key")
        .single();

      return new Response(JSON.stringify({ publicKey: pubKey?.value, status: "already_exists" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate new keys
    const { publicKey, privateKeyJwk } = await generateVAPIDKeys();

    // Store in app_settings
    await supabaseAdmin.from("app_settings").upsert([
      { key: "vapid_public_key", value: publicKey },
      { key: "vapid_private_key_jwk", value: privateKeyJwk },
    ], { onConflict: "key" });

    return new Response(JSON.stringify({ publicKey, status: "created" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
